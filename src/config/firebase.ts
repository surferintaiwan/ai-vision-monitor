import firebase from '@react-native-firebase/app';

// Firebase is auto-initialized from google-services.json (Android)
// and GoogleService-Info.plist (iOS). No manual config needed.
// This file serves as the central import point and validates initialization.

export function ensureFirebaseInitialized(): void {
  if (!firebase.apps.length) {
    throw new Error(
      'Firebase not initialized. Ensure google-services.json (Android) ' +
      'and GoogleService-Info.plist (iOS) are properly configured.',
    );
  }
}

export default firebase;
