import { registerWebModule, NativeModule } from 'expo';
import type { FaceAnalysis } from './OnDeviceFaceAnalysis.types';

// OnDeviceFaceAnalysisModule is not available on the web platform.
class OnDeviceFaceAnalysisModule extends NativeModule<{}> {
  async analyzeImageAsync(): Promise<FaceAnalysis> {
    throw new Error('On-device ML Kit face analysis requires the Android or iOS development build.');
  }
}

export default registerWebModule(OnDeviceFaceAnalysisModule, 'OnDeviceFaceAnalysis');
