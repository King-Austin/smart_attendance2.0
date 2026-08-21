import * as Crypto from 'expo-crypto';

import OnDeviceFaceAnalysis from '../../modules/on-device-face-analysis/src/OnDeviceFaceAnalysisModule';
import type { FaceAnalysis } from '../../modules/on-device-face-analysis/src/OnDeviceFaceAnalysis.types';

export const ON_DEVICE_LIVENESS_METHOD = 'google_mlkit_on_device' as const;
export const ON_DEVICE_LIVENESS_VERSION = 1 as const;

const MIN_BRIGHTNESS = 55;
const MAX_BRIGHTNESS = 235;
const MIN_FACE_WIDTH = 0.25;
const MAX_FACE_WIDTH = 0.74;
const TURN_ANGLE = 18;

export interface AnalysedLivenessFrame {
  instruction: string;
  capturedAt: string;
  imageHash: string;
  analysis: FaceAnalysis;
}

function environmentError(analysis: FaceAnalysis): string | null {
  if (analysis.brightness < MIN_BRIGHTNESS) return 'The area is too dark. Face a window or switch on a light.';
  if (analysis.brightness > MAX_BRIGHTNESS) return 'The light is too harsh. Move away from direct glare.';
  if (analysis.faceCount === 0 || !analysis.face) return 'No face was detected. Centre your full face inside the guide.';
  if (analysis.faceCount > 1) return 'More than one face was detected. Only the account owner may be in view.';
  if (analysis.face.width < MIN_FACE_WIDTH) return 'Move closer—the face is too small for a reliable check.';
  if (analysis.face.width > MAX_FACE_WIDTH) return 'Move slightly back so your full face remains visible.';
  const centreX = analysis.face.x + analysis.face.width / 2;
  const centreY = analysis.face.y + analysis.face.height / 2;
  if (centreX < 0.22 || centreX > 0.78 || centreY < 0.2 || centreY > 0.8) return 'Centre your face inside the oval guide.';
  return null;
}

export function validateLivenessFrame(instruction: string, analysis: FaceAnalysis, previous: AnalysedLivenessFrame[]): string | null {
  const environment = environmentError(analysis);
  if (environment || !analysis.face) return environment;
  const face = analysis.face;

  if (instruction === 'Look straight') {
    if (Math.abs(face.headEulerAngleY) > 12 || Math.abs(face.headEulerAngleZ) > 14) return 'Look directly at the camera with your head upright.';
    if (face.leftEyeOpenProbability < 0.45 || face.rightEyeOpenProbability < 0.45) return 'Keep both eyes open for the first check.';
  }

  if (instruction.startsWith('Turn your head')) {
    if (Math.abs(face.headEulerAngleY) < TURN_ANGLE || Math.abs(face.headEulerAngleY) > 60) return 'Turn your head farther toward the requested shoulder, while keeping both eyes visible.';
    const earlierTurn = previous.find((frame) => frame.instruction.startsWith('Turn your head'))?.analysis.face;
    if (earlierTurn && Math.sign(earlierTurn.headEulerAngleY) === Math.sign(face.headEulerAngleY)) return 'Turn toward the opposite shoulder for this step.';
  }

  if (instruction === 'Close both eyes') {
    if (Math.abs(face.headEulerAngleY) > 15) return 'Face the camera, then hold both eyes closed.';
    if (face.leftEyeOpenProbability < 0 || face.rightEyeOpenProbability < 0) return 'Eye state could not be read. Improve the lighting and try again.';
    if (face.leftEyeOpenProbability > 0.35 || face.rightEyeOpenProbability > 0.35) return 'Both eyes must be fully closed when this frame is captured.';
  }

  return null;
}

export async function analyseLivenessCapture(uri: string, base64: string): Promise<{ analysis: FaceAnalysis; imageHash: string }> {
  if (!OnDeviceFaceAnalysis) throw new Error('Live-face processing requires the installed UNIZIK Presence development build, not Expo Go.');
  const [analysis, imageHash] = await Promise.all([
    OnDeviceFaceAnalysis.analyzeImageAsync(uri),
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64),
  ]);
  return { analysis, imageHash };
}

export function lightingLabel(analysis: FaceAnalysis | null) {
  if (!analysis) return 'Waiting for environment check';
  if (analysis.brightness < MIN_BRIGHTNESS) return 'More light needed';
  if (analysis.brightness > MAX_BRIGHTNESS) return 'Reduce direct glare';
  return 'Lighting is suitable';
}
