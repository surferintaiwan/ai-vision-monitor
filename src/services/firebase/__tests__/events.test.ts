jest.mock('@react-native-firebase/firestore', () => {
  const addMock = jest.fn().mockResolvedValue({ id: 'event_123' });
  const whereMock = jest.fn().mockReturnThis();
  const orderByMock = jest.fn().mockReturnThis();
  const limitMock = jest.fn().mockReturnThis();
  const getMock = jest.fn().mockResolvedValue({ docs: [] });

  const collectionMock = jest.fn(() => ({
    add: addMock,
    where: whereMock,
    orderBy: orderByMock,
    limit: limitMock,
    get: getMock,
  }));

  const firestoreFn = () => ({ collection: collectionMock });
  firestoreFn.FieldValue = {
    serverTimestamp: jest.fn(() => 'mock-timestamp'),
  };

  return { __esModule: true, default: firestoreFn };
});

import { createEvent, getDeviceEvents } from '../events';

describe('events service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create an event and return its id', async () => {
    const id = await createEvent({
      deviceId: 'device_1',
      userId: 'user_1',
      type: 'person',
      soundClass: null,
      confidence: 0.95,
      clipPath: null,
      clipDurationSec: 0,
    });
    expect(id).toBe('event_123');
  });

  it('should get device events', async () => {
    const events = await getDeviceEvents('device_1');
    expect(events).toEqual([]);
  });
});
