# Camera Request Monitor

Android diagnostics app for inspecting WebRTC `getUserMedia()` video constraints and the browser-selected `MediaTrackSettings` inside an Android WebView.

The app does not replace cameras, alter streams, record video, read frames, upload diagnostics, use analytics, or add third-party SDKs. It only injects a local JavaScript monitor from `app/src/main/assets/camera_monitor.js` and displays request/settings details in a Shadow DOM overlay.

## Build

GitHub Actions builds a debug APK with:

```bash
./gradlew assembleDebug
```

The artifact is named `CameraRequestMonitor-APK` and contains `app-debug.apk`.
