# Railway Env Cleanup For Pulse Backend

Laatste update: 2026-06-21

Deze checklist is gebaseerd op de actuele code in `pulse-backend`.
Gebruik dit als praktische opschoon- en verificatielijst voor Railway.

## Laten staan

- [ ] `APP_URL`
- [ ] `WEB_APP_URL`
- [ ] `NODE_ENV`
- [ ] `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- [ ] `REDIS_URL`
- [ ] `RESEND_API_KEY`
- [ ] `SENTRY_DSN`
- [ ] `PORT`
- [ ] `CORS_ORIGINS`
- [ ] `CORS_ORIGIN_SUFFIXES`

## Toevoegen

- [ ] `FIREBASE_ENABLED=true`

## Alleen laten staan als dit echt gebruikt wordt

- [ ] `DATABASE_URL`
  Nodig voor native/Postgres-routes in `auth.native.js`.
- [ ] `TURN_URL`
  Nodig voor TURN-relay bij calls.
- [ ] `TURN_USERNAME`
  Hoort bij TURN-configuratie.
- [ ] `TURN_CREDENTIAL`
  Hoort bij TURN-configuratie.
- [ ] `EMAIL_FROM` of `RESEND_FROM`
  Alleen nodig als jullie een expliciete afzender willen instellen.
- [ ] `NATIVE_AUTH_JWT_SECRET`
  Alleen relevant voor native JWT-auth.
- [ ] `JWT_SECRET`
  Fallback voor native JWT-auth.
- [ ] `NATIVE_AUTH_JWT_EXPIRES_IN`
  Alleen relevant als jullie de native JWT TTL willen overschrijven.

## Kan waarschijnlijk weg

- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON`
- [ ] `RESEND_FROM_EMAIL`
- [ ] `RESEND_REPLY_TO`

## Belangrijkste controle

- [ ] Controleer of `FIREBASE_ENABLED` echt bestaat op Railway.
- [ ] Zet `FIREBASE_ENABLED` op `true` als Firebase in productie gebruikt moet worden.
- [ ] Controleer daarna of login, user sync en Firestore-afhankelijke routes normaal werken.

## Aanbevolen volgorde

1. Voeg `FIREBASE_ENABLED=true` toe.
2. Laat de huidige kernvariabelen staan.
3. Controleer of native auth en TURN echt gebruikt worden.
4. Ruim daarna pas vermoedelijk ongebruikte variabelen op.
