import { SoundClass, DetectionResult } from '@/types';
import { YAMNET_CLASS_MAP } from '@/config/yamnetLabels';

/**
 * Sound classification using YAMNet TFLite model.
 *
 * Processes audio buffers through YAMNet and maps high-confidence
 * predictions to our defined sound classes (baby_cry, dog_bark,
 * glass_break, cat_meow).
 *
 * The classifyYamnetOutput function takes the raw score array from
 * YAMNet inference and returns a DetectionResult if any of our
 * target sound classes exceed the threshold.
 */

export function classifyYamnetOutput(
  scores: Float32Array,
  threshold: number,
): DetectionResult | null {
  let bestClass: SoundClass | null = null;
  let bestScore = 0;

  for (const [indexStr, soundClass] of Object.entries(YAMNET_CLASS_MAP)) {
    const index = Number(indexStr);
    if (index >= scores.length) continue;

    const score = scores[index];
    if (score > threshold && score > bestScore) {
      bestScore = score;
      bestClass = soundClass;
    }
  }

  if (bestClass === null) return null;

  return {
    type: 'sound',
    confidence: bestScore,
    soundClass: bestClass,
    timestamp: Date.now(),
  };
}
