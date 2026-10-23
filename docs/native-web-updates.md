# Pulse native web updates

Pulse Android keeps its native shell, Capacitor plugins and origin unchanged. It can only download a signed web bundle from `https://web.pulse-messenger.com`, verify it locally, and let Capacitor serve it from the app's private storage on the next app start.

## Security model

- The Android app contains only `PULSE_NATIVE_UPDATE_PUBLIC_KEY`.
- `PULSE_NATIVE_UPDATE_SIGNING_PRIVATE_KEY` is a Cloudflare Pages build secret. Never commit or place it in an Android build.
- The manifest is signed with ECDSA P-256 and binds the version, URL, SHA-256 and exact bundle size.
- Android accepts only HTTPS URLs on `web.pulse-messenger.com`, does not follow redirects, checks bundle limits and rejects ZIP path traversal.
- A newly activated bundle must acknowledge a healthy app start. Without that acknowledgement, the following cold start restores the prior bundle.

## One-time key setup

On a trusted developer machine, run:

```bash
node scripts/generate-native-update-keypair.js
```

Store the output values as follows:

| Value | Location |
| --- | --- |
| `PULSE_NATIVE_UPDATE_SIGNING_PRIVATE_KEY` | Cloudflare Pages **secret** for the `pulse-frontend` production build |
| `PULSE_NATIVE_UPDATE_PUBLIC_KEY` | `security/native-update/public-key-spki-base64.txt`; an environment variable may override it for an intentional rotation test |

The private value is only for the Pages build; it must never be sent to Android, the browser, GitHub, Railway or chat.
The public half is deliberately versioned so every Android artifact can be
traced to the exact update-signing identity it trusts. Rotation metadata and
the public-key fingerprint live in `security/native-update/key-metadata.json`.

## Cloudflare Pages build

Use this production build command:

```bash
npm ci && npm run build:webapp:native
```

Cloudflare Pages supplies `CF_PAGES_COMMIT_SHA`, which becomes the immutable update version. The build publishes:

- `/native-updates/latest.json` — never cached;
- `/native-updates/pulse-web-<commit>.zip` — immutable and cacheable.

The packaging script safely skips generation when the signing secret is intentionally absent, for example on preview builds.

## Android release

Build the next Android release with the versioned public key:

```bash
npm run android:build:play
```

This requires a new Google Play release once. After testers install that release, ordinary Pulse web/UI changes can be staged via the signed Pages bundle and take effect after the next cold app start. Native permissions, Capacitor plugins and Android code still require a Play release.
