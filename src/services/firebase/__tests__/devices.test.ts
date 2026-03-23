import firestore from '@react-native-firebase/firestore';

jest.mock('@react-native-firebase/firestore', () => {
  const mockSet = jest.fn(() => Promise.resolve());
  const mockUpdate = jest.fn(() => Promise.resolve());
  const mockGet = jest.fn(() =>
    Promise.resolve({
      docs: [
        {
          id: 'device-1',
          data: () => ({
            userId: 'user-1',
            name: 'Living Room',
            role: 'camera',
            mode: 'security',
            status: 'online',
            lastSeen: { toDate: () => new Date() },
            settings: {},
          }),
        },
      ],
    }),
  );
  const mockWhere = jest.fn(() => ({ get: mockGet }));
  const mockDoc = jest.fn(() => ({ set: mockSet, update: mockUpdate }));

  const mockFirestore = jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: mockDoc,
      where: mockWhere,
    })),
  }));
  mockFirestore.FieldValue = {
    serverTimestamp: jest.fn(() => 'mock-timestamp'),
  };

  return {
    __esModule: true,
    default: mockFirestore,
    FieldValue: {
      serverTimestamp: jest.fn(() => 'mock-timestamp'),
    },
  };
});

import {
  registerDevice,
  updateDeviceStatus,
  getUserDevices,
} from '../devices';

describe('Device Service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('registerDevice creates a device document', async () => {
    await registerDevice('device-1', 'user-1', 'My Camera', 'camera');
    const collection = firestore().collection('devices');
    expect(collection.doc).toHaveBeenCalledWith('device-1');
  });

  test('updateDeviceStatus updates status and lastSeen', async () => {
    await updateDeviceStatus('device-1', 'online');
    const collection = firestore().collection('devices');
    expect(collection.doc).toHaveBeenCalledWith('device-1');
  });

  test('getUserDevices returns devices for a user', async () => {
    const devices = await getUserDevices('user-1');
    expect(devices).toHaveLength(1);
    expect(devices[0].name).toBe('Living Room');
  });
});
