import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Matrix } from "@mediapipe/tasks-vision";

const mediaPipe = vi.hoisted(() => ({
  resolve: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: mediaPipe.resolve },
  FaceLandmarker: { createFromOptions: mediaPipe.create },
}));

import {
  analyzeVideoFrame,
  disposeGoogleFaceLandmarker,
  extractPoseFromMatrix,
  initGoogleFaceLandmarker,
  resetGoogleFaceLandmarker,
  type FaceLandmarkerRuntime,
} from "./googleLivenessTracker";

function fakeLandmarker() {
  return { close: vi.fn(), detectForVideo: vi.fn() };
}

describe("MediaPipe face runtime", () => {
  beforeEach(() => {
    disposeGoogleFaceLandmarker();
    vi.useRealTimers();
    mediaPipe.resolve.mockReset().mockResolvedValue({});
    mediaPipe.create.mockReset();
  });

  it("initializes GPU with local versioned assets", async () => {
    const landmarker = fakeLandmarker();
    mediaPipe.create.mockResolvedValue(landmarker);
    const runtime = await initGoogleFaceLandmarker();
    expect(runtime?.delegate).toBe("GPU");
    expect(mediaPipe.resolve).toHaveBeenCalledWith("/mediapipe/1.0.1/wasm");
    expect(mediaPipe.create).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        baseOptions: expect.objectContaining({
          delegate: "GPU",
          modelAssetPath: "/mediapipe/1.0.1/models/face_landmarker.float16.v1.task",
        }),
        numFaces: 2,
      }),
    );
  });

  it("falls back once from GPU to CPU", async () => {
    mediaPipe.create
      .mockRejectedValueOnce(new Error("GPU unavailable"))
      .mockResolvedValueOnce(fakeLandmarker());
    const runtime = await initGoogleFaceLandmarker();
    expect(runtime?.delegate).toBe("CPU");
    expect(mediaPipe.create).toHaveBeenCalledTimes(2);
  });

  it("falls back after the six-second GPU timeout", async () => {
    vi.useFakeTimers();
    mediaPipe.create
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockResolvedValueOnce(fakeLandmarker());
    const initializing = initGoogleFaceLandmarker();
    await vi.advanceTimersByTimeAsync(6_000);
    await expect(initializing).resolves.toMatchObject({ delegate: "CPU" });
  });

  it("returns null when both delegates fail", async () => {
    mediaPipe.create.mockRejectedValue(new Error("unsupported"));
    await expect(initGoogleFaceLandmarker()).resolves.toBeNull();
    expect(mediaPipe.create).toHaveBeenCalledTimes(2);
  });

  it("stops a runtime after three consecutive inference failures", () => {
    const landmarker = fakeLandmarker();
    landmarker.detectForVideo.mockImplementation(() => {
      throw new Error("inference failure");
    });
    const runtime = {
      landmarker,
      delegate: "CPU",
      state: "ready",
      consecutiveFailures: 0,
    } as unknown as FaceLandmarkerRuntime;
    const image = {} as HTMLCanvasElement;
    analyzeVideoFrame(image, 100, runtime, "good");
    analyzeVideoFrame(image, 200, runtime, "good");
    const result = analyzeVideoFrame(image, 300, runtime, "good");
    expect(runtime.state).toBe("failed");
    expect(result.runtimeError).toBe(true);
  });

  it("disposes the old runtime before an explicit retry", async () => {
    const first = fakeLandmarker();
    const second = fakeLandmarker();
    mediaPipe.create.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    await initGoogleFaceLandmarker();
    await resetGoogleFaceLandmarker();
    expect(first.close).toHaveBeenCalledOnce();
  });

  it("extracts finite neutral pose values", () => {
    const matrix = {
      rows: 4,
      columns: 4,
      data: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    } as Matrix;
    expect(extractPoseFromMatrix(matrix)).toEqual({ yawDegrees: 0, pitchDegrees: -0 });
  });
});
