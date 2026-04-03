# Pulse Backend Skeleton Firebase Setup

Dit document helpt om Firebase Admin voor de backend-skeleton lokaal of op Railway werkend te krijgen.

## Optie 1: Lokaal Via Bestand

Gebruik:

- `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json`

Aanpak:

1. maak in Firebase een service account aan
2. download de JSON
3. zet het absolute pad in je lokale `.env`
4. draai:
   `npm run preflight`

Verwacht:

- preflight meldt dat het pad bestaat
- daarna kan `/readyz` groen worden als Firestore bereikbaar is

## Optie 2: Railway Via JSON Secret

Gebruik:

- `FIREBASE_SERVICE_ACCOUNT_JSON`

Inhoud:

- de volledige service-account JSON als één string

Aanpak:

1. kopieer de service-account JSON
2. zet die als Railway secret
3. draai na deploy:
   `npm run preflight`
   of check `/configz`

Verwacht:

- `credentialMode` wordt `service_account_json`

## Optie 3: Railway Via Losse Env-Velden

Gebruik:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Belangrijk:

- newline-tekens in `FIREBASE_PRIVATE_KEY` mogen escaped zijn als `\n`

Verwacht:

- `credentialMode` wordt `service_account_env_fields`

## Handige Volgorde

1. zet env-config
2. draai:
   `npm run preflight`
3. start:
   `npm start`
4. check:
   `/configz`
5. check:
   `/readyz`

## Wat Je Niet Hoeft Te Delen

Zet nooit in docs of commits:

- echte private keys
- echte service-account JSON
- echte Railway secrets

## Lees Verder

- [README.md](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/README.md)
- [RAILWAY_DEPLOY.md](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/RAILWAY_DEPLOY.md)
- [.env.example](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/.env.example)
