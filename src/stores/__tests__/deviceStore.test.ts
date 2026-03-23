import { useDeviceStore } from '../deviceStore';

describe('DeviceStore', () => {
  beforeEach(() => {
    useDeviceStore.setState({
      role: null,
      deviceId: null,
      devices: [],
    });
  });

  test('initial state has no role', () => {
    const state = useDeviceStore.getState();
    expect(state.role).toBeNull();
    expect(state.deviceId).toBeNull();
  });

  test('setRole updates role', () => {
    useDeviceStore.getState().setRole('camera');
    expect(useDeviceStore.getState().role).toBe('camera');
  });

  test('setDeviceId updates deviceId', () => {
    useDeviceStore.getState().setDeviceId('dev-123');
    expect(useDeviceStore.getState().deviceId).toBe('dev-123');
  });

  test('setDevices updates devices list', () => {
    const devices = [
      {
        id: 'd1',
        userId: 'u1',
        name: 'Cam 1',
        role: 'camera' as const,
        mode: 'security' as const,
        status: 'online' as const,
        lastSeen: new Date(),
        settings: {
          motionSensitivity: 0.5,
          soundSensitivity: 0.5,
          personSensitivity: 0.5,
          recordingDurationSec: 10,
          videoQuality: 'medium' as const,
        },
      },
    ];
    useDeviceStore.getState().setDevices(devices);
    expect(useDeviceStore.getState().devices).toHaveLength(1);
    expect(useDeviceStore.getState().devices[0].name).toBe('Cam 1');
  });
});
