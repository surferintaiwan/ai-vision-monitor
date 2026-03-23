/**
 * Maps YAMNet class indices to our app's sound classes.
 * YAMNet has 521 classes; we only care about a handful.
 *
 * Class indices from the YAMNet label map:
 * https://github.com/tensorflow/models/blob/master/research/audioset/yamnet/yamnet_class_map.csv
 */

import { SoundClass } from '@/types';

export const YAMNET_CLASS_MAP: Record<number, SoundClass> = {
  // Baby cry / infant cry
  20: 'baby_cry',
  // Dog bark
  67: 'dog_bark',
  // Glass breaking / shatter
  441: 'glass_break',
  // Cat meow
  76: 'cat_meow',
};

export const YAMNET_SAMPLE_RATE = 16000;
export const YAMNET_FRAME_LENGTH = 15600; // ~0.975 seconds at 16kHz
