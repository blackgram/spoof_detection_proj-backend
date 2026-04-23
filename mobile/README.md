# Spoof Detection Mobile

React Native (Expo) mobile app for face verification and spoof detection. Connects to the same backend API as the web frontend.

## Features

- **ID Photo**: Pick from gallery or camera roll
- **Selfie Capture**: Take a live selfie with front camera
- **Verification**: Sends both images to backend for liveness check + face matching

## Setup

```bash
# Install dependencies (already done if created with create-expo-app)
npm install

# Start the app
npx expo start
```

Then:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go on physical device

## Backend URL

The app connects to `http://localhost:8000` by default. For different environments:

- **iOS Simulator**: `localhost` works
- **Android Emulator**: Use `http://10.0.2.2:8000` (Android maps localhost differently)
- **Physical device**: Use your computer's IP, e.g. `http://192.168.1.x:8000`

Set via environment variable:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000 npx expo start
```

Or create `.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000
```

## iOS Push Notifications (development build)

When building with `npx expo run:ios --device`, push notifications require the **Push Notifications** capability on your App ID and a provisioning profile that includes it. If you see:

- `Provisioning profile "..." doesn't include the Push Notifications capability`
- `doesn't include the aps-environment entitlement`

do the following:

1. Go to [Apple Developer](https://developer.apple.com) → **Certificates, Identifiers & Profiles** → **Identifiers**.
2. Select your App ID (`com.blackgram.spoofdetectionmobile`).
3. Under **Capabilities**, enable **Push Notifications** and save.
4. In Xcode: **Product → Clean Build Folder**, then run again.  
   Or in Xcode **Settings → Accounts → [Your Apple ID] → Download Manual Profiles**, then rebuild.

After the App ID has Push Notifications enabled, Xcode will use (or create) a provisioning profile that includes the `aps-environment` entitlement and the build should succeed.

## Make sure backend is running

1. Start the backend from the project root:
   ```bash
   cd ../backend && python run.py
   # or: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. Use `--host 0.0.0.0` when testing on physical device so the API is reachable from the network.

## Project structure

```
mobile/
├── App.tsx
├── src/
│   ├── api/
│   │   └── verify.ts
│   ├── config.ts
│   └── components/
│       ├── CameraCapture.tsx
│       ├── ImagePicker.tsx
│       └── ResultDisplay.tsx
└── app.json
```
