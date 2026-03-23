# AI Vision Monitor — Design Spec

Turn old phones into AI-powered security cameras with real-time streaming, intelligent detection, and instant alerts.

## Overview

A free, open-source React Native app that repurposes old smartphones as security cameras. Users install the same app on both devices — one acts as the camera, the other as the viewer. The camera phone performs on-device AI detection (person, motion, sound) and streams video via peer-to-peer connection. When events are detected, the viewer receives push notifications and can play back recorded clips.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Firebase Backend                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Firebase Auth │  │  Firestore   │  │     FCM      │  │
│  │ (Google/Apple)│  │ (Signaling + │  │ (Push Notify)│  │
│  │              │  │  Device Reg) │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────────┬────────────────────────────┘
                             │
                    Signaling (SDP/ICE)
                             │
┌────────────────────────────┴────────────────────────────┐
│                 WebRTC P2P Connection                    │
│          STUN (Google) → Direct Connect (~85%)          │
│          TURN (Cloudflare Calls) → Fallback (~15%)      │
│          (STUN/TURN endpoints are user-configurable)    │
└──────────┬─────────────────────────────┬────────────────┘
           │                             │
┌──────────┴──────────┐       ┌──────────┴──────────┐
│   Camera Phone      │       │   Viewer Phone      │
│   (old device)      │       │   (primary device)  │
│                     │       │                     │
│ • Camera capture    │       │ • Live stream view  │
│ • AI detection      │       │ • Event list        │
│ • Local recording   │       │ • Clip playback     │
│ • Event triggers    │       │ • Mode selection    │
└─────────────────────┘       └─────────────────────┘
```

### Key Decisions

| Item | Decision | Rationale |
|------|----------|-----------|
| Framework | React Native | Cross-platform, single codebase for iOS & Android |
| App structure | Single app, role selection | One install, user picks camera or viewer mode |
| Streaming | WebRTC P2P + TURN fallback | Low latency, minimal server cost |
| STUN | Google public STUN | Free, reliable |
| TURN | Cloudflare Calls | 1TB/month free tier, configurable |
| Backend | Firebase (Auth + Firestore + FCM) | Free tier sufficient, fast to develop |
| Signaling | Firestore realtime listeners | No separate WebSocket server needed |
| AI detection | ML Kit + YAMNet + Motion Diff | All on-device, free, zero latency |
| Storage | Local on camera phone | Free, no cloud cost |
| Monetization | Free open-source | Community project |

## App Screen Flow

```
Splash → Login (Google/Apple) → Role Select
                                    │
                 ┌──────────────────┴──────────────────┐
                 ▼                                     ▼
          Camera Mode                            Viewer Mode
          ├── Camera Preview                     ├── Device List
          │   (live preview + detection status)   │   (paired cameras)
          └── Settings                           ├── Live View
              ├── Mode (security/baby/pet/custom) │   (fullscreen stream)
              ├── Detection sensitivity          ├── Events
              ├── Recording duration             │   (timeline + playback)
              └── Video quality                  └── Settings
                                                     (notification prefs)
```

### Detection Modes

Each mode has preset detection settings. Users can also create custom configurations.

| Detection Result | 🏠 Security | 👶 Baby | 🐾 Pet |
|-----------------|-------------|---------|--------|
| Person detected | 🔴 Alert | 🟡 Notify | — |
| Motion detected | 🔴 Alert | 🟢 Record | 🟡 Notify |
| Baby cry | 🟡 Notify | 🔴 Alert | — |
| Dog bark | 🟡 Notify | — | 🔴 Alert |
| Glass break | 🔴 Alert | 🔴 Alert | 🔴 Alert |
| Cat meow | — | — | 🟡 Notify |

- 🔴 Alert = push notification + recording + vibration
- 🟡 Notify = push notification + recording
- 🟢 Record = recording only, no push
- — = ignored

## Firestore Data Model

```
users/{userId}
  ├── email: string
  ├── displayName: string
  ├── createdAt: timestamp
  └── fcmTokens: map<deviceId, token>

devices/{deviceId}
  ├── userId: string
  ├── name: string                       // e.g. "Living Room Camera"
  ├── role: "camera" | "viewer"
  ├── mode: "security" | "baby" | "pet" | "custom"
  ├── status: "online" | "offline"
  ├── lastSeen: timestamp
  └── settings: map                      // detection sensitivity, etc.

sessions/{sessionId}                     // WebRTC Signaling (ephemeral)
  ├── cameraDeviceId: string
  ├── viewerDeviceId: string
  ├── offer: string (SDP)
  ├── answer: string (SDP)
  ├── status: "waiting" | "connected" | "closed"
  ├── createdAt: timestamp
  └── candidates/{candidateId}
        ├── candidate: string
        ├── from: "camera" | "viewer"
        └── createdAt: timestamp

events/{eventId}
  ├── deviceId: string
  ├── userId: string
  ├── type: "person" | "motion" | "sound"
  ├── soundClass: string | null          // "baby_cry", "dog_bark", etc.
  ├── confidence: number                 // 0-1
  ├── timestamp: timestamp
  ├── clipPath: string | null            // local file path on camera
  └── clipDurationSec: number
```

### Security Rules

Firestore Security Rules restrict all reads and writes to the authenticated user's own data (`request.auth.uid == resource.data.userId`).

## Detection Engine

### Vision Pipeline (runs per frame at 5-10 fps)

```
Camera Frame
    │
    ▼
Motion Diff (lightweight pixel comparison)
    │
    ├── No motion → skip (save CPU)
    │
    └── Motion detected → ML Kit (person/object detection)
                              │
                              └── confidence > threshold → trigger event
```

Motion Diff runs first as a gate. ML Kit only runs when motion is detected, significantly reducing CPU and battery usage on old devices.

### Audio Pipeline (continuous)

```
Microphone → 1-second audio buffer → YAMNet classification
    │
    └── confidence > threshold → trigger event
         (baby_cry, dog_bark, glass_break, cat_meow, etc.)
```

YAMNet is a pre-trained TensorFlow Lite model that classifies 500+ sound categories.

### Event Manager

When a detection triggers:

1. **Debounce** — same event type suppressed for 30 seconds to avoid notification spam
2. **Record** — ring buffer captures 5 seconds before trigger + 10 seconds after, saved as MP4 locally
3. **Push notification** — write event to Firestore → Cloud Function triggers FCM → viewer receives notification
4. **Log** — event metadata saved to Firestore `events` collection

## Tech Stack

| Category | Package | Purpose |
|----------|---------|---------|
| Framework | React Native (Expo bare workflow) | Cross-platform native app |
| Navigation | React Navigation | Screen routing |
| Camera | react-native-vision-camera | Camera access + frame processor |
| WebRTC | react-native-webrtc | P2P video/audio streaming |
| AI Vision | react-native-mlkit | Person/object detection (on-device) |
| AI Motion | Custom frame diff | Pixel difference between frames |
| AI Sound | react-native-audio-api + TFLite (YAMNet) | Audio capture + sound classification |
| Firebase | @react-native-firebase/* | Auth, Firestore, FCM |
| Local Storage | react-native-fs | Event clip file management |
| State | Zustand | Lightweight state management |
| Background | react-native-background-actions | Keep camera running in background |

## Project Structure

```
ai-vision-monitor/
  ├── android/              # Android native project (auto-generated)
  ├── ios/                  # iOS native project (auto-generated)
  ├── src/
  │   ├── screens/          # Screen components
  │   ├── components/       # Shared UI components
  │   ├── services/
  │   │   ├── firebase/     # Auth, Firestore, FCM
  │   │   ├── webrtc/       # P2P connection management
  │   │   ├── detection/    # ML Kit + YAMNet + Motion Diff
  │   │   └── recording/    # Event clip recording
  │   ├── stores/           # Zustand state management
  │   ├── hooks/            # Custom hooks
  │   ├── navigation/       # Route configuration
  │   ├── config/           # STUN/TURN and other configurable values
  │   └── utils/            # Utility functions
  ├── app.json
  ├── package.json
  └── tsconfig.json
```

## Error Handling & Edge Cases

### Network

- **P2P disconnect** — auto-reconnect with 3 retries, then notify viewer "camera offline"
- **Signaling failure** — Firestore offline queue handles temporary disconnects
- **STUN failure** — transparent fallback to TURN relay

### Detection

- **False positives** — adjustable sensitivity thresholds per detection type; custom mode for fine-grained control
- **Low memory** — monitor memory usage, reduce detection frame rate or fall back to motion-diff-only when memory is critically low
- **Storage full** — auto-delete oldest clips, cap at configurable limit (default 1GB), notify viewer when below 200MB

### Background Execution

- **Android** — foreground service with persistent notification ("Camera running"), prevents system kill
- **iOS** — background audio mode with silent audio playback for keep-alive; iOS has stricter limits, may occasionally interrupt; recommend Android devices for camera role

### Account & Pairing

- **Multiple viewers** — same account can view from multiple devices simultaneously, each with independent WebRTC connection
- **Camera offline** — viewer shows offline status with last-seen time; detection events during offline sync when camera reconnects
