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

Voor twee onafhankelijke Android-sandboxes op een enkel fysiek QA-toestel kan
dezelfde build ook als instantie `b` worden gemaakt:

```bash
PULSE_E2EE_QA_INSTANCE=b \
PULSE_E2EE_QA_BACKEND_URL=https://<qa-service>.up.railway.app \
  npm run android:build:e2ee-qa
```

Dit maakt `app-e2ee-qa-b-debug.apk` met application-ID
`com.pulsemessenger.chat.e2eeqab`. De proef bewijst isolatie en native
interoperabiliteit, maar vervangt geen latere test op twee fysieke apparaten.

Het buildscript:

- weigert `https://api.pulse-messenger.com`;
- gebruikt uitsluitend de publieke Firebase-config van
  `pulse-messenger-e2ee-qa`;
- zet `REACT_APP_E2EE_MODE=signal` en `REACT_APP_E2EE_TRANSPORT=v2`;
- bouwt alleen een aparte debug-app `com.pulsemessenger.chat.e2eeqa` of een
  expliciet benoemde, geisoleerde QA-instantie;
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

Op 19 oktober 2026 is de QA-APK op een fysieke Samsung SM-A266B met Android 16
gestart. Voor een tijdelijk QA-account is bevestigd:

- `providerAvailable: true`, secure storage en een hardware-backed Android
  Keystore;
- private key- en sessiemateriaal blijft niet-exporteerbaar;
- native bootstrap registreert precies een actief opaque devicecontract;
- een volledige app-processherstart behoudt dezelfde device-ID,
  `signalDeviceId: 1` en `identityVersion: 1`.

Dit bewijst native providerbootstrap en lokaal identityherstel op een fysiek
toestel.

Op 19 oktober 2026 is daarna met twee volledig gescheiden appinstanties op dit
toestel een live protocolproef uitgevoerd:

- QA-B stuurde `E2EE-QA-B-NAAR-A-1629`; QA-A haalde na appupdate en
  processherstart zijn eigen envelope uit de devicefeed en ontsleutelde de tekst
  native;
- QA-A antwoordde met `E2EE-QA-A-NAAR-B-1708`; QA-B herstelde zijn bestaande
  ratchetsessie en ontsleutelde het antwoord native;
- beide Firestore-records bevatten alleen `Versleuteld bericht` en elk precies
  een ciphertext-envelope; geen van beide plaintextmarkeringen kwam in het
  serverrecord of de envelope voor.

Dit bewijst native interoperabiliteit, device-specifiek historyherstel en
Keystore/sessieherstel tussen onafhankelijke Android-sandboxes. De latere proef
op twee fysieke apparaten blijft een aparte acceptatiestap.

Tijdens deze proef bleek de standaard Capacitor-debugconfig pluginargumenten en
resultaten in Logcat te schrijven. `loggingBehavior: none` en uitgeschakelde
Android WebView-debugging voorkomen dit nu ook in QA-builds. Een herkenbare
tekstproef op het fysieke toestel bevestigde daarna dat zowel de plaintext als
decryptieargumenten nul keer in de Logcat-regels van QA-B voorkwamen.

Daarna is de devicefeed als echte pending aflevercyclus getest:

- QA-B werd volledig gestopt voordat QA-A een nieuw bericht verzond;
- de feed van QA-B bevatte daarna precies een pending bericht-ID;
- na starten en openen verwerkte QA-B de envelop oudste-eerst en serieel;
- het bericht verscheen exact eenmaal zonder laadfout;
- na decryptie rapporteerde dezelfde feed `pendingCount: 0`;
- opnieuw openen binnen dezelfde appsessie toonde het bericht eenmaal zonder
  een tweede decryptiepoging.

Dit bewijst offline aflevering en idempotente bevestiging.

Daarna is achtergrondhervatting afzonderlijk getest terwijl QA-B als levend
proces op de achtergrond bleef:

- QA-A verstuurde `BACKGROUNDE2EE202610192015`;
- vóór hervatten bevatte de feed van QA-B precies één pending envelope;
- na hervatten verscheen de markering exact eenmaal en rapporteerde de feed
  `pendingCount: 0`;
- een tweede achtergrond-/voorgrondcyclus leverde geen duplicaat op;
- het QA-B-app-proces bevatte nul Logcat-regels met de plaintextmarkering. De
  ene globale Logcat-hit was uitsluitend het ADB-shellcommando waarmee de
  testtekst in QA-A werd ingevoerd.

Dit bewijst dat een gemist device-event bij hervatten via de pending feed wordt
hersteld, native wordt ontsleuteld en idempotent wordt bevestigd.

Vervolgens is duurzame lokale geschiedenis toegevoegd en op hetzelfde fysieke
toestel beproefd:

- bevestigde inkomende en uitgaande tekstberichten worden met de bestaande
  Android Keystore-backed secure store versleuteld opgeslagen;
- een afzonderlijk versleutelde index bewaart maximaal 200 berichten per
  gesprek en ondersteunt paginering vanaf het nieuwste bericht;
- QA wist oude plaintextberichtcaches, drafts en pending payloads uit Web
  Storage en bewaart daar alleen gesaneerde gespreksmetadata;
- met de Railway QA-backend volledig uitgeschakeld werd QA-B koud gestart en
  het gesprek onmiddellijk geopend;
- `LOCALHISTORYE2EE202610192100` verscheen zonder een tweede tik vanuit de
  native geschiedenis;
- een instrumentatietest ontsleutelde na processherstart minimaal één record;
- de herkenbare marker kwam nul keer voor in de secure preferences en nul keer
  in de na het legen opnieuw gemeten QA-B-proceslogs.

Een geldige bestaande QA-devicebinding start hiervoor direct offline. Ook
bindings van voor de toevoeging van de `registered`-metadata worden herkend.
Een chatopvraag tijdens native startup wacht op de gedeelde startupbelofte en
kan daardoor niet per ongeluk naar de gewone backendroute terugvallen.

Op 20 oktober 2026 is vervolgens de revoke- en herregistratiecyclus getest:

- de enige actieve QA-B-binding met `signalDeviceId: 1` is via het
  devicecontract ingetrokken;
- het realtime revoke-event sloot de actieve chat, maakte de runtime
  fail-closed en wiste de native Signal-records plus de persistente publieke
  binding;
- na processherstart registreerde QA-B precies een nieuwe actieve binding met
  `signalDeviceId: 2`; de oude binding bleef als ingetrokken geregistreerd;
- `REVOKERECOVERY202610200001` is daarna van de nieuwe QA-B-binding naar QA-A
  verstuurd en native ontsleuteld;
- `ATOBPOSTREVOKE202610200005` is vervolgens van QA-A naar de nieuwe QA-B-
  binding verstuurd en native ontsleuteld.

Tijdens dezelfde proef bleek een reeds geopende chat na terugkeer uit de
achtergrond zijn lokaal bevestigde bericht pas na een appherstart te tonen. De
QA-runtime synchroniseert daarom bij `visibilitychange`, windowfocus en
`pageshow` de actieve conversationfeed, met deduplicatie en throttling. Met
`ACTIVECHATRESUME202610200028` is bevestigd dat QA-B het gemiste bericht bij
hervatten direct in de nog geopende chat toont, zonder appherstart of duplicaat.

Deze proef voltooit revoke/herregistratie voor twee gescheiden Android-
sandboxes op een fysiek toestel. Identity-change, echte multi-device en de
herhaling op twee fysieke toestellen bleven op dat moment aparte
acceptatiestappen.

Op 20 oktober 2026 is de kernproef vervolgens uitgevoerd op twee afzonderlijke
fysieke Samsung-toestellen, een SM-A166B en een SM-A266B:

- QA-A en QA-B gebruikten ieder een eigen account, package sandbox en opaque
  backend-device-ID; beide bindings hadden een geldige `signalDeviceId: 1` en
  `identityVersion: 1`;
- `PHYSICALATOB202610201336` ging live van QA-A naar QA-B en
  `PHYSICALBTOA202610201337` live terug; beide berichten verschenen direct als
  native ontsleutelde tekst op het andere toestel;
- een force-stop en processherstart van beide apps herstelde op beide toestellen
  de bestaande Signal-sessie en de volledige Keystore-versleutelde lokale
  geschiedenis;
- QA-B werd daarna volledig gestopt voordat QA-A
  `PHYSICALOFFLINE202610201345` verzond. De feed van QA-B bevatte toen precies
  een pending bericht en die van QA-A nul;
- na starten van QA-B verscheen de offline markering exact eenmaal in de chat
  en rapporteerden beide feeds opnieuw nul pending berichten;
- Firestore bevatte drie serverpreviews met uitsluitend
  `Versleuteld bericht`, drie ciphertext-enveloppen met status `decrypted` en
  nul plaintexttreffers voor de drie herkenbare markers;
- de tot het ontvangende QA-B-proces beperkte Logcat-meting bevatte nul
  treffers voor de offline plaintextmarkering.

Daarmee zijn fysieke Android-naar-Android-interoperabiliteit, ratchetherstel,
versleutelde lokale geschiedenis en offline device-delivery voor de kernflow
bewezen. Echte multi-device met meerdere devices van hetzelfde account,
identity-change en de uitgebreidere lifecyclematrix blijven afzonderlijke
acceptatiestappen.

Later op 20 oktober 2026 is echte multi-devicefan-out met dezelfde twee
fysieke toestellen en drie geisoleerde appinstanties uitgevoerd:

- account A registreerde twee actieve opaque bindings met verschillende
  device-ID's en `signalDeviceId` 1 en 2; account B behield een afzonderlijke
  actieve binding;
- account B verstuurde `MULTIDEVICEBTOA202610201417`. Het serverrecord had
  `recipientDeviceCount: 2`, twee account-A-audiences en twee afzonderlijke
  ciphertext-enveloppen;
- account A device 1 verwerkte het bericht live. Account A device 2 had eerst
  precies een pending envelope, ontsleutelde die bij hervatten en toonde
  dezelfde tekst in de eigen chat;
- account A device 1 verstuurde daarna `MULTIDEVICEAOWN202610201423`. De exacte
  fan-out bestond uit een envelope voor account B en een own-device-envelope
  voor account A device 2;
- account A device 2 toonde dit als eigen uitgaand bericht en account B als
  inkomend bericht;
- na afloop stonden alle betrokken feeds op nul en alle vier envelopes op
  `decrypted`; de serverpreview bleef `Versleuteld bericht`, geen marker stond
  plaintext in Firestore en beide ontvangende app-processen hadden nul
  plaintexttreffers in Logcat.

Hiermee zijn multi-device recipientfan-out en own-device synchronisatie op
twee echte accountdevices bewezen. Revoke/herregistratie van een van deze twee
echte accountdevices en identity-change blijven aparte lifecycleproeven.

Daarna is revoke/herregistratie met dezelfde twee echte accountdevices
uitgevoerd:

- account A device 2 is ingetrokken terwijl devices 1 en 2 online waren. Het
  getroffen toestel sloot de actieve chat fail-closed; device 1 bleef in het
  gesprek functioneren;
- de backend rapporteerde vervolgens precies device 1 als actief en device 2
  als `revoked`;
- na processherstart registreerde het getroffen toestel een nieuwe opaque
  binding met `signalDeviceId: 3`. Device 1 en 3 waren actief en device 2 bleef
  ingetrokken;
- account B verstuurde `POSTREVOKEBTOA202610201441` met exact twee audiences
  en ciphertext-enveloppen voor de actieve devices 1 en 3. De oude binding
  kreeg geen envelope en beide actieve devices ontsleutelden het bericht;
- het nieuwe device 3 verstuurde `POSTREVOKEA2TOB202610201446` met een
  recipient-envelope voor account B en een own-device-envelope voor device 1;
- alle vier post-revoke-enveloppen eindigden als `decrypted`, alle betrokken
  feeds stonden op nul en geen herkenbare marker stond plaintext in Firestore
  of de ontvangende app-proceslogs.

Daarmee is fail-closed revoke, nieuwe device-ID-toekenning, uitsluiting van de
oude route en volledig berichtenherstel in beide richtingen op twee fysieke
accountdevices bewezen.

Daarna is identity-change op het bestaande actieve account-A-device 3 getest:

- de lokale Signal-identiteit van device 3 is in de afgeschermde QA-sandbox
  opnieuw gegenereerd; alleen het publieke sleutelbundel is naar de backend
  gestuurd en private sleutels bleven in Android Keystore-backed opslag;
- het opaque device-ID en `signalDeviceId: 3` bleven gelijk. De backend
  bevestigde `identityChanged: true`, verhoogde `identityVersion` van 1 naar 2
  en publiceerde een `identity_changed`-event;
- account A device 1 verwerkte het event fail-closed en rapporteerde daarna nul
  bestaande sessies naar device 3;
- account B stuurde `IDENTITYCHANGEBTOA202610201806`. Devices 1 en 3 bouwden
  ieder een nieuwe sessie op en ontsleutelden hun eigen envelope;
- het geroteerde device 3 antwoordde met `IDENTITYCHANGEA3TOB202610201822`.
  Account B ontsleutelde de recipient-envelope en account A device 1 de
  own-device-envelope;
- na afloop waren alle drie feeds leeg en beide envelopes van het laatste
  bericht `decrypted`. Firestore bevatte uitsluitend ciphertext en de preview
  `Versleuteld bericht`; geen herkenbare plaintextmarker stond in het
  serverrecord of de envelopes.

Daarmee zijn ook sessie-invalidatie, identityversieverhoging en herstel in
beide richtingen na een echte identity-change op twee fysieke accountdevices
bewezen.

Voor de TTL-controle is bewust dit reeds verlopen record aangemaakt:

```text
qaTtlVerification/1792329305359-0760bd67/e2eePreKeyClaims/expired-1792329305359-0760bd67
```

Op 19 oktober 2026 gaf een rechtstreekse Firestore-controle `404 NOT_FOUND`.
Daarmee is bevestigd dat de actieve TTL-policy het record automatisch heeft
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
5. Controleer dat de device-specifieke feed alleen bericht-ID's levert en dat
   iedere inhoud via de eigen envelope native wordt ontsleuteld.
6. Test vervolgens achtergrondhervatting, revoke, identity change en
   multi-device.
