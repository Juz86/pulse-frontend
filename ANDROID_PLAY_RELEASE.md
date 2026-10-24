# Pulse Android Play Release (Capacitor)

This project is prepared as a Capacitor Android app with:
- App name: `Pulse`
- App ID / package: `com.pulsemessenger.chat`
- Web build dir: `build`

## 1) Build web assets

```bash
npm run build:webapp
npx cap sync android
```

## 2) Open Android project

```bash
npx cap open android
```

## 3) Verify Android release config

Check:
- `android/app/build.gradle`
  - `applicationId "com.pulsemessenger.chat"`
  - `versionCode` increments every Play upload
  - `versionName` matches release version
- `android/variables.gradle`
  - `targetSdkVersion` current (now 36)

## 4) Firebase for Android (if using FCM in app)

If push notifications are required on Android:
- Download `google-services.json` from Firebase project settings (Android app `com.pulse.app`)
- Place it at:
  - `android/app/google-services.json`

Do not commit it unless your team policy explicitly allows that.

## 5) Generate signed App Bundle (.aab) in Android Studio

Android Studio:
1. `Build`
2. `Generate Signed Bundle / APK`
3. `Android App Bundle`
4. Choose `release`
5. Select/create keystore
6. Finish build

Expected output path (typical):
- `android/app/release/app-release.aab`
- or `android/app/build/outputs/bundle/release/app-release.aab`

## 6) Optional terminal build (after signing config is set)

```bash
cd android
GRADLE_USER_HOME=../.gradle-android ./gradlew :app:bundleRelease
```

Set `PULSE_NATIVE_UPDATE_PUBLIC_KEY` only when the separately signed native
web-update channel is part of the release. An empty value disables that channel
and does not disable Google Play updates. Record this as an explicit release
decision; never generate a replacement key during a release build.

Record the AAB hash and a Bundletool per-device size measurement in
`E2EE_RELEASE_DISTRIBUTION_AUDIT.md` before upload.

Verify that the version-bound notice inventory still matches the source:

```bash
npm run generate:android-release-notices
npm run verify:android-release-notices
```

The generation step resolves `releaseRuntimeClasspath` and records every
component, version, POM hash, inherited license source, and license metadata.
Review the generated snapshot before changing its hash in the release manifest.

The final upload gate must also pass. It intentionally fails while any legal,
notice, source-publication, signing, or security-review blocker remains:

```bash
npm run verify:android-release-distribution
```

## 7) Google Play Console Internal Testing checklist

For the explicitly unreviewed E2EE evaluation build, use:

```bash
npm run android:build:e2ee-internal-play
```

This produces the same-package `versionCode 82` build named
`1.0.26-internal-e2ee`. It enables the E2EE runtime but does not claim an
independent review. Upload it only to **Internal testing**. Do not promote this
artifact to closed, open, or production tracks. A later production candidate
must be rebuilt through `android:build:e2ee-pilot`, including the independent
review and release-distribution gates.

The internal build always starts from its embedded web assets and disables
signed web updates. This prevents an older production web bundle retained from
versionCode 81 or earlier from silently disabling the E2EE test runtime.

- App details:
  - App name
  - Short description
  - Full description
- Store listing assets:
  - 512x512 icon
  - Feature graphic
  - Phone screenshots
- Policy/compliance:
  - Privacy policy URL
  - Data safety form
  - Content rating questionnaire
  - Target audience and ads declaration
- Testing:
  - Create Internal testing track
  - Upload `.aab`
  - Add tester emails/group
  - Publish to Internal testing

## 8) Pre-upload sanity checks

- API base URLs are HTTPS in production
- No localhost URLs used in production runtime
- Compare Play's estimated download size with versionCode 81 before publishing.
  Investigate the native `libsignal` and WebRTC payload per ABI and exclude
  unsupported or unnecessary ABIs from the release bundle. Do not accept a
  significant size increase without recording the cause and target-device
  coverage impact.
- native web-update channel is either deliberately disabled or uses the
  established `PULSE_NATIVE_UPDATE_PUBLIC_KEY`
- Login/chat/call/video smoke-tested on real Android device
- `versionCode` incremented vs previous Play upload
- Exact Corresponding Source tag and third-party notices are published
- `npm run verify:android-release-distribution` succeeds
