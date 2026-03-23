import { EventManager } from '../eventManager';

describe('EventManager', () => {
  let manager: EventManager;

  beforeEach(() => {
    manager = new EventManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should emit event for person detection in security mode', () => {
    const handler = jest.fn();
    manager.onEvent(handler);

    manager.handleDetection(
      { type: 'person', confidence: 0.9, soundClass: null, timestamp: Date.now() },
      'security',
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'person', alertLevel: 'alert' }),
    );
  });

  it('should debounce same event type within 30 seconds', () => {
    const handler = jest.fn();
    manager.onEvent(handler);

    const now = Date.now();
    manager.handleDetection(
      { type: 'person', confidence: 0.9, soundClass: null, timestamp: now },
      'security',
    );
    manager.handleDetection(
      { type: 'person', confidence: 0.95, soundClass: null, timestamp: now + 5000 },
      'security',
    );

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should allow same event type after debounce window', () => {
    const handler = jest.fn();
    manager.onEvent(handler);

    const now = Date.now();
    manager.handleDetection(
      { type: 'person', confidence: 0.9, soundClass: null, timestamp: now },
      'security',
    );
    manager.handleDetection(
      { type: 'person', confidence: 0.95, soundClass: null, timestamp: now + 31000 },
      'security',
    );

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should ignore detection types set to ignore in mode', () => {
    const handler = jest.fn();
    manager.onEvent(handler);

    manager.handleDetection(
      { type: 'sound', confidence: 0.9, soundClass: 'cat_meow', timestamp: Date.now() },
      'security',
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle different sound classes independently for debounce', () => {
    const handler = jest.fn();
    manager.onEvent(handler);

    const now = Date.now();
    manager.handleDetection(
      { type: 'sound', confidence: 0.9, soundClass: 'dog_bark', timestamp: now },
      'security',
    );
    manager.handleDetection(
      { type: 'sound', confidence: 0.9, soundClass: 'glass_break', timestamp: now + 1000 },
      'security',
    );

    expect(handler).toHaveBeenCalledTimes(2);
  });
});
