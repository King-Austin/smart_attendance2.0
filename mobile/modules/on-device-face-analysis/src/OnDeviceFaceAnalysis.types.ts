export interface DetectedFace {
  x: number;
  y: number;
  width: number;
  height: number;
  headEulerAngleX: number;
  headEulerAngleY: number;
  headEulerAngleZ: number;
  leftEyeOpenProbability: number;
  rightEyeOpenProbability: number;
  smilingProbability: number;
}

export interface FaceAnalysis {
  faceCount: number;
  brightness: number;
  isWellLit: boolean;
  imageWidth: number;
  imageHeight: number;
  face: DetectedFace | null;
}
