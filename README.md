# AI Vision Monitor

Turn your old smartphones into AI-powered security cameras with real-time streaming, intelligent detection, and instant alerts.

## Overview

AI Vision Monitor is a free, open-source React Native app that repurposes old smartphones as security cameras. Install the same app on two devices — one acts as the **camera**, the other as the **viewer**. The camera phone performs on-device AI detection (person, motion, sound) and streams video via peer-to-peer connection. When events are detected, the viewer receives push notifications and can play back recorded clips.

### Key Features

- **Dual-role app** — One app, two modes: Camera mode turns an old phone into a smart security camera; Viewer mode lets you watch live feeds and receive alerts on your primary phone
- **On-device AI detection** — All detection runs locally on the camera phone using Google ML Kit (person/object detection), YAMNet (sound classification), and frame-diff motion detection. No cloud processing, zero latency, completely free
- **WebRTC P2P streaming** — Direct peer-to-peer video streaming with STUN/TURN support. Low latency, minimal server cost
- **Multiple detection modes** — Pre-configured profiles for home security, baby monitoring, and pet watching, plus fully customizable settings
- **Smart alerts** — Push notifications with event recording (5s before + 10s after trigger). Debounce prevents notification spam
- **Privacy-first** — Video never touches a server. Event clips stored locally on the camera phone. Firebase only handles auth, device pairing, and push notification triggers

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

## Detection Modes

| Detection Result | Home Security | Baby Monitor | Pet Watch |
|-----------------|---------------|--------------|-----------|
| Person detected | Alert | Notify | — |
| Motion detected | Alert | Record only | Notify |
| Baby cry | Notify | Alert | — |
| Dog bark | Notify | — | Alert |
| Glass break | Alert | Alert | Alert |
| Cat meow | — | — | Notify |

- **Alert** = push notification + recording + vibration
- **Notify** = push notification + recording
- **Record** = recording only, no push
- **—** = ignored

## Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| Framework | React Native (Expo bare workflow) | Cross-platform iOS & Android |
| Language | TypeScript | Type safety |
| Navigation | React Navigation | Screen routing |
| State | Zustand | Lightweight state management |
| Camera | react-native-vision-camera | Camera access + frame processor |
| Streaming | react-native-webrtc | P2P video/audio via WebRTC |
| AI Vision | Google ML Kit (react-native-mlkit) | On-device person/object detection |
| AI Sound | TensorFlow Lite (YAMNet) | On-device sound classification |
| AI Motion | Custom frame diff | Lightweight pixel comparison |
| Auth | Firebase Auth | Google/Apple social sign-in |
| Database | Cloud Firestore | Device registry + signaling + events |
| Push | Firebase Cloud Messaging (FCM) | Push notifications |
| Storage | Local (react-native-fs) | Event clips on camera phone |
| Background | react-native-background-actions | Keep camera running in background |

## Prerequisites

- Node.js 18+
- React Native development environment ([setup guide](https://reactnative.dev/docs/environment-setup))
- Firebase project with Authentication, Firestore, and Cloud Messaging enabled
- Xcode (for iOS) / Android Studio (for Android)

## Installation

```bash
# Clone the repository
git clone https://github.com/user/ai-vision-monitor.git
cd ai-vision-monitor

# Install dependencies
npm install

# iOS: Install CocoaPods
cd ios && pod install && cd ..
```

### Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Authentication** with Google and Apple sign-in providers
3. Enable **Cloud Firestore**
4. Enable **Cloud Messaging**
5. Download `google-services.json` → place in `android/app/`
6. Download `GoogleService-Info.plist` → place in `ios/`
7. Update `src/screens/LoginScreen.tsx` with your Web Client ID from Firebase Console

### STUN/TURN Configuration

Default configuration uses Google's free STUN servers and Cloudflare Calls for TURN relay. To use your own:

Edit `src/config/webrtc.ts` to set custom STUN/TURN endpoints.

## Running the App

```bash
# Android
npx expo run:android

# iOS
npx expo run:ios
```

## Usage

1. **Sign in** with Google or Apple on both devices
2. **Camera device** (old phone): Select "Camera" mode → grant camera/microphone permissions → the phone starts monitoring
3. **Viewer device** (primary phone): Select "Viewer" mode → see your paired cameras → tap to view live stream
4. **Configure detection**: On the camera device, choose a detection mode (Security / Baby / Pet / Custom) and adjust sensitivity

## Project Structure

```
ai-vision-monitor/
├── android/              # Android native project
├── ios/                  # iOS native project
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
│   ├── config/           # STUN/TURN and configurable values
│   ├── types/            # Shared TypeScript types
│   └── utils/            # Utility functions
├── functions/            # Firebase Cloud Functions (FCM trigger)
├── docs/                 # Design specs and implementation plans
├── firestore.rules       # Firestore security rules
└── package.json
```

## Development Progress

### Plan 1: Foundation (In Progress)

Project setup, authentication, navigation, and camera preview.

- [x] Task 1: Project initialization (Expo bare workflow + dependencies)
- [x] Task 2: TypeScript type definitions
- [x] Task 3: Firebase and WebRTC configuration
- [ ] Task 4: Auth service (Firebase Auth with Google/Apple)
- [ ] Task 5: Device service (Firestore device registration)
- [ ] Task 6: Auth store (Zustand)
- [ ] Task 7: Device store (Zustand)
- [ ] Task 8: Loading component
- [ ] Task 9: Login screen
- [ ] Task 10: Role select screen
- [ ] Task 11: Camera preview screen
- [ ] Task 12: Viewer device list screen (stub)
- [ ] Task 13: Root navigator (auth-gated)
- [ ] Task 14: End-to-end verification

### Plan 2: Detection Engine (Planned)

Motion detection, ML Kit person/object detection, YAMNet sound classification, event manager, local recording.

### Plan 3: Streaming & Viewer (Planned)

WebRTC P2P streaming, Firestore signaling, viewer live view, FCM push notifications, event list with clip playback.

## Contributing

Contributions are welcome! Please read the design spec at `docs/superpowers/specs/2026-03-23-ai-vision-monitor-design.md` for architectural context before making changes.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open-source and free to use.
