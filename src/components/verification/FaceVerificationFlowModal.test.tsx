// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  initModel: vi.fn(),
  resetModel: vi.fn(),
  disposeModel: vi.fn(),
  requestPermission: vi.fn(),
  appStateListener: null as null | ((state: { isActive: boolean }) => void),
  removeAppStateListener: vi.fn(),
}));

vi.mock("@/services/googleLivenessTracker", () => ({
  initGoogleFaceLandmarker: dependencies.initModel,
  resetGoogleFaceLandmarker: dependencies.resetModel,
  disposeGoogleFaceLandmarker: dependencies.disposeModel,
  analyzeVideoFrame: vi.fn(),
  drawFaceLandmarksOverlay: vi.fn(),
}));

vi.mock("@/services/permissionsService", () => ({
  permissionsService: { request: dependencies.requestPermission },
}));

vi.mock("@/services/mobile/appLifecycleService", () => ({
  appLifecycleService: {
    onAppStateChange: vi.fn(async (listener: (state: { isActive: boolean }) => void) => {
      dependencies.appStateListener = listener;
      return dependencies.removeAppStateListener;
    }),
  },
}));

vi.mock("@/lib/operationalError", () => ({ reportOperationalError: vi.fn() }));

import { FaceVerificationFlow } from "./FaceVerificationFlowModal";

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const runtime = {
  delegate: "GPU" as const,
  state: "ready" as const,
  consecutiveFailures: 0,
  landmarker: { close: vi.fn() },
};

async function flushEffects() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("FaceVerificationFlow lifecycle", () => {
  let container: HTMLDivElement;
  let root: Root;
  let streams: Array<{
    track: { stop: ReturnType<typeof vi.fn> };
    getTracks: () => Array<{ stop: ReturnType<typeof vi.fn> }>;
  }>;
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    dependencies.initModel.mockReset().mockResolvedValue(runtime);
    dependencies.resetModel.mockReset().mockResolvedValue(runtime);
    dependencies.disposeModel.mockReset();
    dependencies.requestPermission.mockReset().mockResolvedValue({ state: "granted" });
    dependencies.removeAppStateListener.mockReset();
    dependencies.appStateListener = null;
    streams = [];
    getUserMedia = vi.fn(async () => {
      const track = { stop: vi.fn() };
      const stream = { track, getTracks: () => [track] };
      streams.push(stream);
      return stream;
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
  });

  it("keeps one camera stream and rebuilds cleanly after Android backgrounding", async () => {
    await act(async () => {
      root.render(<FaceVerificationFlow onCaptureCompleted={vi.fn()} />);
    });
    await flushEffects();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(dependencies.initModel).toHaveBeenCalledTimes(1);

    await act(async () => dependencies.appStateListener?.({ isActive: false }));
    expect(streams[0].track.stop).toHaveBeenCalledOnce();
    expect(dependencies.disposeModel).toHaveBeenCalledOnce();

    await act(async () => dependencies.appStateListener?.({ isActive: true }));
    await flushEffects();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(dependencies.initModel).toHaveBeenCalledTimes(2);
    expect(streams).toHaveLength(2);
  });

  it("uses a fresh runtime when the user explicitly retries model loading", async () => {
    dependencies.initModel.mockResolvedValueOnce(null);
    await act(async () => {
      root.render(<FaceVerificationFlow onCaptureCompleted={vi.fn()} />);
    });
    await flushEffects();
    const retry = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Retry face scanner"),
    );
    expect(retry).toBeDefined();
    await act(async () => retry?.click());
    await flushEffects();
    expect(dependencies.resetModel).toHaveBeenCalledOnce();
  });
});
