# Pulse E2EE v2 QA

Dit document beschrijft uitsluitend de interne, geisoleerde Android-QA-flow.
Het activeert geen E2EE in productie.

## Aangemaakte infrastructuur

- Firebase-project: `pulse-messenger-e2ee-qa`
- Firebase-webapp: `Pulse E2EE QA Web`
- Firestore Native-database: `(default)` in `eur3`
- Firestore-regels: standaard gesloten totdat de QA-regels expliciet worden
  gedeployd
- Railway-project: `pulse-e2ee-qa`
- Railway-service: `pulse-e2ee-qa-backend`
- Railway-domein:
  `https://pulse-e2ee-qa-backend-production.up.railway.app`
- Railway-bron: private repository `Juz86/pulse-backend`, branch `main`
- Railway-runtime: geen actieve deployment buiten actieve tests
- Firebase Authentication: alleen e-mail/wachtwoord; MFA en overige providers
  zijn uitgeschakeld
- Google Cloud-budget: `Pulse E2EE QA`, EUR 5 per maand, met waarschuwingen
  op 50%, 90% en 100%
- Firestore TTL: actief voor `e2eePreKeyClaims.expiresAt`

De productieprojecten `pulse-messenger-3cb9d` en `welcoming-heart` blijven
ongewijzigd.

## Backendconfiguratie

Het automatisch aangemaakte QA-serviceaccount
`firebase-adminsdk-fbsvc@pulse-messenger-e2ee-qa.iam.gserviceaccount.com` heeft
`roles/firebase.sdkAdminServiceAgent` en
`roles/iam.serviceAccountTokenCreator`. Een enkele sleutel staat rechtstreeks
als afgeschermd Railway-secret opgeslagen; er is geen lokaal sleutelbestand.

De QA-service gebruikt deze variabelen:

```text
NODE_ENV=production
FIREBASE_ENABLED=true
E2EE_V2_ENABLED=true
E2EE_V2_WEB_PROVIDER_ENABLED=false
GOOGLE_APPLICATION_CREDENTIALS_JSON=<QA service-account JSON>
FIREBASE_STORAGE_BUCKET=pulse-messenger-e2ee-qa.firebasestorage.app
WEB_APP_URL=https://pulse-messenger-e2ee-qa.web.app
APP_URL=https://pulse-messenger-e2ee-qa.web.app
```

`RESEND_API_KEY` is bewust een ongeldige QA-placeholder. De QA-backend start
daardoor zonder productie-e-mailsleutel, maar OTP- en resetmails werken in deze
omgeving niet.

Gebruik nooit de productie-serviceaccount of productie-Firestore voor deze
service.

## QA-APK bouwen

Start voor een test eerst de laatst bekende QA-deployment opnieuw:

```bash
cd /tmp/pulse-e2ee-qa-railway
/tmp/pulse-railway-cli/node_modules/@railway/cli/bin/railway redeploy --yes
```

Bouw daarna de QA-APK opnieuw wanneer frontend- of backendconfiguratie is
gewijzigd:

```bash
PULSE_E2EE_QA_BACKEND_URL=https://<qa-service>.up.railway.app \
  npm run android:build:e2ee-qa
```

Het buildscript:

- weigert `https://api.pulse-messenger.com`;
- gebruikt uitsluitend de publieke Firebase-config van
  `pulse-messenger-e2ee-qa`;
- zet `REACT_APP_E2EE_MODE=signal` en `REACT_APP_E2EE_TRANSPORT=v2`;
- bouwt alleen de aparte debug-app `com.pulsemessenger.chat.e2eeqa`;
- maakt geen productie-AAB.

De huidige QA-APK is gebouwd als:

```text
android/app/build/outputs/apk/debug/app-debug.apk
applicationId: com.pulsemessenger.chat.e2eeqa
versionName: 1.0.24-e2ee-qa
SHA-256: 730c4518ab81ffc39baa3a2959e30fbf90262cf4d4d247705a0b36435d465d2b
grootte: circa 536 MB (universele debug-APK met vier ABI's)
```

## Live backend-smoketest

Op 18 oktober 2026 is tegen de gedeployde QA-backend geslaagd:

- twee tijdelijke Firebase-gebruikers aanmelden;
- twee Android-devicecontracten registreren;
- transactioneel een one-time prekey claimen;
- een opaque ciphertext-envelope opslaan en alleen door het ontvangende device
  ophalen;
- dezelfde verzendopdracht idempotent herhalen;
- alle tijdelijke gebruikers, devices, berichten en gesprekken opruimen.

Na cleanup bevatten Authentication en de QA-`users`-collectie nul gebruikers.
Deze test bewijst het backendcontract, niet de native libsignal-interoperabiliteit.

Voor de TTL-controle staat bewust dit reeds verlopen record klaar:

```text
qaTtlVerification/1792329305359-0760bd67/e2eePreKeyClaims/expired-1792329305359-0760bd67
```

Controleer uiterlijk circa 24 uur na aanmaak dat Firestore dit record heeft
verwijderd.

Verwijder de actieve Railway-deployment na iedere test. Service, bronkoppeling,
variables, secrets en domein blijven daarbij bewaard:

```bash
cd /tmp/pulse-e2ee-qa-railway
/tmp/pulse-railway-cli/node_modules/@railway/cli/bin/railway down --yes
```

## Testdata

Maak twee afzonderlijke QA-gebruikers en een een-op-een-testgesprek aan. Zet
alleen dat gesprek op:

```text
e2eeState: v2_pending
```

Gebruik `v2_required` pas nadat live encryptie/decryptie op twee apparaten is
geslaagd. Productiegesprekken mogen nooit worden gekopieerd.

## Acceptatievolgorde

1. Device A en B registreren ieder een eigen opaque device-ID.
2. A stuurt live tekst naar B; controleer dat Firestore alleen ciphertext en
   `Versleuteld bericht` als serverpreview bevat.
3. B antwoordt; controleer de bestaande ratchetsessie.
4. Herstart beide apps en herhaal de live proef.
5. Bouw daarna eerst de device-specifieke gemiste-berichtenfeed.
6. Test vervolgens offline, achtergrond, revoke, identity change en
   multi-device.
