import { DetectionMode, ModeConfig } from '@/types';

export const DETECTION_MODES: Record<DetectionMode, ModeConfig> = {
  security: {
    person: 'alert',
    motion: 'alert',
    baby_cry: 'notify',
    dog_bark: 'notify',
    glass_break: 'alert',
    cat_meow: 'ignore',
  },
  baby: {
    person: 'notify',
    motion: 'record',
    baby_cry: 'alert',
    dog_bark: 'ignore',
    glass_break: 'alert',
    cat_meow: 'ignore',
  },
  pet: {
    person: 'ignore',
    motion: 'notify',
    baby_cry: 'ignore',
    dog_bark: 'alert',
    glass_break: 'alert',
    cat_meow: 'notify',
  },
  custom: {
    person: 'notify',
    motion: 'notify',
    baby_cry: 'notify',
    dog_bark: 'notify',
    glass_break: 'alert',
    cat_meow: 'notify',
  },
};
