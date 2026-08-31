import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { FaceAnalysis } from './OnDeviceFaceAnalysis.types';

declare class OnDeviceFaceAnalysisModule extends NativeModule<{}> {
  analyzeImageAsync(uri: string): Promise<FaceAnalysis>;
}

export default requireOptionalNativeModule<OnDeviceFaceAnalysisModule>('OnDeviceFaceAnalysis');
