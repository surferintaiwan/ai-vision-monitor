import { RNMLKitDefaultObjectDetector } from '@infinitered/react-native-mlkit-object-detection';
import { DetectionResult } from '@/types';

/**
 * Object/presence detection using ML Kit's on-device object detection.
 *
 * Uses the default ML Kit model. Since the default model often returns
 * empty labels, we detect motion by comparing bounding boxes between frames.
 */

const detector = new RNMLKitDefaultObjectDetector({
  shouldEnableClassification: true,
  shouldEnableMultipleObjects: false,
  detectorMode: 'singleImage',
});

let modelLoaded = false;

// Track previous frame for motion comparison
let prevBox: { x: number; y: number; w: number; h: number } | null = null;
let stableFrameCount = 0;
const MOTION_THRESHOLD = 60; // px — bounding box center must move this much to count as motion
const STABLE_FRAMES_REQUIRED = 2; // must be stable first before motion triggers

async function ensureModelLoaded(): Promise<void> {
  if (modelLoaded) return;
  console.log('[PersonDetector] Loading ML Kit default model...');
  await detector.load();
  modelLoaded = true;
  console.log('[PersonDetector] Model loaded');
}

export async function detectPersonInImage(
  imagePath: string,
  sensitivityThreshold: number = 0.5,
): Promise<DetectionResult | null> {
  try {
    await ensureModelLoaded();

    const uri = imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`;
    const results = await detector.detectObjects(uri);

    if (!results || results.length === 0) {
      prevBox = null;
      stableFrameCount = 0;
      return null;
    }

    // Check for labeled detections first (high confidence)
    for (const obj of results) {
      for (const label of obj.labels) {
        if (label.confidence >= sensitivityThreshold) {
          prevBox = null;
          stableFrameCount = 0;
          return {
            type: 'person',
            confidence: label.confidence,
            soundClass: null,
            timestamp: Date.now(),
          };
        }
      }
    }

    // No labels — use bounding box motion detection on first detected object
    const obj = results[0];
    const currBox = {
      x: obj.frame?.origin?.x ?? 0,
      y: obj.frame?.origin?.y ?? 0,
      w: obj.frame?.size?.x ?? 0,
      h: obj.frame?.size?.y ?? 0,
    };

    if (!prevBox) {
      prevBox = currBox;
      stableFrameCount = 0;
      return null;
    }

    // Use center point movement — more stable than edge jitter
    const prevCx = prevBox.x + prevBox.w / 2;
    const prevCy = prevBox.y + prevBox.h / 2;
    const currCx = currBox.x + currBox.w / 2;
    const currCy = currBox.y + currBox.h / 2;
    const centerDist = Math.sqrt((prevCx - currCx) ** 2 + (prevCy - currCy) ** 2);

    console.log(`[PersonDetector] Center dist=${Math.round(centerDist)} stable=${stableFrameCount}`);

    prevBox = currBox;

    if (centerDist < MOTION_THRESHOLD) {
      // Frame is stable
      stableFrameCount++;
      return null;
    }

    // Significant motion detected — but only if we had stable frames before
    // (this prevents initial jitter from triggering)
    if (stableFrameCount >= STABLE_FRAMES_REQUIRED) {
      stableFrameCount = 0;
      return {
        type: 'person',
        confidence: 0.6,
        soundClass: null,
        timestamp: Date.now(),
      };
    }

    stableFrameCount = 0;
    return null;
  } catch (err) {
    console.warn('[PersonDetector] Detection error:', err);
    return null;
  }
}
