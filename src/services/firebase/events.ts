import firestore from '@react-native-firebase/firestore';
import { DetectionEvent, EventType } from '@/types';

const eventsCollection = () => firestore().collection('events');

export interface CreateEventInput {
  deviceId: string;
  userId: string;
  type: EventType;
  soundClass: string | null;
  confidence: number;
  clipPath: string | null;
  clipDurationSec: number;
}

export async function createEvent(input: CreateEventInput): Promise<string> {
  const ref = await eventsCollection().add({
    ...input,
    timestamp: firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function getDeviceEvents(
  deviceId: string,
  limitCount: number = 50,
): Promise<DetectionEvent[]> {
  const snapshot = await eventsCollection()
    .where('deviceId', '==', deviceId)
    .orderBy('timestamp', 'desc')
    .limit(limitCount)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      deviceId: data.deviceId,
      userId: data.userId,
      type: data.type,
      soundClass: data.soundClass,
      confidence: data.confidence,
      timestamp: data.timestamp?.toDate?.() ?? new Date(),
      clipPath: data.clipPath,
      clipDurationSec: data.clipDurationSec,
    };
  });
}
