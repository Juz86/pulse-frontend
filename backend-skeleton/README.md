# Pulse Backend Skeleton

Dit is een minimale backend-skeleton voor de eerste E2EE-serviceflow van Pulse voor chatten, bellen en videobellen.

## Doel

Deze map is geen complete productiebackend, maar een startpunt voor:

- `POST /devices/register`
- `GET /devices`
- `POST /devices/:deviceId/prekeys`
- `POST /devices/:deviceId/signed-prekey`
- `POST /devices/:deviceId/revoke`
- `GET /users/:userId/key-bundle`
- `POST /messages/send`
- `POST /messages/receipt`
- mixed `GET /api/messages/:convId`
- `DELETE /api/messages/:convId/:msgId`
- `POST /calls/start`
- socket auth en `message:new`
- socket compat voor `message:edit` -> `message:edited`
- parent policy admin-routes
- friend requests en contact-compatibiliteitsroutes

Belangrijk:

- media of bestanden versturen tussen gebruikers hoort niet bij de actieve productscope
- profielafbeeldingen of avatar-keuze vallen buiten deze berichten- en callskeleton
- oudere attachment-routes of smokes kunnen nog aanwezig zijn als historisch of intern referentiemateriaal
- de standaard backend-runtime mount geen attachment-routes meer
- de standaard backend-package exposeert ook geen attachment npm-scripts meer

## Structuur

- [src/server.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/server.js)
- [src/middleware/auth.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/middleware/auth.js)
- [src/middleware/asyncRoute.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/middleware/asyncRoute.js)
- [src/middleware/errorHandler.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/middleware/errorHandler.js)
- [src/middleware/requestContext.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/middleware/requestContext.js)
- [src/routes/devices.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/devices.js)
- [src/routes/apiMessages.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/apiMessages.js)
- [src/routes/contacts.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/contacts.js)
- [src/routes/friendRequests.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/friendRequests.js)
- [src/routes/keys.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/keys.js)
- [src/routes/messages.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/messages.js)
- [src/routes/calls.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/calls.js)
- [src/routes/parent.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/parent.js)
- [src/routes/users.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/users.js)
- [src/services/firestore.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/services/firestore.js)
- [src/services/parentPolicyService.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/services/parentPolicyService.js)
- [src/services/policyEvents.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/services/policyEvents.js)
- [src/socket/index.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/socket/index.js)
- [src/scripts/seed.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/scripts/seed.js)

## Parent Admin Routes

Deze skeleton bevat nu ook minimale routes voor:

- `GET /api/parent/children`
- `GET /api/parent/analytics/:childUid`
- `GET /api/parent/child/:childUid/policy`
- `PATCH /api/parent/child/:childUid/policy/features`
- `PATCH /api/parent/child/:childUid/policy/schedule`
- `GET /api/parent/child/:childUid/approved-contacts`
- `GET /api/parent/child/:childUid/contacts`
- `POST /api/parent/child/:childUid/approved-contacts`
- `PATCH /api/parent/child/:childUid/approved-contacts/:targetUid`
- `DELETE /api/parent/child/:childUid/approved-contacts/:targetUid`
- `POST /api/parent/child/:childUid/block-contact`
- `POST /api/parent/child/:childUid/unblock-contact`
- `POST /api/parent/child/:childUid/remove-contact`
- `GET /api/parent/activities`

Daarnaast bevat de skeleton nu ook frontend-compatibiliteitsroutes voor:

- `GET /api/messages/:convId`
- `DELETE /api/messages/:convId/:msgId`
- `GET /api/users/:uid/blocked`
- `POST /api/users/:uid/block`
- `POST /api/users/:uid/unblock`
- `GET /api/users/lookup-username`
- `GET /api/users/search`
- `GET /api/friend-requests/:uid`
- `POST /api/friend-requests`
- `POST /api/friend-requests/:requestId/accept`
- `POST /api/friend-requests/:requestId/decline`
- `DELETE /api/contacts/:uid/:targetUid`

Daarnaast ondersteunt de policieservice nu ook:

- quiet hours voor chat/call/video deny
- aparte call/video-beslissingen via `mayStartCall(...)`

## TURN Configuratie Voor Calls

Endpoint:

- `GET /api/turn-credentials` (app-origin protected)

Standaard geeft dit endpoint STUN-servers terug. Voor stabiele audio/video calls op mobiel, streng wifi en NAT/firewall netwerken moet je TURN configureren via env vars op de backend.

Ondersteunde configuraties:

1. `ICE_SERVERS_JSON` met volledige JSON-array van ICE servers (aanbevolen voor meerdere TURN endpoints).
2. `TURN_URLS`, `TURN_USERNAME`, `TURN_PASSWORD` als eenvoudige TURN-config.

Gedrag:

- Backend combineert geconfigureerde TURN/ICE servers met bestaande STUN fallback.
- Frontend haalt credentials runtime op via `/api/turn-credentials`.
- Er staan geen TURN secrets hardcoded in de frontend bundle.

## Call Routes En Socket Relay

Deze skeleton bevat nu ook:

- `POST /calls/start` als expliciete policycheck voor callstart
- socket relay voor:
  `call:offer`, `call:answer`, `call:decline`, `call:end`,
  `call:ice-candidate`, `call:renegotiate`, `call:video-upgrade`

Belangrijk:

- `call:offer` en `call:video-upgrade` worden door de policieservice gevalideerd
- `message:edit` laat alleen legacy/plaintext edits toe; `signal_v1` wordt expliciet geweigerd

## Lokale Start

1. installeer dependencies:
   `npm install`
2. configureer omgeving op basis van:
   [ .env.example ](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/.env.example)
3. start lokaal:
   `npm run dev`

Snelle lokale emulatorflow zonder losse env-export:

- `npm run preflight:emulator`
- `npm run seed:emulator`
- `npm run dev:emulator`

Optioneel voorbeelddata laden:

- `npm run seed`

Snelle smoke-checks tegen een draaiende lokale server:

- `npm run smoke`
- `npm run smoke:socket`

Historische attachment-smokes bestaan alleen nog als intern referentiemateriaal en horen niet bij de actieve standaardflow. Ze worden ook niet meer via de standaard npm-scripts van deze skeleton aangeboden.

Snelle configuratiecheck vóór starten of deploy:

- `npm run preflight`
- `npm run preflight:emulator`

Kleine unit-test voor Firebase-confighelpers:

- `npm test`

Dat dekt nu ook de quiet-hours policyhelper mee.

## Belangrijk

- deze skeleton gebruikt eenvoudige Express-code
- async routefouten worden centraal afgehandeld via middleware
- requests krijgen een `x-request-id` voor eenvoudige tracing
- Firestore-queries en policychecks zijn bewust minimaal gehouden
- Firebase Admin kan lokaal of via Railway-secrets worden geïnitialiseerd
- optioneel is er een lokaal-only auth bypass via `ALLOW_DEV_AUTH_BYPASS=true` + `x-dev-uid`
- dezelfde lokale bypass werkt voor Socket.IO via `auth.devUid`
- `dev:emulator` zet standaard:
  `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`,
  `FIREBASE_PROJECT_ID=pulse-messenger-3cb9d`,
  `ALLOW_DEV_AUTH_BYPASS=true`
- key bundle retrieval reserveert nu transactioneel een one-time prekey per device
- devices kunnen one-time prekeys bijvullen via `POST /devices/:deviceId/prekeys`
- devices kunnen hun signed prekey roteren via `POST /devices/:deviceId/signed-prekey`
- users kunnen hun eigen devices opvragen via `GET /devices` en intrekken via `POST /devices/:deviceId/revoke`
- receipt-updates sturen nu realtime `message:status` terug naar de afzender
- `DELETE /api/messages/:convId/:msgId?scope=self|all` ondersteunt nu self-hide en all-delete met realtime `message:deleted`
- send- en receiptflows valideren nu expliciet actieve sender- en recipient-devices
- denied policychecks en parent-acties worden alvast gelogd naar `policy_events`
- dit is bedoeld als implementatiestart, niet als af productieontwerp

## Health En Readiness

Beschikbaar:

- `GET /`
- `GET /health`
- `GET /configz`
- `GET /readyz`

When Firebase Admin credentials are missing, Firestore-backed routes fail fast with `503 firebase_not_configured` instead of waiting on a long Google client timeout.
For local development, you can also use `FIRESTORE_EMULATOR_HOST` plus `FIREBASE_PROJECT_ID` to exercise Firestore-backed routes without production credentials.

`/health` geeft een lichte processtatus terug.

`/configz` geeft een veilige diagnose van de Firebase-config terug zonder secrets te echoën.

`/readyz` probeert ook Firestore-bereikbaarheid te valideren en geeft `503` terug als die check faalt.

De standaard runtime adverteert hier ook geen attachment-capabilities meer.

## Firestore Hulp

Voor de belangrijkste skeletonqueries en vermoedelijke indexes:

- [FIRESTORE_INDEXES.md](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/FIRESTORE_INDEXES.md)

## Firebase Setup

Voor lokale en Railway-vriendelijke Firebase Admin-config:

- [FIREBASE_SETUP.md](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/FIREBASE_SETUP.md)

## Request Voorbeelden

Voor directe handmatige tests:

- [REQUEST_EXAMPLES.md](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/REQUEST_EXAMPLES.md)
- [requests.http](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/requests.http)

## Deploy

Voor een eerste Railway-gericht deploypad:

- [RAILWAY_DEPLOY.md](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/RAILWAY_DEPLOY.md)

## Lees Verder

- [BACKEND_E2EE_API_SPEC.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_API_SPEC.md)
- [BACKEND_E2EE_FIRESTORE_PLAN.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_FIRESTORE_PLAN.md)
- [E2EE_BACKEND_HANDOFF_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKEND_HANDOFF_CHECKLIST.md)
> Legacy status: deze map is niet de actieve Pulse-backend en is niet de source of truth.
> Gebruik voor alle backendimplementatie `../pulse-backend-erlang`.

# Realtime socket smoke test

The realtime reconnect smoke test uses two Socket.IO users and a local
Firestore Emulator. It verifies the `sync:required` fallback, a cross-user
message, and its read receipt.

Requirements: Node 20+, Firebase CLI, and JDK 21+.

```bash
npm run smoke:socket:emulator
```

The GitHub Actions `Realtime Sync` workflow runs the same command with Temurin
JDK 21 on every push to `main` and on relevant pull requests.
