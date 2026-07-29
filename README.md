# PromptIt Mobile

React Native (Expo) mobile app for the PromptIt AI production platform. Mirror of the web app with native iOS and Android experiences.

## Prerequisites

- **Node.js** 18+
- **Expo CLI** (`npm install -g expo-cli`) or use `npx expo`
- **EAS CLI** (`npm install -g eas-cli`) for cloud builds
- An Expo account (for EAS Build) — sign up at https://expo.dev

## Setup

```bash
cd promptit-mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or press `i` for iOS Simulator / `a` for Android Emulator.

> **Note:** Expo SDK 53 requires ~400MB for `node_modules`. This sandbox has a 300MB filesystem limit, so `npm install` must be run on a machine with adequate disk space. No local Xcode or Android Studio is required — all native builds run in the cloud via EAS.

## Backend

- **Base URL:** `https://prompt-it-web.onrender.com`
- **Auth:** Bearer tokens stored in AsyncStorage (`prompt_it_token`)
- The API base URL is configured via `EXPO_PUBLIC_API_URL` environment variable and defaults to the Render backend above. See `app.json` → `extra.backendUrl`.

## Project Structure

```
src/
  app/
    _layout.tsx            # Root layout (SafeAreaProvider + AuthProvider)
    (auth)/
      _layout.tsx          # Auth group layout
      index.tsx            # Login screen
      register.tsx         # Registration screen
    (app)/
      _layout.tsx          # Protected route guard
      index.tsx            # Dashboard placeholder
  contexts/
    AuthContext.tsx         # Auth context + provider
  services/
    api.ts                  # Typed API client (40+ endpoints)
assets/
  icon.png                 # 1024×1024 app icon
  adaptive-icon.png        # Android adaptive icon
  splash-icon.png          # 1284×2778 splash screen
  favicon.png              # Web favicon
scripts/
  generate-icons.js        # Pure Node.js icon generator (no deps)
```

## EAS Build Commands

### Development Build
For local development with custom native modules and debugging:
```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

### Preview (Internal Distribution)
For sharing with testers via Expo internal distribution:
```bash
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

### Production (Store Submission)
For App Store / Google Play submission with auto-incrementing versions:
```bash
eas build --profile production --platform ios
eas build --profile production --platform android
```

### EAS Submit
After a production build, submit directly to stores:
```bash
eas submit --platform ios
eas submit --platform android
```

## Build Profiles

| Profile       | Distribution | iOS Target | Android Target | Notes                          |
|--------------|-------------|------------|----------------|---------------------------------|
| development  | internal    | Simulator  | APK            | `developmentClient: true`       |
| preview      | internal    | iOS 15.0+  | APK            | Internal testing                |
| production   | store       | iOS 15.0+  | AAB (bundle)   | Auto-increment versioning       |

## App Identifiers

- **iOS Bundle ID:** `com.promptit.app`
- **Android Package:** `com.promptit.app`

## Regenerating Icons

```bash
node scripts/generate-icons.js
```

Generates `icon.png` (1024×1024), `adaptive-icon.png` (1024×1024), `splash-icon.png` (1284×2778), and `favicon.png` (48×48) — all with the PromptIt dark theme (`#080a0f` background, `#43f5d5` cyan text). No external dependencies required.

## Scripts

- `npm start` — start Expo dev server
- `npm run android` — start on Android
- `npm run ios` — start on iOS
- `npm run web` — start web version
- `npm run ts:check` — TypeScript type-check
