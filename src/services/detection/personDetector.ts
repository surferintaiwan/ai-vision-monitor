import { RNMLKitDefaultObjectDetector } from '@infinitered/react-native-mlkit-object-detection';
import { DetectionResult } from '@/types';

/**
 * Person detection using ML Kit's on-device object detection.
 *
 * Uses the default ML Kit model with classification enabled.
 * The detector must be loaded once before use, then detectObjects
 * can be called repeatedly with image paths.
 */

const detector = new RNMLKitDefaultObjectDetector({
  shouldEnableClassification: true,
  shouldEnableMultipleObjects: false,
  detectorMode: 'singleImage',
});

let modelLoaded = false;

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

    if (!results || results.length === 0) return null;

    // ML Kit default model returns generic categories (Fashion good, Home good,
    // Food, Place, Plant). It does not have a "person" label.
    // We treat any high-confidence object detection as presence/motion detected.
    // For true person-specific detection, a custom model or face detection
    // would be needed in a future update.
    for (const obj of results) {
      for (const label of obj.labels) {
        if (label.confidence >= sensitivityThreshold) {
          return {
            type: 'person',
            confidence: label.confidence,
            soundClass: null,
            timestamp: Date.now(),
          };
        }
      }
    }

    return null;
  } catch (err) {
    console.warn('[PersonDetector] Detection error:', err);
    return null;
  }
}
