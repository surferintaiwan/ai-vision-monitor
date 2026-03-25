import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { Role, DetectionMode, Device, DeviceSettings, DEFAULT_DEVICE_SETTINGS } from '@/types';

const devicesCollection = () => firestore().collection('devices');

export async function registerDevice(
  deviceId: string,
  userId: string,
  name: string,
  role: Role,
): Promise<void> {
  await devicesCollection().doc(deviceId).set({
    userId,
    name,
    role,
    mode: 'security' as DetectionMode,
    status: 'online',
    lastSeen: firestore.FieldValue.serverTimestamp(),
    settings: DEFAULT_DEVICE_SETTINGS,
  });
}

export async function updateDeviceStatus(
  deviceId: string,
  status: 'online' | 'offline',
): Promise<void> {
  await devicesCollection().doc(deviceId).update({
    status,
    lastSeen: firestore.FieldValue.serverTimestamp(),
  });
}

export async function updateDeviceName(
  deviceId: string,
  name: string,
): Promise<void> {
  await devicesCollection().doc(deviceId).update({ name });
}

export async function updateDeviceMode(
  deviceId: string,
  mode: DetectionMode,
): Promise<void> {
  await devicesCollection().doc(deviceId).update({ mode });
}

export async function updateDeviceSettings(
  deviceId: string,
  settings: Partial<DeviceSettings>,
): Promise<void> {
  await devicesCollection().doc(deviceId).update({
    settings: { ...settings },
  });
}

export async function getUserDevices(userId: string): Promise<Device[]> {
  const snapshot = await devicesCollection()
    .where('userId', '==', userId)
    .get();

  return snapshot.docs.map(docToDevice);
}

export async function findExistingDevice(
  userId: string,
  role: Role,
): Promise<Device | null> {
  const snapshot = await devicesCollection()
    .where('userId', '==', userId)
    .where('role', '==', role)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return docToDevice(snapshot.docs[0]);
}

function docToDevice(
  doc: FirebaseFirestoreTypes.QueryDocumentSnapshot,
): Device {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId,
    name: data.name,
    role: data.role,
    mode: data.mode,
    status: data.status,
    lastSeen: data.lastSeen?.toDate?.() ?? new Date(),
    settings: { ...DEFAULT_DEVICE_SETTINGS, ...data.settings },
  };
}
