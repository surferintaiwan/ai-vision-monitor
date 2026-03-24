import { NativeModules } from 'react-native';

const { ScreenCaptureModule } = NativeModules;

export async function captureScreenPixelCopy(): Promise<string> {
  return ScreenCaptureModule.captureScreen();
}
