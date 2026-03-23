import { useDetectionStore } from '../detectionStore';

describe('detectionStore', () => {
  beforeEach(() => {
    useDetectionStore.getState().reset();
  });

  it('should initialize with detection not running', () => {
    const state = useDetectionStore.getState();
    expect(state.isDetecting).toBe(false);
    expect(state.mode).toBe('security');
  });

  it('should start and stop detection', () => {
    useDetectionStore.getState().setDetecting(true);
    expect(useDetectionStore.getState().isDetecting).toBe(true);

    useDetectionStore.getState().setDetecting(false);
    expect(useDetectionStore.getState().isDetecting).toBe(false);
  });

  it('should change mode', () => {
    useDetectionStore.getState().setMode('baby');
    expect(useDetectionStore.getState().mode).toBe('baby');
  });

  it('should track last detection', () => {
    const result = {
      type: 'person' as const,
      confidence: 0.92,
      soundClass: null,
      timestamp: Date.now(),
    };
    useDetectionStore.getState().setLastDetection(result);
    expect(useDetectionStore.getState().lastDetection).toEqual(result);
  });

  it('should increment detection count', () => {
    useDetectionStore.getState().incrementCount();
    useDetectionStore.getState().incrementCount();
    expect(useDetectionStore.getState().detectionCount).toBe(2);
  });
});
