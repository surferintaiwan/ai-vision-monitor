import { NativeModules } from 'react-native';

const { ScreenCaptureModule } = NativeModules;

export async function captureScreenPixelCopy(): Promise<string> {
  return ScreenCaptureModule.captureScreen();
}

/**
 * Capture a frame and compare to previous frame at native level.
 * Returns motion score 0-100 (percentage of changed pixels).
 * Returns -1 on first call (no previous frame to compare).
 */
export async function detectMotionNative(): Promise<number> {
  return ScreenCaptureModule.detectMotion();
}
