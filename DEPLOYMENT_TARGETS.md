# Pulse Deployment Targets

Pulse has two intentional frontend targets:

- `pulse-messenger.com`: public landing website only. No login, no chat app, no E2EE bootstrap.
- `web.pulse-messenger.com`: full Pulse web app with parent/child login, chat, E2EE and account flows.

## Cloudflare Pages: landing

Use this for `pulse-messenger.com`.

- Build command: `npm run build:landing`
- Build output directory: `build`
- Environment example: `.env.landing.example`
- Environment variables:
  - `REACT_APP_SITE_TARGET=landing`
  - `REACT_APP_WEB_APP_URL=https://web.pulse-messenger.com`
  - `REACT_APP_SENTRY_DSN=...` optional

Cloudflare Pages settings:

- Project/custom domain: `pulse-messenger.com`
- Production branch: `main`
- Build command: `npm run build:landing`
- Build output directory: `build`
- Environment variable: `REACT_APP_SITE_TARGET=landing`
- Environment variable: `REACT_APP_WEB_APP_URL=https://web.pulse-messenger.com`

Before deploying, run:

```bash
npm run verify:landing
```

This builds the landing target and checks that app-only code such as auth modals, chat screens, E2EE bootstrap and call UI are not included in the generated landing JavaScript.

The landing build also writes and verifies a stricter `build/_headers` file. Its CSP does not allow Firebase, the Pulse API, websocket connections or FCM, because the public landing site should not perform login, chat or E2EE work.

After deploy, check:

```bash
curl -I https://pulse-messenger.com
```

Confirm that the `content-security-policy` header does not include `api.pulse-messenger.com`, Firebase, FCM or websocket sources.

## Cloudflare Pages: web app

Use this for `web.pulse-messenger.com`.

- Build command: `npm run build:webapp`
- Build output directory: `build`
- Environment example: `.env.webapp.example`
- Environment variables:
  - `REACT_APP_SITE_TARGET=webapp`
  - `REACT_APP_BACKEND_URL=https://api.pulse-messenger.com`
  - `REACT_APP_WEB_APP_URL=https://web.pulse-messenger.com`
  - `REACT_APP_VAPID_KEY=...`
  - `REACT_APP_SENTRY_DSN=...`
  - `REACT_APP_E2EE_MODE=...`
  - `REACT_APP_E2EE_TRANSPORT=...`

Cloudflare Pages settings:

- Project/custom domain: `web.pulse-messenger.com`
- Production branch: `main`
- Build command: `npm run build:webapp`
- Build output directory: `build`
- Environment variable: `REACT_APP_SITE_TARGET=webapp`
- Environment variable: `REACT_APP_WEB_APP_URL=https://web.pulse-messenger.com`
- Environment variable: `REACT_APP_BACKEND_URL=https://api.pulse-messenger.com`

Before deploying, run:

```bash
npm run verify:webapp
```

The web app build writes and verifies the broader `build/_headers` file that allows the Pulse API, Firebase, FCM and websocket connections needed by the authenticated app.

After deploy, check:

```bash
curl -I https://web.pulse-messenger.com
```

Confirm that the `content-security-policy` header includes `api.pulse-messenger.com`, Firebase, FCM and websocket sources.

You can also verify both live deployments automatically:

```bash
npm run verify:deployed-targets
```

In GitHub Actions, run the manual workflow `Verify Deployed Targets` after a Cloudflare deploy to check the live headers without blocking every PR on external network availability. The workflow has a `target` input with `all`, `landing` and `webapp`, so one target can be checked while the other is still being configured.

The live checker follows same-host redirects, but fails if a target redirects to a different host. It also checks that the live response is a successful HTML document. That helps catch accidental domain swaps between the landing site and the web app.

Optional custom domains:

```bash
PULSE_LANDING_URL=https://pulse-messenger.com PULSE_WEBAPP_URL=https://web.pulse-messenger.com npm run verify:deployed-targets
```

Verify only one target while DNS is still being set up:

```bash
PULSE_VERIFY_TARGET=landing npm run verify:deployed-targets
PULSE_VERIFY_TARGET=webapp PULSE_WEBAPP_URL=https://your-webapp-pages-url.pages.dev npm run verify:deployed-targets
```

## Troubleshooting live target failures

If `npm run verify:deployed-targets` reports:

```text
landing: CSP must not include api.pulse-messenger.com
landing: CSP must not include firebaseio.com
landing: CSP must not include firebaseapp.com
landing: CSP must not include fcm.googleapis.com
landing: CSP must not include firebasestorage.googleapis.com
landing: CSP must not include wss://api.pulse-messenger.com
```

Then `pulse-messenger.com` is still serving the web app build or web app headers. In Cloudflare Pages, open the Pages project that owns `pulse-messenger.com` and set:

- Build command: `npm run build:landing`
- Build output directory: `build`
- Environment variable: `REACT_APP_SITE_TARGET=landing`
- Environment variable: `REACT_APP_WEB_APP_URL=https://web.pulse-messenger.com`

Redeploy that Pages project after saving the settings.

If the verifier reports:

```text
webapp: getaddrinfo ENOTFOUND web.pulse-messenger.com
```

Then the web app domain is not live in DNS yet. In Cloudflare Pages, open the Pages project that should host the authenticated app and add:

- Custom domain: `web.pulse-messenger.com`
- Build command: `npm run build:webapp`
- Build output directory: `build`
- Environment variable: `REACT_APP_SITE_TARGET=webapp`
- Environment variable: `REACT_APP_WEB_APP_URL=https://web.pulse-messenger.com`
- Environment variable: `REACT_APP_BACKEND_URL=https://api.pulse-messenger.com`

After Cloudflare shows the custom domain as active, run:

```bash
npm run verify:deployed-targets
```

## Runtime behavior

On the landing target, navigation buttons for `Aanmelden`, `Kind` and `Ouder` redirect to `web.pulse-messenger.com` with query parameters such as:

```text
https://web.pulse-messenger.com/?role=parent&mode=login
https://web.pulse-messenger.com/?role=parent&mode=register
https://web.pulse-messenger.com/?role=child&mode=login
```

On the web app target, those query parameters open the existing parent or child login modal without replacing the app route.

## Important

`npm run build` is intentionally landing-safe and writes landing headers. For `web.pulse-messenger.com`, always use the explicit `npm run build:webapp` command so the authenticated web app keeps its required API, Firebase, FCM and websocket permissions.
