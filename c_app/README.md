# Drishti — AI-Powered Vision Assistant

**See Beyond Vision.**

Drishti is a React Native (CLI / bare) assistive companion for visually impaired and low-vision users. The Android app includes voice assistance, accessible UDID scanning, and live camera detection through a free local laptop server.

> **Not Expo.** This is a native React Native CLI project with Android and iOS folders.

> Live object detection and UDID OCR require the local server and its model/OCR dependencies. Detection is not available offline on the phone in this build.

---

## Requirements

### Common
- Node.js 18+
- npm 9+

### Android (primary target)
- Android Studio with Android SDK
- JDK 17+ (Android Studio JBR works)
- Android emulator or physical device
- Environment variables:
  - `JAVA_HOME` → JDK / Android Studio JBR
  - `ANDROID_HOME` → Android SDK path

### iOS (Mac only)
- Xcode 15+
- CocoaPods (`sudo gem install cocoapods` or Homebrew)

---

## Project location

```text
c_app/
```

---

## Install

```bash
cd c_app
npm install
```

### iOS pods (Mac)

```bash
cd ios
pod install
cd ..
```

---

## Run — Android

```bash
# Terminal 1
npm start

# Terminal 2
npm run android
```

Or build + install in one step:

```bash
npm run android
```

### Windows PowerShell tip

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
# Short Gradle cache avoids Windows 260-char path failures with Reanimated/CMake
$env:GRADLE_USER_HOME = "C:\g"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

# Run from the app root (already inside c_app — do not cd c_app again)
cd C:\Users\srane\OneDrive\Desktop\Drishti\c_app
npm start

# New terminal with the same env vars, then:
npm run android
```

You need a running emulator or a USB phone with debugging enabled. If `installDebug` fails with **No connected devices**, create a Virtual Device in Android Studio (**Device Manager → Create Device**) or plug in a phone, then run `npm run android` again.

---

## Run — iOS

```bash
cd c_app
npm start
# new terminal
npm run ios
```

---

## Live camera and UDID scanning (local network)

From Home, choose **Start Camera Assistance** to capture frames, send them to the laptop detector, show returned detections, and hear nearby objects announced. Spoken detections below 0.40 confidence are suppressed, and queued detection speech is replaced when a newer frame changes the result. Choose **Scan disability ID** to read a UDID card with the phone camera and local OCR. Auto-scan begins when the ID number and Disability Type are readable; the full card does not need to fit in the frame. Both flows require the laptop server; no paid cloud service is used.

The server loads the model once and stays running for both features. Running `start.ps1` again reuses an existing healthy local server instead of starting another copy.

### 1. Start the local detection server on this PC

```powershell
cd C:\Users\srane\Aankhbanadi\server
.\start.ps1
```

The server uses the laptop GPU when available and CPU otherwise. It loads the model once and stays running.
The phone uses the laptop Wi-Fi IP in `src/core/utils/serverConfig.ts`. Keep it aligned with the address printed by `start.ps1` and allow Windows Firewall inbound TCP **8765** on private networks.

### 2. Install and use the app

Install `dist/android/Drishti-release.apk` on the phone and keep the phone and laptop on the same Wi-Fi. Metro is not needed for an installed release APK. The local laptop server must remain running for object detection and UDID OCR; no paid cloud is used.

---

## Architecture (high level)

```text
src/
  app/navigation/          React Navigation (stack + tabs)
  components/              Shared accessible UI
  features/                Home, camera, ask, activity, settings, onboarding
  core/services/           TTS, STT, permissions, storage, voice assistant
  core/state/              Zustand stores
  domain/assistant/        IntentParser, ResponseGenerator, AssistantController
  domain/detection/        DetectionProvider + MockDetectionProvider + grouping/query
  domain/announcements/    AnnouncementManager + queue
  theme/                   Light/dark design system
```

**Accuracy note:** model weights and a validation dataset are not stored in this repository. A prior “76%” result cannot be independently verified here, and changing inference thresholds without measuring precision/recall could make safety alerts less reliable. Use `accuracy.py` with the exact weights and COCO validation data to compare measured mAP before tuning.

## Build Android APK

On Windows, with Node.js, Android Studio/JDK 17, and Android SDK installed:

```powershell
cd c_app
npm ci
npm run release:android
```

The installable APK is written to `dist/android/Drishti-release.apk`. This release uses the repository's debug signing key and is intended for testing, not Play Store publication.

---

## Permissions

Requested **contextually** (not all at launch):

- **Camera** — when starting camera assistance
- **Microphone** — when activating push-to-talk

Configured in:

- Android: `android/app/src/main/AndroidManifest.xml`
- iOS: `ios/Drishti/Info.plist` + `ios/Podfile` (`setup_permissions`)

---

## Native notes

- **New Architecture is disabled** (`newArchEnabled=false`) for broader TTS / Voice compatibility.
- Gesture Handler is imported first in `index.js`.
- Reanimated Babel plugin is last in `babel.config.js`.
- Speech recognition on Android typically needs Google speech services; physical devices are more reliable than some emulators.
- iOS speech recognition requires a **physical device**.

---

## Useful scripts

```bash
npm start          # Metro bundler
npm run android    # Build & run Android
npm run ios        # Build & run iOS
npx tsc --noEmit   # Typecheck
```

---

## Privacy (Phase 1)

- Push-to-talk by default — no continuous listening without user action
- No microphone recordings stored by default
- No camera frames sent to external services
- History and preferences stay on-device via AsyncStorage
- Demo detections are clearly labelled — never presented as verified safety advice

---

## License

Private project — Drishti assistive technology foundation.
