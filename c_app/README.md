# Drishti — AI-Powered Vision Assistant

**See Beyond Vision.**

Drishti is a React Native (CLI / bare) assistive companion for visually impaired and low-vision users. Phase 1 delivers the full mobile foundation: voice assistant, TTS, speech recognition, camera assistance UI, accessibility settings, and a mock detection layer ready for YOLO26x in Phase 2.

> **Not Expo.** This is a native React Native CLI project with Android and iOS folders.

> **Phase 1 detection is DEMO MODE only.** Object data comes from `MockDetectionProvider`. No YOLO model is connected.

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

## Current UX (simple mode + laptop GPU)

App opens **directly to full-screen camera** with **one mic button** (same idea as `blind_v1.py` + key **M**).

Phone captures frames → laptop runs **YOLO26x on CUDA** → detections return for TTS / voice answers.

### 1. Start GPU server on this PC

```powershell
cd C:\Users\srane\OneDrive\Desktop\Drishti\server
.\start.ps1
```

Server: `http://0.0.0.0:8765`  
Phone uses Wi‑Fi IP in `c_app/src/core/utils/serverConfig.ts` (currently `192.168.0.108`).

### 2. Run the app

Same Wi‑Fi as the laptop. Keep Metro running, then `npm run android`.

Allow Windows Firewall inbound TCP **8765** if the phone cannot connect.

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

**Phase 2 integration point:** implement a real `DetectionProvider` (YOLO26x adapter) and swap it in `src/domain/detection/detectionRuntime.ts`. UI, voice, and query layers stay unchanged.

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
