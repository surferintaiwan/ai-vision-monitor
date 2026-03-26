# AI Vision Monitor

Turn your old smartphones into AI-powered security cameras with real-time streaming, intelligent detection, and instant alerts.

## Overview

AI Vision Monitor is a free, open-source React Native app that repurposes old smartphones as security cameras. Install the same app on two devices — one acts as the **camera**, the other as the **viewer**. The camera phone performs on-device AI detection (person, motion, sound) and streams video via peer-to-peer connection. When events are detected, the viewer receives push notifications and can review the event timeline with recorded clip metadata.

### Key Features

- **Dual-role app** — One app, two modes: Camera mode turns an old phone into a smart security camera; Viewer mode lets you watch live feeds and receive alerts on your primary phone. Rename cameras from either side
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
│ • Local recording   │       │ • Event review      │
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
| Camera | react-native-webrtc (getUserMedia) | Camera capture via WebRTC |
| Frame Capture | PixelCopy native module | Capture SurfaceView frames for detection |
| Motion Detection | Native pixel-diff (ScreenCaptureModule) | 64x48 downscaled frame comparison |
| Streaming | react-native-webrtc | P2P video/audio via WebRTC |
| Audio Routing | AudioRoutingModule (native) | Force loudspeaker on viewer |
| AI Vision | Google ML Kit (react-native-mlkit) | On-device object detection (future: person-specific) |
| AI Sound | TensorFlow Lite (YAMNet) | On-device sound classification |
| Auth | Firebase Auth | Google/Apple social sign-in |
| Database | Cloud Firestore | Device registry + signaling + events |
| Push | Firebase Cloud Messaging (FCM) | Push notifications |
| Storage | Local (react-native-fs) | Event clips on camera phone |

## Prerequisites

- **Node.js 18+**
- **Xcode** (for iOS) — install from Mac App Store
- **Android Studio** (for Android) — provides Android SDK and Java Runtime
- Firebase project (free Spark plan is sufficient)

## Installation

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/surferintaiwan/ai-vision-monitor.git
cd ai-vision-monitor
npm install
```

### 2. Android Studio Setup

Android Studio is required even though we don't use it directly — it provides the Android SDK and Java Runtime needed to build the app.

```bash
# Install via Homebrew
brew install --cask android-studio
```

After installation, **open Android Studio once** and complete the setup wizard. This downloads the Android SDK automatically.

Then add the following environment variables to `~/.zshrc`:

```bash
# Android SDK location
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Java Runtime bundled with Android Studio
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

After editing, reload the config:

```bash
source ~/.zshrc
```

Verify the setup:

```bash
# Should print the Java version
java -version

# Should print the SDK path
echo $ANDROID_HOME
```

### Android Release Signing (Required for Production)

Do not ship release APK/AAB files with `debug.keystore`.
This project expects release signing secrets to be provided via Gradle properties:

```properties
AI_VISION_UPLOAD_STORE_FILE=/absolute/path/to/your-release.keystore
AI_VISION_UPLOAD_STORE_PASSWORD=your_store_password
AI_VISION_UPLOAD_KEY_ALIAS=your_key_alias
AI_VISION_UPLOAD_KEY_PASSWORD=your_key_password
```

Add them to your local `~/.gradle/gradle.properties` (or CI secret env injection), not this repository.

### GitHub Actions + Firebase App Distribution

This repository includes `.github/workflows/android-apk.yml` that:

1. Deploys Cloudflare TURN Worker on each push to `main`
2. Automatically resolves Worker URL and injects it as `TURN_CREDENTIALS_ENDPOINT` during build
3. Builds a signed Android release APK
4. Uploads the APK to **Firebase App Distribution**
5. Does **not** upload APKs to GitHub Releases or GitHub Artifacts

Public repo note:

- GitHub-hosted runners are ephemeral, so files created during a job are not published by default.
- This workflow only distributes the APK through Firebase App Distribution and does not upload it to GitHub Artifacts or Releases.
- If this repository is public, GitHub Actions logs are publicly visible. Never print secrets to logs, enable shell tracing like `set -x`, or add steps that echo generated secret files such as `.env`, `google-services.json`, keystores, or service-account JSON.

Required GitHub repository secrets:

- `GOOGLE_WEB_CLIENT_ID`  
  Firebase Console → Authentication → Sign-in method → Google → Web client ID
- `GOOGLE_SERVICES_JSON`  
  Firebase Console → Project settings → Your Android app → download `google-services.json` and paste full JSON content
- `AI_VISION_UPLOAD_STORE_PASSWORD` / `AI_VISION_UPLOAD_KEY_ALIAS` / `AI_VISION_UPLOAD_KEY_PASSWORD`  
  Your Android release keystore values
- `ANDROID_UPLOAD_KEYSTORE_BASE64`  
  Base64 content of your release keystore (`.jks`)
- `CLOUDFLARE_API_TOKEN`  
  Cloudflare Dashboard → My Profile → API Tokens (permissions for Worker deploy + read workers subdomain)
- `CLOUDFLARE_ACCOUNT_ID`  
  Cloudflare Dashboard → right sidebar / Workers & Pages account details
- `FIREBASE_PROJECT_ID`  
  Firebase project ID used for ID token verification
- `CF_TURN_KEY_ID`  
  Cloudflare Calls TURN key ID (Realtime/TURN settings)
- `CF_TURN_API_TOKEN`  
  Cloudflare Calls API token used by Worker at runtime to mint short-lived TURN credentials
- `CF_TURN_TTL_SECONDS` (optional)  
  TURN credential TTL in seconds (`600` recommended)
- `ALLOWED_UIDS` (optional)  
  Comma-separated Firebase UIDs allowed to call TURN credentials endpoint
- `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` (optional fallback TURN)  
  Static TURN credentials (only if you want fallback mode)
- `FIREBASE_SERVICE_ACCOUNT_JSON`  
  Google Cloud service account key JSON with Firebase App Distribution access
- `FIREBASE_APP_ID_ANDROID`  
  Firebase Console → Project settings → Android app → App ID (format `1:...:android:...`)
- `FIREBASE_TESTERS` (optional)  
  Comma-separated tester emails for App Distribution
- `FIREBASE_GROUPS` (optional)  
  Comma-separated App Distribution group aliases

`FIREBASE_TESTERS` and `FIREBASE_GROUPS` are individually optional, but CI requires at least one of them to be set.

For CI/CD Google Sign-In, these secrets must stay in sync:

- `GOOGLE_WEB_CLIENT_ID` must match the Web client ID embedded in `GOOGLE_SERVICES_JSON`
- The release keystore stored in `ANDROID_UPLOAD_KEYSTORE_BASE64` must have its SHA-1 added to the Firebase Android app
- After adding a new SHA-1 in Firebase, download a fresh `google-services.json` and update `GOOGLE_SERVICES_JSON`

The Android workflow validates this before `assembleRelease` and will fail fast if the release keystore fingerprint or Web client ID does not match.

Repository variable (not secret):

- `CF_WORKER_NAME`  
  Worker script name (for example `ai-vision-turn`). Use **Repository Variables** instead of Secrets to avoid GitHub masking this value in cross-job outputs.

#### Keystore + BASE64 (Why and How)

- `upload-keystore.jks` is your Android signing key file. Generate it locally with `keytool`; do not commit it.
- `ANDROID_UPLOAD_KEYSTORE_BASE64` is the same keystore, encoded as text so it can be stored in GitHub Secrets and reconstructed in CI.
- Even though it is Base64 text, it is still sensitive private signing material.
- For PKCS12 keystores, `key password` should match `store password`.
- You may delete the local `.jks` after setup, but only after storing a secure backup (encrypted cloud drive/password manager/secure offline copy).
- If you lose this signing key, future updates for the same Android package cannot be signed as the same app.
- Creating a new key later is possible, but it behaves like a different signer identity and is not a safe default for updating an already-published app.

Quick generation example:

```bash
keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore android/app/upload-keystore.jks \
  -alias ai-vision-upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Convert keystore to GitHub secret value:

```bash
base64 -i android/app/upload-keystore.jks | pbcopy
```

Service account guidance:

- Create or use a service account for CI
- Grant App Distribution permissions in the Firebase project
- Store the JSON key only in GitHub Secrets

### 3. Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com) (free Spark plan)
2. **Enable Authentication:**
   - Go to Authentication → Sign-in method
   - Enable **Google** — set a public-facing project name and support email, then save
   - Enable **Apple** (for iOS sign-in)
3. **Enable Cloud Firestore:**
   - Go to Firestore Database → **Create database**
   - Select **Start in test mode** (for development; switch to production rules before launch)
   - Choose a location close to your users (e.g., `asia-east1` for Taiwan)
   - **Note:** The app requires Firestore to be created before it can register devices or navigate between screens. Without it, tapping Camera/Viewer on the role select screen will fail silently.
4. **Enable Cloud Messaging** (for push notifications in Plan 3)

#### Add Android App

1. In Firebase Console → Project Settings → **Add app** → select Android
2. Package name: `com.aivisionmonitor`
3. **Add SHA-1 fingerprint** — Firebase uses SHA-1 as your app's identity fingerprint to verify that API requests (especially Google Sign-In) come from your authorized app. Get it by running:
   ```bash
   cd android && ./gradlew signingReport
   ```
   Copy the `SHA1` value from the `debug` variant output, then paste it into the SHA certificate fingerprints field in Firebase Console. If you also build signed Android releases in CI, add the SHA-1 for your release upload keystore too.
4. Download `google-services.json` → place in `android/app/`
   - **Important:** Make sure to download this **after** adding the SHA-1 fingerprint. The file must contain your `oauth_client` entries for Google Sign-In to work.
5. Skip "Add Firebase SDK" step (already configured)

If tapping Google sign-in shows `DEVELOPER_ERROR` or `code: 10`, it means Android app signing does not match your Firebase/Google configuration. The usual fix is:

1. Run `cd android && ./gradlew signingReport`
2. Copy the `SHA1` for the build you are running (`debug` during local development)
3. Add that SHA-1 to Firebase Console → Project settings → Your Android app
4. Download a fresh `google-services.json` and replace the file in `android/app/`
5. Confirm `GOOGLE_WEB_CLIENT_ID` in `.env` is the **Web** client ID from Firebase Authentication, not the Android client ID
6. If the failing build is a CI/CD release build, also verify the release keystore SHA-1 is present in `google-services.json`

#### Google Services Gradle Plugin

The Android build requires the Google Services Gradle plugin to read `google-services.json` and auto-initialize Firebase. This is already configured in the project:

- `android/build.gradle` — includes `com.google.gms:google-services` classpath
- `android/app/build.gradle` — applies `com.google.gms.google-services` plugin

Without this plugin, the app will crash at startup with: `No Firebase App '[DEFAULT]' has been created`. If you see this error, verify both files have the plugin configured.

#### Add iOS App

1. In Firebase Console → Project Settings → **Add app** → select iOS
2. Bundle ID: `com.aivisionmonitor`
3. Download `GoogleService-Info.plist` → place in `ios/aivisionmonitor/`
4. Skip "Add Firebase SDK" step (already configured)

#### Configure Google Sign-In

1. In Firebase Console → Authentication → Sign-in method → Google → expand **Web SDK configuration**
2. Copy the **Web client ID** (format: `xxxx.apps.googleusercontent.com`)
3. Create a `.env` file in the project root (use `.env.example` as a template):
   ```bash
   cp .env.example .env
   ```
4. Paste your Web client ID into `.env`:
   ```
   GOOGLE_WEB_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
   TURN_CREDENTIALS_ENDPOINT=https://your-worker-subdomain.workers.dev
   # Optional fallback static TURN (not recommended)
   TURN_URL=turn:turn.cloudflare.com:3478
   TURN_USERNAME=your-turn-username
   TURN_CREDENTIAL=your-turn-credential
   ```

**Important:** `google-services.json`, `GoogleService-Info.plist`, and `.env` files are gitignored and will NOT be committed. Each developer must set up their own Firebase project and `.env` file.

### 4. iOS CocoaPods (iOS only)

```bash
cd ios && pod install && cd ..
```

### STUN/TURN Configuration

The app always includes Google's free STUN servers.

Recommended TURN setup uses short-lived credentials from a Cloudflare Worker:

- Set `TURN_CREDENTIALS_ENDPOINT` in `.env`
- Deploy `workers/turn-credentials-worker.js` with Wrangler
- Configure Worker env vars: `FIREBASE_PROJECT_ID`, `CF_TURN_KEY_ID`, `CF_TURN_TTL_SECONDS`, `CF_TURN_API_TOKEN`
- The app sends `Authorization: Bearer <Firebase ID token>` automatically when requesting TURN credentials

Optional fallback (less secure): static TURN credentials via `.env` (`TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`).
If neither dynamic nor static TURN is configured, the app falls back to STUN-only mode.

#### Worker Auth Logic (Simple)

When the app asks for TURN credentials, the flow is:

1. The app signs in with Firebase Auth and gets an ID token.
2. The app calls your Worker endpoint with `Authorization: Bearer <ID token>`.
3. The Worker verifies the token signature using Google's public keys.
4. The Worker also checks:
   - `iss` (issuer) matches your Firebase project
   - `aud` (audience) matches your Firebase project
   - token is not expired (`exp`) and has valid issue time (`iat`)
5. If `ALLOWED_UIDS` is set, only those Firebase user IDs can receive TURN credentials.
   If `ALLOWED_UIDS` is not set, any valid Firebase-authenticated user in your project can request TURN credentials.
6. Only after passing all checks does the Worker request short-lived TURN credentials from Cloudflare and return them to the app.

This means your long-lived TURN API token stays server-side (Worker secret) and is never shipped in the app.

### Cloudflare Worker TURN Setup (No Firebase Blaze Needed)

1. Install Wrangler and log in:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
2. Copy worker config template and fill your TURN key id:
   ```bash
   cd workers
   cp wrangler.toml.example wrangler.toml
   ```
   Update `wrangler.toml`:
   - `FIREBASE_PROJECT_ID=<your-firebase-project-id>`
   - `CF_TURN_KEY_ID=<your-cloudflare-turn-key-id>`
   - `CF_TURN_TTL_SECONDS=600`
   - Optional: `ALLOWED_UIDS=<your-firebase-uid>` to allow only your account
3. Set TURN API token as Worker secret:
   ```bash
   wrangler secret put CF_TURN_API_TOKEN
   ```
4. Deploy worker:
   ```bash
   wrangler deploy turn-credentials-worker.js
   ```
5. Copy Worker URL and set it in app `.env`:
   ```bash
   TURN_CREDENTIALS_ENDPOINT=https://<your-worker-subdomain>.workers.dev
   ```

## Running the App

```bash
# Android (requires USB-connected device or emulator)
npx expo run:android

# iOS (requires Xcode + Apple Developer account for physical devices)
npx expo run:ios
```

**Important:** Debug builds load JavaScript from the Metro dev server over WiFi. You must keep `npx expo start` running (it launches automatically with `expo run:android`/`run:ios`). If you later open the app without the dev server running, it will show an "unable to load script" error. To fix this, start the dev server first:

```bash
npx expo start
```

The device and your development machine must be on the same WiFi network.

### Android Device Testing

To test on a physical Android device:

1. On your phone: **Settings** → **About phone** → **Software information** → tap **Build number** 7 times to enable Developer mode
2. Go to **Settings** → **Developer options** → enable **USB debugging**
3. Connect the phone to your Mac via USB cable
4. Approve the "Allow USB debugging" prompt on your phone
5. Verify connection: `adb devices`
6. Run: `npx expo run:android`

**Note:** Camera features require a physical device. The Android emulator does not have a real camera.

### Testing with Two Phones (WiFi ADB)

To test the camera/viewer flow simultaneously on two Android phones, use WiFi ADB so both devices can run the app without swapping USB cables:

1. Connect **Phone A** via USB, then enable wireless debugging:
   ```bash
   adb tcpip 5555
   adb connect <PHONE_A_IP>:5555
   ```
2. Disconnect the USB cable from Phone A
3. Connect **Phone B** via USB
4. Verify both devices are connected:
   ```bash
   adb devices
   # Should show Phone A (IP) and Phone B (USB)
   ```
5. Install and run on both:
   ```bash
   npx expo run:android
   ```
   Expo will prompt you to select a device if multiple are connected, or you can target a specific device with `--device`.

   Alternatively, build the APK once and install it directly to both phones via `adb install`:
   ```bash
   # Build APK
   cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew assembleDebug

   # Install to both phones via WiFi
   adb -s 192.168.x.x:5555 install -r android/app/build/outputs/apk/debug/app-debug.apk
   adb -s 192.168.y.y:5555 install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

**Tip:** Find your phone's IP address in **Settings** → **Wi-Fi** → tap your network → **IP address**. Both phones must be on the same WiFi network as your development machine.

**Important:** When using `adb install` to sideload the APK directly, the Metro dev server (`npx expo start`) must be running for the app to load. Debug builds fetch JavaScript from the dev server over WiFi — without it, the app will show an "unable to load script" error.

## Usage

1. **Sign in** with Google or Apple on both devices
2. **Camera device** (old phone): Select "Camera" mode → grant camera/microphone permissions → the phone starts monitoring
3. **Viewer device** (primary phone): Select "Viewer" mode → see your paired cameras → tap to view live stream
4. **Configure detection**: On the camera device, choose a detection mode (Security / Baby / Pet / Custom) and adjust sensitivity

## Firestore Data Model

```
firestore/
├── users/{userId}
│   └── fcmTokens: { [deviceId]: "token_string" }  # FCM push tokens per device
│
├── devices/{deviceId}
│   ├── userId: string              # Owner (Firebase Auth UID)
│   ├── name: string                # Display name (e.g. "Living Room")
│   ├── role: "camera" | "viewer"
│   ├── mode: "security" | "baby" | "pet" | "custom"
│   ├── status: "online" | "offline"
│   ├── lastSeen: Timestamp
│   └── settings:
│       ├── motionSensitivity: number (0-1)
│       ├── soundSensitivity: number (0-1)
│       ├── personSensitivity: number (0-1)
│       ├── recordingDurationSec: number
│       └── videoQuality: "low" | "medium" | "high"
│
├── events/{eventId}
│   ├── deviceId: string            # Which camera triggered this
│   ├── userId: string              # Owner
│   ├── type: "person" | "motion" | "sound"
│   ├── soundClass: string | null   # e.g. "baby_cry", "dog_bark"
│   ├── confidence: number (0-1)
│   ├── timestamp: Timestamp
│   ├── clipPath: string | null     # Local file path (currently unused)
│   └── clipDurationSec: number
│
└── sessions/{sessionId}            # WebRTC signaling
    ├── cameraDeviceId: string
    ├── viewerDeviceId: string | null
    ├── offer: string | null        # SDP offer from camera
    ├── answer: string | null       # SDP answer from viewer
    ├── status: "waiting" | "connected" | "closed"
    ├── createdAt: Timestamp
    └── candidates/{candidateId}    # ICE candidates subcollection
        ├── candidate: string
        ├── sdpMLineIndex: number
        ├── sdpMid: string
        ├── from: "camera" | "viewer"
        └── createdAt: Timestamp
```

**Data ownership:** All data is scoped by `userId` (Firebase Auth UID). A user's viewer device queries `devices` and `events` by `userId` to see only their own cameras and detection history. Sessions are looked up by `cameraDeviceId`.

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
│   │   ├── native/       # Custom native module bridges (PixelCopy)
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

### Plan 1: Foundation (Complete)

Project setup, authentication, navigation, and camera preview.

- [x] Task 1: Project initialization (Expo bare workflow + dependencies)
- [x] Task 2: TypeScript type definitions
- [x] Task 3: Firebase and WebRTC configuration
- [x] Task 4: Auth service (Firebase Auth with Google/Apple)
- [x] Task 5: Device service (Firestore device registration)
- [x] Task 6: Auth store (Zustand)
- [x] Task 7: Device store (Zustand)
- [x] Task 8: Loading component
- [x] Task 9: Login screen
- [x] Task 10: Role select screen
- [x] Task 11: Camera preview screen
- [x] Task 12: Viewer device list screen (stub)
- [x] Task 13: Root navigator (auth-gated)
- [x] Task 14: End-to-end verification

### Plan 2: Detection Engine (Complete)

On-device AI detection pipeline with motion gating, ML Kit object detection, YAMNet sound classification, event management with debounce, local clip recording, and detection settings UI.

- [x] Task 1: Detection types and mode configurations
- [x] Task 2: Firestore events service
- [x] Task 3: Detection store (Zustand)
- [x] Task 4: Motion detector (frame skip gate)
- [x] Task 5: ML Kit object detector
- [x] Task 6: YAMNet sound detector with class mapping
- [x] Task 7: Event manager (debounce + mode-based alert levels)
- [x] Task 8: Local clip recorder
- [x] Task 9: Camera preview detection integration
- [x] Task 10: Camera settings screen with mode selection

#### Known Limitations & Notes

- **Motion detection** — Detection now uses **native pixel-level frame comparison** (`ScreenCaptureModule.detectMotion()`) instead of ML Kit bounding boxes. Each frame is downscaled to 64x48 and compared pixel-by-pixel against the previous frame. If more than 5% of pixels change significantly, motion is detected. ML Kit's object detection was unreliable for motion — it kept locking onto background objects with stable bounding boxes regardless of foreground movement. ML Kit is still available for future person-specific detection via Face Detection or a custom TFLite model (e.g., MobileNet SSD).
- **YAMNet model file** — The YAMNet TFLite model (`assets/models/yamnet.tflite`, ~3.9MB) is gitignored due to its size. After cloning, download it manually:
  ```bash
  mkdir -p assets/models
  curl -L -o assets/models/yamnet.tflite \
    "https://tfhub.dev/google/lite-model/yamnet/classification/tflite/1?lite-format=tflite"
  ```
- **Sound detection** — The YAMNet classification logic is implemented but audio capture integration (`react-native-audio-api`) is deferred. The package caused Android native build failures (missing codegen/JNI directory) and was removed. Sound detection will be wired up in a future update when the package compatibility is resolved.
- **Unified camera architecture** — The camera preview uses WebRTC's `getUserMedia` as the sole camera source, displayed via `RTCView`. Detection captures frames using a custom **PixelCopy native module** (`ScreenCaptureModule.kt`) that finds the SurfaceView in the view hierarchy and uses Android's `PixelCopy.request()` to capture its content. Standard screenshot APIs (`captureScreen`, `ViewShot`) cannot capture SurfaceView/RTCView on Android — they render on a separate hardware surface. This unified approach eliminates the Android camera conflict that occurred when VisionCamera and WebRTC both competed for camera access, and enables simultaneous detection and streaming.
- **Clip recording format** — Event clips are recorded as a sequence of JPEG frames (PixelCopy snapshots) under the app document directory (`clips/clip_<timestamp>/`). `clipPath` stores the metadata JSON path for each clip. This keeps recording compatible with the WebRTC camera pipeline without opening a second camera session. The current viewer UI shows clip duration metadata in the event list; in-app clip playback is not implemented yet.
- **Detection frequency** — The detection loop runs every 2 seconds via `setInterval` with PixelCopy snapshots. This is intentional to conserve CPU/battery on old devices, but means detection is not real-time.
- **Audio routing** — WebRTC defaults audio to the earpiece on Android. A custom `AudioRoutingModule` native module forces loudspeaker on the viewer side when a remote stream connects. On Android 12+ (API 31), it uses the `setCommunicationDevice()` API since the legacy `setSpeakerphoneOn()` is deprecated and silently ignored. It retries multiple times to override WebRTC's audio routing.
- **Event debounce** — Same event type is suppressed for 30 seconds after triggering to prevent notification spam. Different event types (e.g., dog bark vs glass break) are debounced independently.
- **Firebase namespaced API deprecation** — The app currently uses Firebase's namespaced API (v21), which shows deprecation warnings. These are non-blocking. Migration to the modular API (v22) is planned but not required for functionality.
- **Device registration** — Device registration now checks for an existing device with the same user and role before creating a new document. Previously, selecting Camera/Viewer role would create a duplicate device entry in Firestore on every tap.
- **Signaling listener fix** — The `onAnswer` and `onOffer` Firestore listeners now fire only once (using `.get()` after detecting a change) instead of re-triggering on every document update. Previously, the listeners would repeatedly process the same SDP, causing excessive Firestore reads/writes and unstable connections.
- **Session auto-rebuild** — The camera automatically rebuilds the WebRTC session when a viewer disconnects, allowing the viewer to reconnect without the camera needing to be restarted.
- **Camera name editing** — Cameras can be renamed from both the camera settings screen (tap the name card) and the viewer device list (tap the camera name in the card header). Changes are saved to Firestore and reflected immediately in the local store.
- **Signaling security** — Firestore rules enforce that only the camera owner can create sessions, and viewers can only write answers/candidates to sessions belonging to cameras they own. The signaling service validates `userId` ownership before creating or joining sessions.
- **Cross-network streaming** — TURN fallback via Cloudflare Calls has been verified for viewer access from a separate mobile data network, not just the same Wi-Fi LAN.

### Plan 3: Streaming & Viewer (In Progress)

WebRTC P2P streaming, Firestore signaling, viewer live view, FCM push notifications, and an event list with clip metadata.

- [x] Task 1: WebRTC peer connection service (STUN/TURN, offer/answer/ICE)
- [x] Task 2: Firestore signaling service (session lifecycle, SDP/ICE exchange)
- [x] Task 3: Stream store (Zustand)
- [x] Task 4: Camera-side streaming integration
- [x] Task 5: Live view screen (viewer WebRTC stream display)
- [x] Task 6: Event list screen (detection history timeline)
- [x] Task 7: FCM push notifications (messaging service + Cloud Function trigger)
- [ ] Task 8: End-to-end testing
- [x] Task 9: TURN server integration testing (Cloudflare Calls credentials + cross-network verification)

#### Cloud Functions Setup

Cloud Functions are optional and only used for FCM push fan-out:

- `onEventCreated` sends push notifications when new events are created

Deploy functions only if you want push notifications:

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

If you stay on Firebase Spark (no billing), skip this section. TURN credential issuance can run fully on Cloudflare Worker as documented above.

## Contributing

Contributions are welcome! Please read the design spec at `docs/superpowers/specs/2026-03-23-ai-vision-monitor-design.md` for architectural context before making changes.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open-source and free to use.
