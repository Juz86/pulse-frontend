# Pulse Deployment Targets

Pulse has two intentional frontend targets:

- `pulse-messenger.com`: public landing website only. No login, no chat app, no E2EE bootstrap.
- `web.pulse-messenger.com`: full Pulse web app with parent/child login, chat, E2EE and account flows.

## Cloudflare Pages: landing

Use this for `pulse-messenger.com`.

- Build command: `npm run build:landing`
- Build output directory: `build`
- Environment variables:
  - `REACT_APP_SITE_TARGET=landing`
  - `REACT_APP_WEB_APP_URL=https://web.pulse-messenger.com`

Before deploying, run:

```bash
npm run verify:landing
```

This builds the landing target and checks that app-only code such as auth modals, chat screens, E2EE bootstrap and call UI are not included in the generated landing JavaScript.

The landing build also writes and verifies a stricter `build/_headers` file. Its CSP does not allow Firebase, the Pulse API, websocket connections or FCM, because the public landing site should not perform login, chat or E2EE work.

## Cloudflare Pages: web app

Use this for `web.pulse-messenger.com`.

- Build command: `npm run build:webapp`
- Build output directory: `build`
- Environment variables:
  - `REACT_APP_SITE_TARGET=webapp`
  - `REACT_APP_BACKEND_URL=https://api.pulse-messenger.com`
  - `REACT_APP_WEB_APP_URL=https://web.pulse-messenger.com`
  - `REACT_APP_VAPID_KEY=...`
  - `REACT_APP_SENTRY_DSN=...`
  - `REACT_APP_E2EE_MODE=...`
  - `REACT_APP_E2EE_TRANSPORT=...`

Before deploying, run:

```bash
npm run verify:webapp
```

The web app build writes and verifies the broader `build/_headers` file that allows the Pulse API, Firebase, FCM and websocket connections needed by the authenticated app.

## Runtime behavior

On the landing target, navigation buttons for `Aanmelden`, `Kind` and `Ouder` redirect to `web.pulse-messenger.com` with query parameters such as:

```text
https://web.pulse-messenger.com/?role=parent&mode=login
https://web.pulse-messenger.com/?role=parent&mode=register
https://web.pulse-messenger.com/?role=child&mode=login
```

On the web app target, those query parameters open the existing parent or child login modal without replacing the app route.

## Important

`npm run build` is intentionally a web app fallback and writes webapp headers. For production domains, use the explicit target commands above so the landing site and web app stay separated.
