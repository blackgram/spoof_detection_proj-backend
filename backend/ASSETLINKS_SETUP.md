# Step-by-step: Android assetlinks.json for passkeys

Android needs **Digital Asset Links** so it can trust your app for passkeys. The backend serves `/.well-known/assetlinks.json`; you must use a **public HTTPS domain** (e.g. ngrok) and add your app’s **SHA-256 certificate fingerprint** to config.

---

## 1. Get your Android app’s SHA-256 fingerprint

Use the **same keystore** you use to build the app (debug or release).

**Debug builds (typical for `npx expo run:android`):**

Expo/React Native often put the debug keystore in the project. Try in order:

```bash
# Project keystore (created when you first ran expo run:android)
keytool -list -v -keystore mobile/android/app/debug.keystore -alias androiddebugkey -storepass android
```

```bash
# Or the default Android SDK location (if you built from Android Studio before)
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android
```

- If the keystore is elsewhere (e.g. EAS or custom path), use that path and its password/alias.
- In the output, find **SHA256:** and copy the fingerprint (e.g. `AB:CD:EF:12:34:...`). Use that value in step 4.

**Release / EAS builds:**

- Use the keystore you use for signing (e.g. from EAS or your own file).
- Run the same `keytool -list -v -keystore <path> -alias <alias>` with that keystore’s password and alias, then copy the **SHA256** line.

---

## 2. Expose the backend with a public HTTPS URL

Android and FIDO2 require a **real domain over HTTPS** for asset links and RP ID. For local dev, use **ngrok** (or similar).

1. Install ngrok: https://ngrok.com/download (or `brew install ngrok`).
2. Start your backend on port 8000 (e.g. `./run-local.sh` or `uvicorn app.main:app --host 0.0.0.0 --port 8000`).
3. In another terminal:

   ```bash
   ngrok http 8000
   ```

4. Copy the **HTTPS** URL ngrok shows (e.g. `https://abc123.ngrok-free.app`).  
   Use only the **hostname** (no `https://`) for the next steps, e.g. `abc123.ngrok-free.app`.

---

## 3. Configure the backend

In `backend/.env`:

1. **FIDO2 RP ID** = ngrok hostname (no `https://`, no port):

   ```env
   FIDO2_RP_ID=abc123.ngrok-free.app
   FIDO2_RP_NAME=AccessMore
   ```

2. **Android asset links** = package name + SHA-256 fingerprint from step 1:

   ```env
   ANDROID_PACKAGE_NAME=com.blackgram.spoofdetectionmobile
   ANDROID_SHA256_CERT_FINGERPRINTS=AB:CD:EF:12:34:56:78:90:...
   ```

   Use the full SHA256 string from `keytool` (with colons). For multiple fingerprints (e.g. debug + release), separate with commas (no spaces):

   ```env
   ANDROID_SHA256_CERT_FINGERPRINTS=AA:BB:...,CC:DD:...
   ```

3. Restart the backend so it reloads `.env`.

---

## 4. Check that assetlinks.json is served

With the backend running (and ngrok pointing at it), open in a browser:

- `https://<your-ngrok-host>/.well-known/assetlinks.json`

Example: `https://abc123.ngrok-free.app/.well-known/assetlinks.json`

You should see JSON with your `package_name` and `sha256_cert_fingerprints`. If fingerprints are missing, double-check `ANDROID_SHA256_CERT_FINGERPRINTS` in `.env`.

---

## 5. Point the mobile app at the same domain

The app must call your backend (and thus FIDO2) at the **same** domain you use for RP ID and asset links.

In `mobile/.env.local`:

```env
EXPO_PUBLIC_API_URL=https://abc123.ngrok-free.app
```

(Use your real ngrok hostname; include `https://` here.)

Restart Metro (`npx expo start`) after changing `.env.local`.

---

## 6. Rebuild and run the Android app

1. Uninstall any existing app on the device/emulator if you had a different signing key (to avoid `INSTALL_FAILED_UPDATE_INCOMPATIBLE`).
2. Build and run:

   ```bash
   cd mobile
   npx expo run:android --device
   ```

3. Complete login and KYC, then trigger **Enable biometrics**. Passkey creation should now succeed because:
   - The backend’s FIDO2 RP ID matches the app’s origin (ngrok host).
   - Android can load `assetlinks.json` from that host and validate your app’s package + fingerprint.

---

## Troubleshooting

- **“RP ID cannot be validated” / “Unknown error”**  
  - Ensure the app uses **HTTPS** and the **exact same hostname** as `FIDO2_RP_ID` (e.g. ngrok URL in `EXPO_PUBLIC_API_URL`).
  - Ensure `/.well-known/assetlinks.json` returns your package and correct SHA256 (and that you’re using the fingerprint for the build you installed).

- **assetlinks.json has empty fingerprints**  
  - You didn’t set `ANDROID_SHA256_CERT_FINGERPRINTS` in `backend/.env`, or the backend wasn’t restarted. Set it and restart.

- **Different signing key (e.g. new machine)**  
  - Get a new SHA256 from the keystore you’re actually using and update `ANDROID_SHA256_CERT_FINGERPRINTS`. For debug, that’s usually `~/.android/debug.keystore`.

- **ngrok URL changes**  
  - Free ngrok gives a new hostname each run. Update `FIDO2_RP_ID` and `EXPO_PUBLIC_API_URL` each time, or use a fixed ngrok domain if you have one.
