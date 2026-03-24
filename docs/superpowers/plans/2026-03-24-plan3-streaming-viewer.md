# Plan 3: Streaming & Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable real-time video streaming from camera to viewer via WebRTC P2P, with Firestore-based signaling, live view screen, FCM push notifications on detection events, and event list with clip playback.

**Architecture:** The camera phone creates a WebRTC peer connection and publishes its media stream. Firestore acts as the signaling server — SDP offers/answers and ICE candidates are exchanged via realtime document listeners. The viewer phone subscribes to the stream and displays it. When detection events fire, a Cloud Function triggers FCM push to the viewer. The viewer can browse past events and request clip playback over WebRTC data channel.

**Tech Stack:** react-native-webrtc (P2P streaming), @react-native-firebase/firestore (signaling), @react-native-firebase/messaging (FCM), Firebase Cloud Functions (push trigger)

---

## File Structure

```
src/
├── services/
│   ├── webrtc/
│   │   ├── peerConnection.ts           # (Create) WebRTC peer connection management
│   │   └── signalingService.ts         # (Create) Firestore signaling (SDP/ICE exchange)
│   └── firebase/
│       └── messaging.ts                # (Create) FCM token registration + notification handling
├── stores/
│   └── streamStore.ts                  # (Create) Streaming state (connection, status)
├── screens/
│   └── viewer/
│       ├── DeviceListScreen.tsx         # (Modify) Add navigation to live view, show events
│       ├── LiveViewScreen.tsx           # (Create) Fullscreen WebRTC stream viewer
│       └── EventListScreen.tsx          # (Create) Event timeline with clip playback
├── navigation/
│   └── RootNavigator.tsx               # (Modify) Add LiveView, EventList routes
functions/
└── index.ts                            # (Create) Cloud Function: Firestore trigger → FCM push
```

---

### Task 1: Install WebRTC and Set Up Peer Connection Service

**Files:**
- Create: `src/services/webrtc/peerConnection.ts`

- [ ] **Step 1: Install react-native-webrtc**

```bash
npm install react-native-webrtc --legacy-peer-deps
```

- [ ] **Step 2: Create peer connection service**

Create `src/services/webrtc/peerConnection.ts`:

```typescript
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
  mediaDevices,
} from 'react-native-webrtc';
import { DEFAULT_WEBRTC_CONFIG } from '@/config/webrtc';

const ICE_SERVERS = [
  ...DEFAULT_WEBRTC_CONFIG.stunServers.map((url) => ({ urls: url })),
  ...DEFAULT_WEBRTC_CONFIG.turnServers
    .filter((s) => s.username && s.credential)
    .map((s) => ({ urls: s.urls, username: s.username, credential: s.credential })),
];

export type ConnectionRole = 'camera' | 'viewer';

export interface PeerCallbacks {
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onTrack?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: string) => void;
}

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;

export function createPeerConnection(callbacks: PeerCallbacks): RTCPeerConnection {
  closePeerConnection();

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  pc.addEventListener('icecandidate', (event: any) => {
    if (event.candidate) {
      callbacks.onIceCandidate(event.candidate);
    }
  });

  pc.addEventListener('track', (event: any) => {
    if (event.streams?.[0] && callbacks.onTrack) {
      callbacks.onTrack(event.streams[0]);
    }
  });

  pc.addEventListener('connectionstatechange', () => {
    callbacks.onConnectionStateChange?.(pc.connectionState);
  });

  peerConnection = pc;
  return pc;
}

export async function getLocalStream(): Promise<MediaStream> {
  if (localStream) return localStream;

  const stream = await mediaDevices.getUserMedia({
    audio: true,
    video: {
      facingMode: 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
  });

  localStream = stream as MediaStream;
  return localStream;
}

export async function createOffer(): Promise<RTCSessionDescription> {
  if (!peerConnection) throw new Error('No peer connection');

  const stream = await getLocalStream();
  stream.getTracks().forEach((track) => {
    peerConnection!.addTrack(track, stream);
  });

  const offer = await peerConnection.createOffer({});
  await peerConnection.setLocalDescription(offer);
  return offer as RTCSessionDescription;
}

export async function handleOffer(
  offer: RTCSessionDescription,
): Promise<RTCSessionDescription> {
  if (!peerConnection) throw new Error('No peer connection');

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  return answer as RTCSessionDescription;
}

export async function handleAnswer(answer: RTCSessionDescription): Promise<void> {
  if (!peerConnection) throw new Error('No peer connection');
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

export async function addIceCandidate(candidate: RTCIceCandidate): Promise<void> {
  if (!peerConnection) return;
  await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

export function closePeerConnection(): void {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
}
```

- [ ] **Step 3: Rebuild Android**

```bash
npx expo run:android
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/services/webrtc/peerConnection.ts package.json package-lock.json
git commit -m "feat(plan3): add WebRTC peer connection service"
```

---

### Task 2: Firestore Signaling Service

**Files:**
- Create: `src/services/webrtc/signalingService.ts`

- [ ] **Step 1: Create signaling service**

Create `src/services/webrtc/signalingService.ts`:

The signaling service manages WebRTC session lifecycle via Firestore:
- Camera creates a session document with SDP offer
- Viewer reads the offer, writes SDP answer
- Both sides exchange ICE candidates via a subcollection
- Firestore realtime listeners handle the exchange automatically

```typescript
import firestore from '@react-native-firebase/firestore';

const sessionsCollection = () => firestore().collection('sessions');

export interface SignalingSession {
  sessionId: string;
  cameraDeviceId: string;
  viewerDeviceId: string;
}

export async function createSession(
  cameraDeviceId: string,
): Promise<string> {
  const ref = await sessionsCollection().add({
    cameraDeviceId,
    viewerDeviceId: null,
    offer: null,
    answer: null,
    status: 'waiting',
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function setOffer(sessionId: string, sdp: string): Promise<void> {
  await sessionsCollection().doc(sessionId).update({ offer: sdp });
}

export async function setAnswer(
  sessionId: string,
  viewerDeviceId: string,
  sdp: string,
): Promise<void> {
  await sessionsCollection().doc(sessionId).update({
    answer: sdp,
    viewerDeviceId,
    status: 'connected',
  });
}

export async function addCandidate(
  sessionId: string,
  candidate: any,
  from: 'camera' | 'viewer',
): Promise<void> {
  await sessionsCollection()
    .doc(sessionId)
    .collection('candidates')
    .add({
      ...candidate,
      from,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
}

export function onAnswer(
  sessionId: string,
  callback: (answer: string) => void,
): () => void {
  return sessionsCollection()
    .doc(sessionId)
    .onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (data?.answer) {
        callback(data.answer);
      }
    });
}

export function onOffer(
  sessionId: string,
  callback: (offer: string) => void,
): () => void {
  return sessionsCollection()
    .doc(sessionId)
    .onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (data?.offer) {
        callback(data.offer);
      }
    });
}

export function onCandidates(
  sessionId: string,
  from: 'camera' | 'viewer',
  callback: (candidate: any) => void,
): () => void {
  return sessionsCollection()
    .doc(sessionId)
    .collection('candidates')
    .where('from', '==', from)
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          callback(change.doc.data());
        }
      });
    });
}

export async function closeSession(sessionId: string): Promise<void> {
  await sessionsCollection().doc(sessionId).update({ status: 'closed' });
}

export async function findActiveSession(
  cameraDeviceId: string,
): Promise<string | null> {
  const snapshot = await sessionsCollection()
    .where('cameraDeviceId', '==', cameraDeviceId)
    .where('status', '==', 'waiting')
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/services/webrtc/signalingService.ts
git commit -m "feat(plan3): add Firestore signaling service for WebRTC"
```

---

### Task 3: Stream Store (Zustand)

**Files:**
- Create: `src/stores/streamStore.ts`

- [ ] **Step 1: Create stream store**

Create `src/stores/streamStore.ts`:

```typescript
import { create } from 'zustand';
import { MediaStream } from 'react-native-webrtc';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed';

interface StreamState {
  sessionId: string | null;
  connectionStatus: ConnectionStatus;
  remoteStream: MediaStream | null;
  setSessionId: (id: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  reset: () => void;
}

export const useStreamStore = create<StreamState>((set) => ({
  sessionId: null,
  connectionStatus: 'idle',
  remoteStream: null,
  setSessionId: (sessionId) => set({ sessionId }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  reset: () =>
    set({
      sessionId: null,
      connectionStatus: 'idle',
      remoteStream: null,
    }),
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/stores/streamStore.ts
git commit -m "feat(plan3): add stream store for connection state"
```

---

### Task 4: Camera-Side Streaming Integration

**Files:**
- Modify: `src/screens/camera/CameraPreviewScreen.tsx`

Update the camera preview to:
1. Create a signaling session on mount
2. Start WebRTC peer connection and publish local stream
3. Wait for viewer to connect via Firestore signaling
4. Show streaming status in overlay

- [ ] **Step 1: Add streaming logic to CameraPreviewScreen**

Add imports and streaming setup effect that creates a session, creates an offer, and listens for viewer answer/candidates via Firestore signaling.

- [ ] **Step 2: Update status overlay to show streaming state**

Show "Streaming to viewer" when connected, "Waiting for viewer" when idle.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/screens/camera/CameraPreviewScreen.tsx
git commit -m "feat(plan3): integrate WebRTC streaming into camera preview"
```

---

### Task 5: Live View Screen (Viewer)

**Files:**
- Create: `src/screens/viewer/LiveViewScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Create live view screen**

Create `src/screens/viewer/LiveViewScreen.tsx`:

A fullscreen screen that:
1. Receives the cameraDeviceId via navigation params
2. Finds or creates a signaling session
3. Connects via WebRTC as the viewer
4. Displays the remote video stream using `RTCView`
5. Shows connection status and a disconnect button

- [ ] **Step 2: Add LiveView route to RootNavigator**

Add `LiveView: { cameraDeviceId: string }` to `RootStackParamList` and register the screen.

- [ ] **Step 3: Update DeviceListScreen to navigate to LiveView**

Modify the camera card's `onPress` to navigate to `LiveView` with the device's ID.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/screens/viewer/LiveViewScreen.tsx src/screens/viewer/DeviceListScreen.tsx src/navigation/RootNavigator.tsx
git commit -m "feat(plan3): add live view screen with WebRTC stream playback"
```

---

### Task 6: Event List Screen (Viewer)

**Files:**
- Create: `src/screens/viewer/EventListScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`
- Modify: `src/screens/viewer/DeviceListScreen.tsx`

- [ ] **Step 1: Create event list screen**

Create `src/screens/viewer/EventListScreen.tsx`:

A screen that:
1. Receives cameraDeviceId via navigation params
2. Fetches events from Firestore for that device
3. Displays events in a timeline (type, confidence, timestamp)
4. Each event shows its alert level and clip availability

- [ ] **Step 2: Add EventList route and navigation**

Add `EventList: { cameraDeviceId: string }` to `RootStackParamList`. Add an "Events" button on DeviceListScreen cards.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/screens/viewer/EventListScreen.tsx src/screens/viewer/DeviceListScreen.tsx src/navigation/RootNavigator.tsx
git commit -m "feat(plan3): add event list screen for viewing detection history"
```

---

### Task 7: FCM Push Notifications

**Files:**
- Create: `src/services/firebase/messaging.ts`
- Create: `functions/index.ts`
- Modify: `src/screens/camera/CameraPreviewScreen.tsx`

- [ ] **Step 1: Create messaging service**

Create `src/services/firebase/messaging.ts`:

Handles FCM token registration and notification permission request.

```typescript
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
```

- [ ] **Step 2: Create Cloud Function for FCM trigger**

Initialize Firebase Functions:

```bash
cd functions && npm init -y && npm install firebase-admin firebase-functions
```

Create `functions/index.ts`:

Cloud Function that triggers when a new event is written to Firestore, looks up the user's FCM tokens, and sends a push notification.

- [ ] **Step 3: Register FCM token on viewer login**

Update DeviceListScreen or CameraPreviewScreen to call `registerFCMToken` on mount.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/services/firebase/messaging.ts functions/ src/screens/camera/CameraPreviewScreen.tsx
git commit -m "feat(plan3): add FCM push notifications with Cloud Function trigger"
```

---

### Task 8: End-to-End Testing

**Files:** None (verification only)

- [ ] **Step 1: Build and deploy to two physical devices**

```bash
npx expo run:android
```

- [ ] **Step 2: Test streaming flow**

1. Device A: Sign in → Camera mode → verify "Waiting for viewer" status
2. Device B: Sign in (same account) → Viewer mode → tap camera card
3. Verify live video stream appears on Device B
4. Verify connection status shows "Connected" on both devices
5. Disconnect → verify both sides handle gracefully

- [ ] **Step 3: Test event list**

1. On Device B (viewer): tap "Events" on a camera card
2. Verify detection events from Plan 2 appear with timestamps
3. Verify event types and confidence scores display correctly

- [ ] **Step 4: Test push notifications**

1. Deploy Cloud Function: `cd functions && npx firebase deploy --only functions`
2. On Device A (camera): trigger a detection event
3. On Device B (viewer): verify push notification received

- [ ] **Step 5: Update README**

Update README.md Plan 3 section from "Planned" to show completed tasks.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: update README with Plan 3 completion status"
```

---

### Task 9: TURN Server Integration Testing

**Files:**
- Modify: `src/config/webrtc.ts`

- [ ] **Step 1: Set up Cloudflare Calls TURN credentials**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Calls → TURN
2. Create a TURN key pair (username + credential)
3. Fill in the credentials in `src/config/webrtc.ts`:

```typescript
turnServers: [
  {
    urls: 'turn:turn.cloudflare.com:3478',
    username: 'YOUR_TURN_USERNAME',
    credential: 'YOUR_TURN_CREDENTIAL',
  },
],
```

**Note:** Do NOT commit credentials to git. Consider moving TURN credentials to `.env` for production use.

- [ ] **Step 2: Verify TURN is included in ICE servers**

Rebuild and check logs. `peerConnection.ts` filters out TURN entries with empty username/credential — with credentials filled in, the TURN server should now appear in the ICE server list.

- [ ] **Step 3: Test direct connection (same network baseline)**

1. Connect both devices to the same WiFi
2. Device A → Camera mode, Device B → Viewer mode → tap camera card
3. Verify stream connects. Connection should use STUN (direct P2P) since both are on the same network

- [ ] **Step 4: Test TURN relay (cross-network)**

1. Device A (camera): connect to WiFi
2. Device B (viewer): disconnect WiFi, use mobile data only
3. On Device B: tap camera card to connect
4. Verify live stream appears — this connection will likely need TURN relay since the devices are on different networks behind different NATs
5. Check that connection status shows "Connected" on both sides

- [ ] **Step 5: Test strict NAT scenario (optional)**

1. If available, use a network with strict/symmetric NAT (e.g., corporate WiFi, carrier-grade NAT on mobile)
2. Verify TURN relay handles the connection gracefully
3. If connection fails without TURN credentials but succeeds with them, TURN is confirmed working

- [ ] **Step 6: Commit credentials setup (without secrets)**

```bash
git commit -m "docs: add TURN server testing instructions"
```
