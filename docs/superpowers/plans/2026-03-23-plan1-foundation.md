# Plan 1: Foundation — Project Setup, Auth, Navigation & Camera Preview

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an installable React Native app where users can log in with Google/Apple, select a role (camera or viewer), and see a live camera preview on the camera role.

**Architecture:** Single React Native app (Expo bare workflow) with Firebase backend for auth and device registration. Zustand for state management, React Navigation for routing. Camera access via react-native-vision-camera.

**Tech Stack:** React Native, TypeScript, Expo (bare workflow), Firebase Auth, Firestore, Zustand, React Navigation, react-native-vision-camera

---

## File Structure

```
ai-vision-monitor/
├── src/
│   ├── config/
│   │   ├── firebase.ts              # Firebase app initialization
│   │   └── webrtc.ts                # STUN/TURN configuration (stub for Plan 3)
│   ├── services/
│   │   └── firebase/
│   │       ├── auth.ts              # Sign in/out, auth state listener
│   │       └── devices.ts           # Device registration and status in Firestore
│   ├── stores/
│   │   ├── authStore.ts             # Auth state (user, loading, error)
│   │   └── deviceStore.ts           # Device state (role, deviceId, devices list)
│   ├── screens/
│   │   ├── LoginScreen.tsx          # Google/Apple sign-in buttons
│   │   ├── RoleSelectScreen.tsx     # Pick camera or viewer role
│   │   ├── camera/
│   │   │   └── CameraPreviewScreen.tsx  # Live camera preview with status overlay
│   │   └── viewer/
│   │       └── DeviceListScreen.tsx     # List paired cameras (stub for Plan 3)
│   ├── navigation/
│   │   └── RootNavigator.tsx        # Auth-gated navigation stack
│   ├── components/
│   │   └── LoadingScreen.tsx        # Full-screen loading indicator
│   └── types/
│       └── index.ts                 # Shared TypeScript types
├── firestore.rules                  # Firestore security rules
├── app.json
├── tsconfig.json
├── jest.config.js
├── babel.config.js
└── package.json
```

---

### Task 1: Project Initialization

**Files:**
- Create: `package.json`, `tsconfig.json`, `babel.config.js`, `jest.config.js`, `app.json`, `.gitignore`

- [ ] **Step 1: Create Expo bare workflow project**

```bash
npx create-expo-app ai-vision-monitor --template expo-template-bare-minimum
cd ai-vision-monitor
```

If the project directory already exists (from the git repo), run inside it:

```bash
npx create-expo-app . --template expo-template-bare-minimum
```

- [ ] **Step 2: Install core dependencies**

```bash
npx expo install react-native-vision-camera \
  @react-native-firebase/app \
  @react-native-firebase/auth \
  @react-native-firebase/firestore \
  @react-native-firebase/messaging \
  @react-navigation/native \
  @react-navigation/native-stack \
  react-native-screens \
  react-native-safe-area-context \
  zustand \
  react-native-fs
```

```bash
npm install --save-dev @types/react @types/react-native typescript jest @testing-library/react-native @testing-library/jest-native
```

- [ ] **Step 3: Configure TypeScript**

Ensure `tsconfig.json` has strict mode and path aliases:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "App.tsx"]
}
```

- [ ] **Step 4: Configure Jest**

Create `jest.config.js`:

```js
module.exports = {
  preset: 'react-native',
  setupFilesAfterSetup: ['@testing-library/jest-native/extend-expect'], // Note: key name is setupFilesAfterSetup
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-firebase|expo|@expo|react-native-vision-camera|react-native-screens|react-native-safe-area-context|zustand)/)',
  ],
};
```

- [ ] **Step 5: Update .gitignore**

Append to the existing `.gitignore`:

```
node_modules/
.expo/
ios/Pods/
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
web-build/
.superpowers/
```

- [ ] **Step 6: Verify project builds**

```bash
npx expo run:ios
# or
npx expo run:android
```

Expected: App launches with the default Expo splash screen.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize Expo bare workflow project with dependencies"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Define shared types**

Create `src/types/index.ts`:

```typescript
export type Role = 'camera' | 'viewer';

export type DetectionMode = 'security' | 'baby' | 'pet' | 'custom';

export type DeviceStatus = 'online' | 'offline';

export type EventType = 'person' | 'motion' | 'sound';

export type AlertLevel = 'alert' | 'notify' | 'record' | 'ignore';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface Device {
  id: string;
  userId: string;
  name: string;
  role: Role;
  mode: DetectionMode;
  status: DeviceStatus;
  lastSeen: Date;
  settings: DeviceSettings;
}

export interface DeviceSettings {
  motionSensitivity: number;   // 0-1
  soundSensitivity: number;    // 0-1
  personSensitivity: number;   // 0-1
  recordingDurationSec: number; // seconds after trigger (default 10)
  videoQuality: 'low' | 'medium' | 'high';
}

export interface DetectionEvent {
  id: string;
  deviceId: string;
  userId: string;
  type: EventType;
  soundClass: string | null;
  confidence: number;
  timestamp: Date;
  clipPath: string | null;
  clipDurationSec: number;
}

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  motionSensitivity: 0.5,
  soundSensitivity: 0.5,
  personSensitivity: 0.5,
  recordingDurationSec: 10,
  videoQuality: 'medium',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared TypeScript type definitions"
```

---

### Task 3: Firebase Configuration

**Files:**
- Create: `src/config/firebase.ts`, `src/config/webrtc.ts`, `firestore.rules`

**Prerequisites:** The developer must create a Firebase project at https://console.firebase.google.com, enable Authentication (Google and Apple providers), enable Firestore, and download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) into the respective native project directories.

- [ ] **Step 1: Create Firebase config**

Create `src/config/firebase.ts`:

```typescript
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
```

- [ ] **Step 2: Create WebRTC config stub**

Create `src/config/webrtc.ts`:

```typescript
export interface WebRTCConfig {
  stunServers: string[];
  turnServers: TurnServer[];
}

export interface TurnServer {
  urls: string;
  username: string;
  credential: string;
}

// Default configuration — users can override via settings
export const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
  stunServers: [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
  ],
  turnServers: [
    // Cloudflare Calls TURN — replace with your credentials
    // See: https://developers.cloudflare.com/calls/turn/
    {
      urls: 'turn:turn.cloudflare.com:3478',
      username: '',
      credential: '',
    },
  ],
};
```

- [ ] **Step 3: Create Firestore security rules**

Create `firestore.rules`:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /devices/{deviceId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;
    }

    match /sessions/{sessionId} {
      allow read, write: if request.auth != null;
    }

    match /sessions/{sessionId}/candidates/{candidateId} {
      allow read, write: if request.auth != null;
    }

    match /events/{eventId} {
      allow read: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/config/firebase.ts src/config/webrtc.ts firestore.rules
git commit -m "feat: add Firebase and WebRTC configuration"
```

---

### Task 4: Auth Service

**Files:**
- Create: `src/services/firebase/auth.ts`
- Test: `src/services/firebase/__tests__/auth.test.ts`

- [ ] **Step 1: Write tests for auth service**

Create `src/services/firebase/__tests__/auth.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react-native';
import auth from '@react-native-firebase/auth';

// Mock Firebase Auth
jest.mock('@react-native-firebase/auth', () => {
  const mockSignOut = jest.fn(() => Promise.resolve());
  const mockOnAuthStateChanged = jest.fn();
  const mockGoogleSignIn = jest.fn();

  return {
    __esModule: true,
    default: jest.fn(() => ({
      signOut: mockSignOut,
      onAuthStateChanged: mockOnAuthStateChanged,
      signInWithCredential: jest.fn(() =>
        Promise.resolve({
          user: { uid: 'test-uid', email: 'test@test.com', displayName: 'Test' },
        }),
      ),
    })),
    GoogleAuthProvider: {
      credential: jest.fn(() => 'mock-credential'),
    },
    AppleAuthProvider: {
      credential: jest.fn(() => 'mock-credential'),
    },
  };
});

import { signOut, onAuthStateChange } from '../auth';

describe('Auth Service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('signOut calls firebase auth signOut', async () => {
    await signOut();
    expect(auth().signOut).toHaveBeenCalled();
  });

  test('onAuthStateChange subscribes to auth changes', () => {
    const callback = jest.fn();
    onAuthStateChange(callback);
    expect(auth().onAuthStateChanged).toHaveBeenCalledWith(expect.any(Function));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/services/firebase/__tests__/auth.test.ts --no-cache
```

Expected: FAIL — module `../auth` not found.

- [ ] **Step 3: Implement auth service**

Create `src/services/firebase/auth.ts`:

```typescript
import auth, {
  FirebaseAuthTypes,
} from '@react-native-firebase/auth';

export type AuthUser = FirebaseAuthTypes.User | null;
export type AuthUnsubscribe = () => void;

export function onAuthStateChange(
  callback: (user: AuthUser) => void,
): AuthUnsubscribe {
  return auth().onAuthStateChanged(callback);
}

export async function signInWithGoogle(idToken: string): Promise<AuthUser> {
  const credential = auth.GoogleAuthProvider.credential(idToken);
  const result = await auth().signInWithCredential(credential);
  return result.user;
}

export async function signInWithApple(
  identityToken: string,
  nonce: string,
): Promise<AuthUser> {
  const credential = auth.AppleAuthProvider.credential(identityToken, nonce);
  const result = await auth().signInWithCredential(credential);
  return result.user;
}

export async function signOut(): Promise<void> {
  await auth().signOut();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/services/firebase/__tests__/auth.test.ts --no-cache
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/firebase/auth.ts src/services/firebase/__tests__/auth.test.ts
git commit -m "feat: add Firebase auth service with Google/Apple sign-in"
```

---

### Task 5: Device Service

**Files:**
- Create: `src/services/firebase/devices.ts`
- Test: `src/services/firebase/__tests__/devices.test.ts`

- [ ] **Step 1: Write tests for device service**

Create `src/services/firebase/__tests__/devices.test.ts`:

```typescript
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

  return {
    __esModule: true,
    default: jest.fn(() => ({
      collection: jest.fn(() => ({
        doc: mockDoc,
        where: mockWhere,
      })),
    })),
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/services/firebase/__tests__/devices.test.ts --no-cache
```

Expected: FAIL — module `../devices` not found.

- [ ] **Step 3: Implement device service**

Create `src/services/firebase/devices.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/services/firebase/__tests__/devices.test.ts --no-cache
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/firebase/devices.ts src/services/firebase/__tests__/devices.test.ts
git commit -m "feat: add Firestore device registration and query service"
```

---

### Task 6: Auth Store (Zustand)

**Files:**
- Create: `src/stores/authStore.ts`
- Test: `src/stores/__tests__/authStore.test.ts`

- [ ] **Step 1: Write tests for auth store**

Create `src/stores/__tests__/authStore.test.ts`:

```typescript
jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    signOut: jest.fn(() => Promise.resolve()),
    onAuthStateChanged: jest.fn(),
    signInWithCredential: jest.fn(() =>
      Promise.resolve({ user: { uid: 'u1', email: 'a@b.com', displayName: 'A' } }),
    ),
  })),
  GoogleAuthProvider: { credential: jest.fn(() => 'cred') },
  AppleAuthProvider: { credential: jest.fn(() => 'cred') },
}));

import { useAuthStore } from '../authStore';

describe('AuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      loading: true,
      error: null,
    });
  });

  test('initial state has no user and is loading', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.loading).toBe(true);
  });

  test('setUser updates user and stops loading', () => {
    useAuthStore.getState().setUser({ uid: 'u1', email: 'a@b.com', displayName: 'A' });
    const state = useAuthStore.getState();
    expect(state.user?.uid).toBe('u1');
    expect(state.loading).toBe(false);
  });

  test('clearUser resets user', () => {
    useAuthStore.getState().setUser({ uid: 'u1', email: 'a@b.com', displayName: 'A' });
    useAuthStore.getState().clearUser();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/stores/__tests__/authStore.test.ts --no-cache
```

Expected: FAIL — module `../authStore` not found.

- [ ] **Step 3: Implement auth store**

Create `src/stores/authStore.ts`:

```typescript
import { create } from 'zustand';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  setUser: (user: User) => void;
  clearUser: () => void;
  setError: (error: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  setUser: (user) => set({ user, loading: false, error: null }),
  clearUser: () => set({ user: null, loading: false, error: null }),
  setError: (error) => set({ error, loading: false }),
  setLoading: (loading) => set({ loading }),
}));
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/stores/__tests__/authStore.test.ts --no-cache
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/authStore.ts src/stores/__tests__/authStore.test.ts
git commit -m "feat: add Zustand auth store"
```

---

### Task 7: Device Store (Zustand)

**Files:**
- Create: `src/stores/deviceStore.ts`
- Test: `src/stores/__tests__/deviceStore.test.ts`

- [ ] **Step 1: Write tests for device store**

Create `src/stores/__tests__/deviceStore.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/stores/__tests__/deviceStore.test.ts --no-cache
```

Expected: FAIL — module `../deviceStore` not found.

- [ ] **Step 3: Implement device store**

Create `src/stores/deviceStore.ts`:

```typescript
import { create } from 'zustand';
import { Role, Device } from '@/types';

interface DeviceState {
  role: Role | null;
  deviceId: string | null;
  devices: Device[];
  setRole: (role: Role) => void;
  setDeviceId: (id: string) => void;
  setDevices: (devices: Device[]) => void;
  clearDevice: () => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  role: null,
  deviceId: null,
  devices: [],
  setRole: (role) => set({ role }),
  setDeviceId: (id) => set({ deviceId: id }),
  setDevices: (devices) => set({ devices }),
  clearDevice: () => set({ role: null, deviceId: null, devices: [] }),
}));
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/stores/__tests__/deviceStore.test.ts --no-cache
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/deviceStore.ts src/stores/__tests__/deviceStore.test.ts
git commit -m "feat: add Zustand device store"
```

---

### Task 8: Loading Component

**Files:**
- Create: `src/components/LoadingScreen.tsx`

- [ ] **Step 1: Create LoadingScreen component**

Create `src/components/LoadingScreen.tsx`:

```tsx
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export function LoadingScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A90D9" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LoadingScreen.tsx
git commit -m "feat: add LoadingScreen component"
```

---

### Task 9: Login Screen

**Files:**
- Create: `src/screens/LoginScreen.tsx`

**Note:** Google Sign-In requires `@react-native-google-signin/google-signin` and Apple Sign-In requires `@invertase/react-native-apple-authentication`. Install them:

```bash
npm install @react-native-google-signin/google-signin @invertase/react-native-apple-authentication
```

- [ ] **Step 1: Create LoginScreen**

Create `src/screens/LoginScreen.tsx`:

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import { signInWithGoogle, signInWithApple } from '@/services/firebase/auth';
import { useAuthStore } from '@/stores/authStore';

// Configure Google Sign-In — REQUIRED: replace with your webClientId from Firebase Console
// Find it at: Firebase Console → Authentication → Sign-in method → Google → Web SDK configuration → Web client ID
const WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
if (WEB_CLIENT_ID.startsWith('YOUR_')) {
  console.warn('Google Sign-In: Replace YOUR_WEB_CLIENT_ID in LoginScreen.tsx with your Firebase web client ID');
}
GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });

export function LoginScreen(): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const setError = useAuthStore((s) => s.setError);

  async function handleGoogleSignIn() {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult.data?.idToken;
      if (!idToken) throw new Error('No ID token from Google Sign-In');
      await signInWithGoogle(idToken);
    } catch (err: any) {
      setError(err.message ?? 'Google sign-in failed');
      Alert.alert('Sign-In Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    try {
      setLoading(true);
      const appleResult = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });
      if (!appleResult.identityToken) {
        throw new Error('No identity token from Apple Sign-In');
      }
      await signInWithApple(appleResult.identityToken, appleResult.nonce);
    } catch (err: any) {
      setError(err.message ?? 'Apple sign-in failed');
      Alert.alert('Sign-In Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Vision Monitor</Text>
      <Text style={styles.subtitle}>
        Turn your old phone into a smart security camera
      </Text>

      <TouchableOpacity
        style={[styles.button, styles.googleButton]}
        onPress={handleGoogleSignIn}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.button, styles.appleButton]}
          onPress={handleAppleSignIn}
          disabled={loading}
        >
          <Text style={[styles.buttonText, styles.appleText]}>
            Sign in with Apple
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0b0',
    marginBottom: 48,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  appleButton: {
    backgroundColor: '#ffffff',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  appleText: {
    color: '#000000',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/LoginScreen.tsx
git commit -m "feat: add LoginScreen with Google/Apple sign-in"
```

---

### Task 10: Role Select Screen

**Files:**
- Create: `src/screens/RoleSelectScreen.tsx`

- [ ] **Step 1: Create RoleSelectScreen**

Create `src/screens/RoleSelectScreen.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDeviceStore } from '@/stores/deviceStore';
import { useAuthStore } from '@/stores/authStore';
import { registerDevice } from '@/services/firebase/devices';
import { Role } from '@/types';

function generateDeviceId(): string {
  return `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function RoleSelectScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const user = useAuthStore((s) => s.user);
  const setRole = useDeviceStore((s) => s.setRole);
  const setDeviceId = useDeviceStore((s) => s.setDeviceId);

  async function handleSelectRole(role: Role) {
    if (!user) return;

    const deviceId = generateDeviceId();
    const name = role === 'camera' ? 'New Camera' : 'Viewer';

    await registerDevice(deviceId, user.uid, name, role);
    setRole(role);
    setDeviceId(deviceId);

    if (role === 'camera') {
      navigation.replace('CameraPreview');
    } else {
      navigation.replace('DeviceList');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Mode</Text>
      <Text style={styles.subtitle}>
        What role should this device play?
      </Text>

      <TouchableOpacity
        style={[styles.card, styles.cameraCard]}
        onPress={() => handleSelectRole('camera')}
      >
        <Text style={styles.cardEmoji}>📷</Text>
        <Text style={styles.cardTitle}>Camera</Text>
        <Text style={styles.cardDesc}>
          Use this device as a security camera. It will capture video, detect
          events, and stream to your other devices.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, styles.viewerCard]}
        onPress={() => handleSelectRole('viewer')}
      >
        <Text style={styles.cardEmoji}>👁</Text>
        <Text style={styles.cardTitle}>Viewer</Text>
        <Text style={styles.cardDesc}>
          View live streams from your cameras, receive alerts, and review
          recorded events.
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#a0a0b0',
    marginBottom: 32,
  },
  card: {
    width: '100%',
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  cameraCard: {
    backgroundColor: 'rgba(74, 144, 217, 0.1)',
    borderColor: 'rgba(74, 144, 217, 0.3)',
  },
  viewerCard: {
    backgroundColor: 'rgba(80, 200, 120, 0.1)',
    borderColor: 'rgba(80, 200, 120, 0.3)',
  },
  cardEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    color: '#a0a0b0',
    lineHeight: 20,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/RoleSelectScreen.tsx
git commit -m "feat: add RoleSelectScreen with camera/viewer role selection"
```

---

### Task 11: Camera Preview Screen

**Files:**
- Create: `src/screens/camera/CameraPreviewScreen.tsx`

**Note:** `react-native-vision-camera` requires camera permissions. Add to `ios/Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>This app needs camera access to function as a security camera.</string>
<key>NSMicrophoneUsageDescription</key>
<string>This app needs microphone access to detect sounds.</string>
```

For Android, add to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

- [ ] **Step 1: Create CameraPreviewScreen**

Create `src/screens/camera/CameraPreviewScreen.tsx`:

```tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
} from 'react-native-vision-camera';
import { useDeviceStore } from '@/stores/deviceStore';
import { useAuthStore } from '@/stores/authStore';
import { updateDeviceStatus } from '@/services/firebase/devices';
import { signOut } from '@/services/firebase/auth';

export function CameraPreviewScreen(): React.JSX.Element {
  const device = useCameraDevice('back');
  const { hasPermission: hasCamPerm, requestPermission: requestCamPerm } =
    useCameraPermission();
  const { hasPermission: hasMicPerm, requestPermission: requestMicPerm } =
    useMicrophonePermission();

  const [isActive, setIsActive] = useState(true);
  const deviceId = useDeviceStore((s) => s.deviceId);
  const clearUser = useAuthStore((s) => s.clearUser);
  const clearDevice = useDeviceStore((s) => s.clearDevice);

  // Request permissions on mount
  useEffect(() => {
    if (!hasCamPerm) requestCamPerm();
    if (!hasMicPerm) requestMicPerm();
  }, [hasCamPerm, hasMicPerm, requestCamPerm, requestMicPerm]);

  // Update device status on mount/unmount
  useEffect(() => {
    if (deviceId) {
      updateDeviceStatus(deviceId, 'online');
    }
    return () => {
      if (deviceId) {
        updateDeviceStatus(deviceId, 'offline');
      }
    };
  }, [deviceId]);

  // Pause camera when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setIsActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  async function handleSignOut() {
    if (deviceId) {
      await updateDeviceStatus(deviceId, 'offline');
    }
    clearDevice();
    await signOut();
    clearUser();
  }

  if (!hasCamPerm || !hasMicPerm) {
    return (
      <View style={styles.container}>
        <Text style={styles.permText}>
          Camera and microphone permissions are required.
        </Text>
        <TouchableOpacity
          style={styles.permButton}
          onPress={() => {
            if (!hasCamPerm) requestCamPerm();
            if (!hasMicPerm) requestMicPerm();
          }}
        >
          <Text style={styles.permButtonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.permText}>No camera device found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        audio={true}
      />

      {/* Status overlay */}
      <View style={styles.overlay}>
        <View style={styles.statusBar}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, styles.dotActive]} />
            <Text style={styles.statusText}>Camera Active</Text>
          </View>
          <Text style={styles.statusHint}>
            Detection will be enabled in Plan 2
          </Text>
        </View>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
  },
  statusBar: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  dotActive: {
    backgroundColor: '#4caf50',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusHint: {
    color: '#aaa',
    fontSize: 12,
    marginLeft: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  signOutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  signOutText: {
    color: '#fff',
    fontSize: 14,
  },
  permText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 32,
  },
  permButton: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/camera/CameraPreviewScreen.tsx
git commit -m "feat: add CameraPreviewScreen with live preview and status overlay"
```

---

### Task 12: Viewer Device List Screen (Stub)

**Files:**
- Create: `src/screens/viewer/DeviceListScreen.tsx`

- [ ] **Step 1: Create DeviceListScreen stub**

Create `src/screens/viewer/DeviceListScreen.tsx`:

```tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { getUserDevices } from '@/services/firebase/devices';
import { signOut } from '@/services/firebase/auth';
import { Device } from '@/types';

export function DeviceListScreen(): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const devices = useDeviceStore((s) => s.devices);
  const setDevices = useDeviceStore((s) => s.setDevices);
  const clearUser = useAuthStore((s) => s.clearUser);
  const clearDevice = useDeviceStore((s) => s.clearDevice);

  useEffect(() => {
    if (user) {
      getUserDevices(user.uid).then(setDevices);
    }
  }, [user, setDevices]);

  const cameras = devices.filter((d) => d.role === 'camera');

  async function handleSignOut() {
    clearDevice();
    await signOut();
    clearUser();
  }

  function renderCamera({ item }: { item: Device }) {
    return (
      <TouchableOpacity style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName}>{item.name}</Text>
          <View
            style={[
              styles.statusDot,
              item.status === 'online' ? styles.online : styles.offline,
            ]}
          />
        </View>
        <Text style={styles.cardMode}>
          Mode: {item.mode} | Status: {item.status}
        </Text>
        <Text style={styles.cardHint}>
          Live streaming will be available in Plan 3
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Cameras</Text>

      {cameras.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No cameras paired yet. Set up an old phone as a camera to get
            started.
          </Text>
        </View>
      ) : (
        <FlatList
          data={cameras}
          keyExtractor={(item) => item.id}
          renderItem={renderCamera}
          contentContainerStyle={styles.list}
        />
      )}

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  list: {
    paddingBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  online: {
    backgroundColor: '#4caf50',
  },
  offline: {
    backgroundColor: '#666',
  },
  cardMode: {
    fontSize: 13,
    color: '#a0a0b0',
    marginBottom: 4,
  },
  cardHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#a0a0b0',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  signOutButton: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 40,
  },
  signOutText: {
    color: '#a0a0b0',
    fontSize: 14,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/viewer/DeviceListScreen.tsx
git commit -m "feat: add DeviceListScreen stub for viewer mode"
```

---

### Task 13: Root Navigator

**Files:**
- Create: `src/navigation/RootNavigator.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Create RootNavigator**

Create `src/navigation/RootNavigator.tsx`:

```tsx
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/stores/authStore';
import { onAuthStateChange } from '@/services/firebase/auth';
import { LoginScreen } from '@/screens/LoginScreen';
import { RoleSelectScreen } from '@/screens/RoleSelectScreen';
import { CameraPreviewScreen } from '@/screens/camera/CameraPreviewScreen';
import { DeviceListScreen } from '@/screens/viewer/DeviceListScreen';
import { LoadingScreen } from '@/components/LoadingScreen';

export type RootStackParamList = {
  Login: undefined;
  RoleSelect: undefined;
  CameraPreview: undefined;
  DeviceList: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const setUser = useAuthStore((s) => s.setUser);
  const clearUser = useAuthStore((s) => s.clearUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    const unsubscribe = onAuthStateChange((firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
        });
      } else {
        clearUser();
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [setUser, clearUser, setLoading]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
            <Stack.Screen
              name="CameraPreview"
              component={CameraPreviewScreen}
            />
            <Stack.Screen name="DeviceList" component={DeviceListScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 2: Update App.tsx**

Replace the contents of `App.tsx` with:

```tsx
import React from 'react';
import { RootNavigator } from '@/navigation/RootNavigator';

export default function App(): React.JSX.Element {
  return <RootNavigator />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/navigation/RootNavigator.tsx App.tsx
git commit -m "feat: add RootNavigator with auth-gated navigation"
```

---

### Task 14: End-to-End Verification

- [ ] **Step 1: Run all unit tests**

```bash
npx jest --no-cache
```

Expected: All tests pass.

- [ ] **Step 2: Build and run on Android**

```bash
npx expo run:android
```

Expected: App launches → Login screen → Sign in with Google → Role Select → Tap Camera → Camera preview with status overlay. Tap Viewer → Device list (empty).

- [ ] **Step 3: Build and run on iOS**

```bash
npx expo run:ios
```

Expected: Same flow as Android, plus Apple Sign-In option on Login screen.

- [ ] **Step 4: Verify Firestore data**

After selecting a role, check Firebase Console → Firestore:
- `devices` collection should contain a document with the device's `userId`, `role`, `status: "online"`, and `settings`.

- [ ] **Step 5: Final commit**

If any fixes were needed during verification:

```bash
git add -A
git commit -m "fix: address issues found during end-to-end verification"
```

---

## What's Next

**Plan 2: Detection Engine** — Motion Diff, ML Kit person/object detection, YAMNet sound classification, Event Manager with debounce and mode filtering, local clip recording.

**Plan 3: Streaming & Viewer** — WebRTC P2P via Firestore signaling, live stream viewer, FCM push notifications, Cloud Function, event list with clip playback.
