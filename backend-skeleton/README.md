# Pulse Backend Skeleton

Dit is een minimale backend-skeleton voor de eerste E2EE-serviceflow van Pulse.

## Doel

Deze map is geen complete productiebackend, maar een startpunt voor:

- `POST /devices/register`
- `GET /users/:userId/key-bundle`
- `POST /messages/send`
- `POST /messages/receipt`
- mixed `GET /api/messages/:convId`
- `POST /calls/start`
- socket auth en `message:new`
- parent policy admin-routes

## Structuur

- [src/server.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/server.js)
- [src/middleware/auth.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/middleware/auth.js)
- [src/middleware/asyncRoute.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/middleware/asyncRoute.js)
- [src/middleware/errorHandler.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/middleware/errorHandler.js)
- [src/routes/devices.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/devices.js)
- [src/routes/keys.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/keys.js)
- [src/routes/messages.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/messages.js)
- [src/routes/calls.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/calls.js)
- [src/routes/parent.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/parent.js)
- [src/services/firestore.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/services/firestore.js)
- [src/services/parentPolicyService.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/services/parentPolicyService.js)
- [src/services/policyEvents.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/services/policyEvents.js)
- [src/socket/index.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/socket/index.js)
- [src/scripts/seed.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/scripts/seed.js)

## Parent Admin Routes

Deze skeleton bevat nu ook minimale routes voor:

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

Daarnaast ondersteunt de policieservice nu ook:

- quiet hours voor chat/call/video deny
- aparte call/video-beslissingen via `mayStartCall(...)`

## Call Routes En Socket Relay

Deze skeleton bevat nu ook:

- `POST /calls/start` als expliciete policycheck voor callstart
- socket relay voor:
  `call:offer`, `call:answer`, `call:decline`, `call:end`,
  `call:ice-candidate`, `call:renegotiate`, `call:video-upgrade`

Belangrijk:

- `call:offer` en `call:video-upgrade` worden door de policieservice gevalideerd

## Lokale Start

1. installeer dependencies:
   `npm install`
2. configureer omgeving op basis van:
   [ .env.example ](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/.env.example)
3. start lokaal:
   `npm run dev`

Optioneel voorbeelddata laden:

- `npm run seed`

Snelle smoke-checks tegen een draaiende lokale server:

- `npm run smoke`

Snelle configuratiecheck vóór starten of deploy:

- `npm run preflight`

Kleine unit-test voor Firebase-confighelpers:

- `npm test`

Dat dekt nu ook de quiet-hours policyhelper mee.

## Belangrijk

- deze skeleton gebruikt eenvoudige Express-code
- async routefouten worden centraal afgehandeld via middleware
- Firestore-queries en policychecks zijn bewust minimaal gehouden
- Firebase Admin kan lokaal of via Railway-secrets worden geïnitialiseerd
- one-time prekeys worden hier nog niet transactioneel gereserveerd
- denied policychecks en parent-acties worden alvast gelogd naar `policy_events`
- dit is bedoeld als implementatiestart, niet als af productieontwerp

## Health En Readiness

Beschikbaar:

- `GET /`
- `GET /health`
- `GET /configz`
- `GET /readyz`

`/health` geeft een lichte processtatus terug.

`/configz` geeft een veilige diagnose van de Firebase-config terug zonder secrets te echoën.

`/readyz` probeert ook Firestore-bereikbaarheid te valideren en geeft `503` terug als die check faalt.

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
