# Pulse Backend Skeleton Railway Deploy

Dit document beschrijft de minimale stappen om de backend-skeleton op Railway te zetten.

## Benodigd

- een Railway project
- Firebase service account toegang voor `firebase-admin`
- Firestore ingeschakeld

## Aanbevolen Omgevingsvariabelen

- `PORT`
- één van deze Firebase Admin-configuraties:
  `GOOGLE_APPLICATION_CREDENTIALS`
  of `FIREBASE_SERVICE_ACCOUNT_JSON`
  of de combinatie `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`

## Firebase Admin In Deze Skeleton

De skeleton ondersteunt nu drie paden:

1. lokaal via `GOOGLE_APPLICATION_CREDENTIALS`
2. Railway via `FIREBASE_SERVICE_ACCOUNT_JSON`
3. Railway via losse env-velden:
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

Zie:

- [src/services/firestore.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/services/firestore.js)
- [.env.example](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/.env.example)

## Startcommando

De skeleton bevat al:

- [Procfile](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/Procfile)
- [railway.json](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/railway.json)

Start:

- `npm start`

## Eerste Deployvolgorde

1. project koppelen aan Railway
2. dependencies laten installeren
3. Firebase Admin secrets configureren
4. Firestore-toegang bevestigen
5. root healthcheck testen via `/`
6. daarna pas `devices/register`, `key-bundle` en `messages/send` testen

## Voor Eerste Integratie

Gebruik eerst:

- frontend:
  `REACT_APP_E2EE_MODE=mock`
  `REACT_APP_E2EE_TRANSPORT=service`
- backend:
  deze skeleton + Firestore testdata

## Lees Verder

- [README.md](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/README.md)
- [FIRESTORE_INDEXES.md](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/FIRESTORE_INDEXES.md)
- [BACKEND_E2EE_API_SPEC.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_API_SPEC.md)
