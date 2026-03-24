import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';

export async function requestNotificationPermission(): Promise<boolean> {
  const status = await messaging().requestPermission();
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
}

export async function registerFCMToken(
  userId: string,
  deviceId: string,
): Promise<void> {
  const token = await messaging().getToken();
  await firestore()
    .collection('users')
    .doc(userId)
    .set(
      { fcmTokens: { [deviceId]: token } },
      { merge: true },
    );
}

export function onNotificationReceived(
  callback: (message: any) => void,
): () => void {
  return messaging().onMessage(callback);
}
