# Pulse Backend Skeleton

Dit is een minimale backend-skeleton voor de eerste E2EE-serviceflow van Pulse.

## Doel

Deze map is geen complete productiebackend, maar een startpunt voor:

- `POST /devices/register`
- `GET /users/:userId/key-bundle`
- `POST /messages/send`
- `POST /messages/receipt`
- mixed `GET /api/messages/:convId`
- socket auth en `message:new`
- parent policy admin-routes

## Structuur

- [src/server.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/server.js)
- [src/middleware/auth.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/middleware/auth.js)
- [src/routes/devices.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/devices.js)
- [src/routes/keys.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/keys.js)
- [src/routes/messages.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/messages.js)
- [src/routes/parent.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/routes/parent.js)
- [src/services/firestore.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/services/firestore.js)
- [src/services/parentPolicyService.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/services/parentPolicyService.js)
- [src/socket/index.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/socket/index.js)

## Parent Admin Routes

Deze skeleton bevat nu ook minimale routes voor:

- `GET /api/parent/child/:childUid/policy`
- `PATCH /api/parent/child/:childUid/policy/features`
- `PATCH /api/parent/child/:childUid/policy/schedule`
- `GET /api/parent/child/:childUid/approved-contacts`
- `POST /api/parent/child/:childUid/approved-contacts`
- `PATCH /api/parent/child/:childUid/approved-contacts/:targetUid`
- `DELETE /api/parent/child/:childUid/approved-contacts/:targetUid`

## Lokale Start

1. installeer dependencies:
   `npm install`
2. configureer omgeving op basis van:
   [ .env.example ](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/.env.example)
3. start lokaal:
   `npm run dev`

## Belangrijk

- deze skeleton gebruikt eenvoudige Express-code
- Firestore-queries en policychecks zijn bewust minimaal gehouden
- one-time prekeys worden hier nog niet transactioneel gereserveerd
- dit is bedoeld als implementatiestart, niet als af productieontwerp

## Lees Verder

- [BACKEND_E2EE_API_SPEC.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_API_SPEC.md)
- [BACKEND_E2EE_FIRESTORE_PLAN.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_FIRESTORE_PLAN.md)
- [E2EE_BACKEND_HANDOFF_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKEND_HANDOFF_CHECKLIST.md)
