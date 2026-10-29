import { FaceLandmarker, FilesetResolver, type Matrix } from "@mediapipe/tasks-vision";
import { reportOperationalError } from "@/lib/operationalError";
import type {
  LivenessDelegate,
  LivenessFrameResult,
  LivenessRuntimeState,
} from "@/services/livenessStateMachine";

const ASSET_ROOT = "/mediapipe/1.0.1";
const WASM_URL = `${ASSET_ROOT}/wasm`;
const MODEL_URL = `${ASSET_ROOT}/models/face_landmarker.float16.v1.task`;
const INITIALIZATION_TIMEOUT_MS = 6_000;
const MAX_CONSECUTIVE_INFERENCE_FAILURES = 3;

export interface FaceLandmarkerRuntime {
  landmarker: FaceLandmarker;
  delegate: LivenessDelegate;
  state: LivenessRuntimeState;
  consecutiveFailures: number;
}

let activeRuntime: FaceLandmarkerRuntime | null = null;
let initializationPromise: Promise<FaceLandmarkerRuntime | null> | null = null;
let runtimeGeneration = 0;
let lastDiagnosticAt = 0;
let diagnosticWindowStartedAt = 0;
let diagnosticFrameCount = 0;

function emitDiagnostic(
  operation: string,
  context: Record<string, string | number | boolean | null>,
) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(
    new CustomEvent("scp:liveness-diagnostic", {
      detail: { operation, timestamp: new Date().toISOString(), context },
    }),
  );
}

async function createRuntime(
  delegate: LivenessDelegate,
  generation: number,
): Promise<FaceLandmarkerRuntime> {
  const startedAt = performance.now();
  const filesetResolver = await FilesetResolver.forVisionTasks(WASM_URL);
  let timedOut = false;
  const creation = FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numFaces: 2,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = globalThis.setTimeout(() => {
      timedOut = true;
      reject(new Error(`${delegate} initialization timed out.`));
    }, INITIALIZATION_TIMEOUT_MS);
  });

  try {
    const landmarker = await Promise.race([creation, timeout]);
    if (generation !== runtimeGeneration) {
      landmarker.close();
      throw new Error("Face scanner initialization was superseded.");
    }
    const runtime: FaceLandmarkerRuntime = {
      landmarker,
      delegate,
      state: "ready",
      consecutiveFailures: 0,
    };
    emitDiagnostic("runtime initialized", {
      delegate,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return runtime;
  } catch (error) {
    if (timedOut) {
      void creation.then((lateLandmarker) => lateLandmarker.close()).catch(() => undefined);
    }
    throw error;
  } finally {
    if (timeoutHandle !== undefined) globalThis.clearTimeout(timeoutHandle);
  }
}

/** Initialize the local MediaPipe runtime, with a compatibility-mode CPU fallback. */
export async function initGoogleFaceLandmarker(): Promise<FaceLandmarkerRuntime | null> {
  if (activeRuntime?.state === "ready") return activeRuntime;
  if (initializationPromise) return initializationPromise;

  const generation = runtimeGeneration;
  initializationPromise = (async () => {
    for (const delegate of ["GPU", "CPU"] as const) {
      try {
        const runtime = await createRuntime(delegate, generation);
        activeRuntime = runtime;
        return runtime;
      } catch (error) {
        reportOperationalError("liveness", `initialize ${delegate} face model`, error, {
          severity: "warning",
          context: { delegate },
        });
      }
    }
    return null;
  })().finally(() => {
    initializationPromise = null;
  });

  return initializationPromise;
}

/** Close all MediaPipe resources and invalidate pending initialization attempts. */
export function disposeGoogleFaceLandmarker(): void {
  runtimeGeneration += 1;
  initializationPromise = null;
  const runtime = activeRuntime;
  activeRuntime = null;
  if (!runtime) return;
  runtime.state = "idle";
  try {
    runtime.landmarker.close();
  } catch (error) {
    reportOperationalError("liveness", "close face model", error, { severity: "warning" });
  }
}

/** Force the next initialization to build a fresh runtime. */
export async function resetGoogleFaceLandmarker(): Promise<FaceLandmarkerRuntime | null> {
  disposeGoogleFaceLandmarker();
  return initGoogleFaceLandmarker();
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

/** Extract yaw/pitch from MediaPipe's row-major 4x4 facial transformation matrix. */
export function extractPoseFromMatrix(matrix?: Matrix): {
  yawDegrees: number;
  pitchDegrees: number;
} {
  if (!matrix || matrix.rows < 3 || matrix.columns < 3 || matrix.data.length < 11) {
    throw new Error("Face pose transformation matrix is unavailable.");
  }
  const values = matrix.data;
  const yawDegrees = radiansToDegrees(Math.atan2(values[2], values[10]));
  const pitchDegrees = radiansToDegrees(Math.atan2(-values[6], Math.hypot(values[2], values[10])));
  return { yawDegrees, pitchDegrees };
}

function blendshapeScore(
  categories: Array<{ categoryName: string; score: number }> | undefined,
  name: string,
): number | null {
  const value = categories?.find((category) => category.categoryName === name)?.score;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function emptyFrame(
  timestampMs: number,
  lightingStatus: LivenessFrameResult["lightingStatus"],
  runtimeError = false,
): LivenessFrameResult {
  return {
    timestampMs,
    faceCount: 0,
    yawDegrees: 0,
    pitchDegrees: 0,
    blinkLeft: null,
    blinkRight: null,
    faceWidthRatio: 0,
    faceCenterOffsetRatio: 1,
    lightingStatus,
    runtimeError,
  };
}

/** Analyze one downscaled camera frame and return measurements without UI text. */
export function analyzeVideoFrame(
  image: HTMLVideoElement | HTMLCanvasElement,
  timestampMs: number,
  runtime: FaceLandmarkerRuntime | null,
  lightingStatus: LivenessFrameResult["lightingStatus"],
): LivenessFrameResult {
  if (!runtime || runtime.state !== "ready") {
    return emptyFrame(timestampMs, lightingStatus, true);
  }

  const startedAt = performance.now();
  try {
    const results = runtime.landmarker.detectForVideo(image, timestampMs);
    runtime.consecutiveFailures = 0;
    const faceCount = results.faceLandmarks?.length ?? 0;
    if (faceCount === 0) return emptyFrame(timestampMs, lightingStatus);

    const landmarks = results.faceLandmarks[0];
    const xs = landmarks.map((landmark) => landmark.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const faceWidthRatio = Math.max(0, maxX - minX);
    const faceCenterOffsetRatio = Math.abs((minX + maxX) / 2 - 0.5);
    const { yawDegrees, pitchDegrees } = extractPoseFromMatrix(
      results.facialTransformationMatrixes?.[0],
    );
    const categories = results.faceBlendshapes?.[0]?.categories;

    const now = performance.now();
    diagnosticFrameCount += 1;
    if (diagnosticWindowStartedAt === 0) diagnosticWindowStartedAt = now;
    if (now - lastDiagnosticAt >= 5_000) {
      lastDiagnosticAt = now;
      const elapsed = Math.max(1, now - diagnosticWindowStartedAt);
      emitDiagnostic("inference summary", {
        delegate: runtime.delegate,
        durationMs: Math.round(now - startedAt),
        frameRate: Math.round((diagnosticFrameCount * 1_000 * 10) / elapsed) / 10,
      });
      diagnosticWindowStartedAt = now;
      diagnosticFrameCount = 0;
    }

    return {
      timestampMs,
      faceCount,
      yawDegrees,
      pitchDegrees,
      blinkLeft: blendshapeScore(categories, "eyeBlinkLeft"),
      blinkRight: blendshapeScore(categories, "eyeBlinkRight"),
      faceWidthRatio,
      faceCenterOffsetRatio,
      lightingStatus,
      landmarks,
    };
  } catch (error) {
    runtime.consecutiveFailures += 1;
    const terminal = runtime.consecutiveFailures >= MAX_CONSECUTIVE_INFERENCE_FAILURES;
    if (terminal) runtime.state = "failed";
    reportOperationalError("liveness", "analyze face frame", error, {
      severity: "warning",
      context: {
        delegate: runtime.delegate,
        failureCode: terminal ? "FACE_MODEL_RUNTIME" : "FACE_INFERENCE_RETRY",
      },
    });
    return emptyFrame(timestampMs, lightingStatus, terminal);
  }
}

/** Render a lightweight face mesh overlay over the mirrored preview. */
export function drawFaceLandmarksOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: LivenessFrameResult,
) {
  ctx.clearRect(0, 0, width, height);
  if (frame.faceCount !== 1 || !frame.landmarks) return;

  const paths = [
    [33, 160, 158, 133, 153, 144, 33],
    [362, 385, 387, 263, 373, 380, 362],
    [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61],
    [168, 6, 197, 195, 5, 4, 1, 19, 94, 2],
  ];

  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.strokeStyle = "rgba(16, 185, 129, 0.55)";
  ctx.lineWidth = 1;
  for (const path of paths) {
    ctx.beginPath();
    path.forEach((index, position) => {
      const landmark = frame.landmarks?.[index];
      if (!landmark) return;
      const x = landmark.x * width;
      const y = landmark.y * height;
      if (position === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.restore();
}
