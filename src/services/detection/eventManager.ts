import { DetectionMode, DetectionResult, AlertLevel, EventType, SoundClass } from '@/types';
import { DETECTION_MODES } from '@/config/detectionModes';

const DEBOUNCE_MS = 30_000; // 30 seconds

export interface ManagedEvent {
  type: EventType;
  soundClass: SoundClass | null;
  confidence: number;
  alertLevel: AlertLevel;
  timestamp: number;
}

type EventHandler = (event: ManagedEvent) => void;

export class EventManager {
  private lastEventTimes: Map<string, number> = new Map();
  private handlers: EventHandler[] = [];

  onEvent(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  removeHandler(handler: EventHandler): void {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  handleDetection(result: DetectionResult, mode: DetectionMode): void {
    const alertLevel = this.getAlertLevel(result, mode);
    if (alertLevel === 'ignore') return;

    const debounceKey = this.getDebounceKey(result);
    const lastTime = this.lastEventTimes.get(debounceKey) ?? 0;

    if (result.timestamp - lastTime < DEBOUNCE_MS) return;

    this.lastEventTimes.set(debounceKey, result.timestamp);

    const event: ManagedEvent = {
      type: result.type,
      soundClass: result.soundClass,
      confidence: result.confidence,
      alertLevel,
      timestamp: result.timestamp,
    };

    for (const handler of this.handlers) {
      handler(event);
    }
  }

  destroy(): void {
    this.handlers = [];
    this.lastEventTimes.clear();
  }

  private getAlertLevel(result: DetectionResult, mode: DetectionMode): AlertLevel {
    const config = DETECTION_MODES[mode];
    if (result.type === 'sound' && result.soundClass) {
      return config[result.soundClass] ?? 'ignore';
    }
    if (result.type === 'person') return config.person;
    if (result.type === 'motion') return config.motion;
    return 'ignore';
  }

  private getDebounceKey(result: DetectionResult): string {
    if (result.type === 'sound' && result.soundClass) {
      return `sound:${result.soundClass}`;
    }
    return result.type;
  }
}
