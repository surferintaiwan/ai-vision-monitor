/**
 * Lightweight motion detection gate using frame skip.
 *
 * VisionCamera frame processors can access raw pixels via native worklet
 * plugins, but for Plan 2 we use a simpler approach: process every Nth
 * frame to keep CPU usage manageable on old devices.
 *
 * At 30fps camera output, FRAME_SKIP=10 means ~3fps detection rate.
 *
 * Future: implement native frame diff worklet for true pixel-level
 * motion detection as a gate before ML Kit.
 */

const FRAME_SKIP = 10;
let frameCount = 0;

export function shouldProcessFrame(): boolean {
  frameCount++;
  if (frameCount >= FRAME_SKIP) {
    frameCount = 0;
    return true;
  }
  return false;
}

export function resetMotionDetector(): void {
  frameCount = 0;
}
