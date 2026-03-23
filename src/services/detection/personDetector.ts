import { DetectionResult } from '@/types';

/**
 * Person detection using ML Kit's on-device object detection.
 *
 * Uses @infinitered/react-native-mlkit-object-detection to detect
 * people in camera frame snapshots. Called only when the motion gate
 * (shouldProcessFrame) allows it, to save CPU on old devices.
 */

let ObjectDetection: any = null;

async function getDetector() {
  if (!ObjectDetection) {
    const mod = await import('@infinitered/react-native-mlkit-object-detection');
    ObjectDetection = mod;
  }
  return ObjectDetection;
}

export async function detectPersonInImage(
  imagePath: string,
  sensitivityThreshold: number = 0.5,
): Promise<DetectionResult | null> {
  try {
    const mlkit = await getDetector();
    const detector = mlkit.useObjectDetection?.defaultDetector
      ?? mlkit.ObjectDetectionDefaultModel;

    if (!detector) {
      console.warn('ML Kit object detection not available');
      return null;
    }

    const results = await detector.detect(`file://${imagePath}`);

    if (!results || !Array.isArray(results)) return null;

    for (const obj of results) {
      const labels = obj.labels ?? [];
      for (const label of labels) {
        const text = (label.text ?? label.label ?? '').toLowerCase();
        const confidence = label.confidence ?? label.score ?? 0;
        if (text === 'person' && confidence >= sensitivityThreshold) {
          return {
            type: 'person',
            confidence,
            soundClass: null,
            timestamp: Date.now(),
          };
        }
      }
    }

    return null;
  } catch (err) {
    console.warn('ML Kit detection error:', err);
    return null;
  }
}
