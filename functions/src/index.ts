import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

initializeApp();

export const onEventCreated = onDocumentCreated('events/{eventId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const data = snapshot.data();
  const { userId, type, confidence, soundClass, deviceId } = data;
  if (!userId) return;

  const db = getFirestore();

  // Look up user's FCM tokens
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  const fcmTokens: Record<string, string> = userData?.fcmTokens ?? {};

  const tokens = Object.values(fcmTokens).filter(Boolean);
  if (tokens.length === 0) return;

  // Build notification
  const title = type === 'sound'
    ? `Sound detected: ${soundClass ?? 'unknown'}`
    : `${(type as string).charAt(0).toUpperCase() + (type as string).slice(1)} detected`;

  const body = `Confidence: ${Math.round(confidence * 100)}% — Device: ${deviceId}`;

  const messaging = getMessaging();
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: {
      eventId: snapshot.id,
      type: String(type),
      deviceId: String(deviceId),
    },
    android: {
      priority: 'high' as const,
    },
  });

  // Clean up invalid tokens
  const invalidTokens: string[] = [];
  response.responses.forEach((res, idx) => {
    if (res.error?.code === 'messaging/registration-token-not-registered') {
      invalidTokens.push(tokens[idx]);
    }
  });

  if (invalidTokens.length > 0) {
    const { FieldValue } = await import('firebase-admin/firestore');
    const updates: Record<string, any> = {};
    for (const [key, val] of Object.entries(fcmTokens)) {
      if (invalidTokens.includes(val)) {
        updates[`fcmTokens.${key}`] = FieldValue.delete();
      }
    }
    if (Object.keys(updates).length > 0) {
      await db.collection('users').doc(userId).update(updates);
    }
  }

  console.log(`Sent ${response.successCount} notifications for event ${snapshot.id}`);
});
