import { requireNativeViewManager, requireOptionalNativeModule } from "expo-modules-core";
import type { ViewProps } from "react-native";
import type { ComponentType, Ref } from "react";
import type { LivenessFrameResult } from "../../src/services/livenessStateMachine";
export interface FaceScannerRef {
  capture: () => Promise<{ uri: string }>;
}
export interface FaceScannerProps extends ViewProps {
  active: boolean;
  onFrame: (event: { nativeEvent: LivenessFrameResult }) => void;
  onError: (event: { nativeEvent: { message: string } }) => void;
  ref?: Ref<FaceScannerRef>;
}
export const scannerAvailable = Boolean(requireOptionalNativeModule("SmartFaceScanner"));
export const NativeFaceScanner: ComponentType<FaceScannerProps> | null = scannerAvailable
  ? requireNativeViewManager("SmartFaceScanner")
  : null;
