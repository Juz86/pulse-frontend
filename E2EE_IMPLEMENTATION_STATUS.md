# Pulse E2EE Implementation Status

Dit document geeft een compact overzicht van de huidige E2EE-voorbereiding in de frontendrepo.

Volledig documentatie-overzicht:

- [E2EE_DOCS_INDEX.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_DOCS_INDEX.md)

## Status

Frontendvoorbereiding: aanwezig als mock-tussenfase, niet geschikt voor een
productieclaim van echte E2EE.

Wat dit betekent:

- de huidige app blijft werken met de bestaande socketflow
- de codebase is voorbereid op een overstap naar service-based encrypted delivery
- een lokale servicefase voor chatten, bellen en videobellen werkt nu al

## Wat al gebouwd is

### Frontend infrastructuur

- v2-contractschemas en fail-closed validators, nog niet gekoppeld aan runtime:
  [src/lib/e2ee/v2/protocolV2Contract.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/protocolV2Contract.js)

- centrale config:
  [src/lib/e2ee/config.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/config.js)

- crypto adapterlaag:
  [src/lib/e2ee/adapter/pulseCryptoAdapter.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/adapter/pulseCryptoAdapter.js)
  [src/lib/e2ee/adapter/pulseCryptoMock.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/adapter/pulseCryptoMock.js)

- lokale identity/session opslag:
  [src/lib/e2ee/secureKeyStore.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/secureKeyStore.js)
  [src/lib/e2ee/sessionStore.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/sessionStore.js)

- bootstrap en messaging service:
  [src/lib/e2ee/deviceBootstrap.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/deviceBootstrap.js)
  [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)

- message/policy helpers:
  [src/lib/e2ee/messageModel.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messageModel.js)
  [src/lib/e2ee/policy.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/policy.js)

### Frontend integratie

- bootstrap na login:
  [src/App.js](/home/yushuaabdulkadir/pulse-frontend/src/App.js)

- gefaseerde send/retry/forward en hydratie bij laden:
  [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)

- hydratie bij live ontvangst, statusupdates en realtime event-compatibiliteit:
  [src/hooks/useChat.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useChat.js)

- UI-fallbacks:
  [src/components/MessageBubble.js](/home/yushuaabdulkadir/pulse-frontend/src/components/MessageBubble.js)
  [src/components/ConversationItem.js](/home/yushuaabdulkadir/pulse-frontend/src/components/ConversationItem.js)
  [src/components/ChatInput.js](/home/yushuaabdulkadir/pulse-frontend/src/components/ChatInput.js)

- edit-policy voor encrypted berichten:
  [src/components/MsgContextMenu.js](/home/yushuaabdulkadir/pulse-frontend/src/components/MsgContextMenu.js)
  [src/screens/ChatScreen.js](/home/yushuaabdulkadir/pulse-frontend/src/screens/ChatScreen.js)

### Documentatie

- docs index:
  [E2EE_DOCS_INDEX.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_DOCS_INDEX.md)

- rollout:
  [E2EE_ROLLOUT.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ROLLOUT.md)

- backend API contract:
  [BACKEND_E2EE_API_SPEC.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_API_SPEC.md)

- Firestore/datastore plan:
  [BACKEND_E2EE_FIRESTORE_PLAN.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_FIRESTORE_PLAN.md)

## Feature flags

Huidige veilige defaults:

- [ .env ](/home/yushuaabdulkadir/pulse-frontend/.env)
- [ .env.production ](/home/yushuaabdulkadir/pulse-frontend/.env.production)
- [ .env.example ](/home/yushuaabdulkadir/pulse-frontend/.env.example)

Waarden:

- `REACT_APP_E2EE_MODE=mock`
- `REACT_APP_E2EE_TRANSPORT=socket`

Betekenis:

- `mock`: nog geen echte crypto-library actief
- `socket`: bestaande verzendflow blijft leidend

## Wat geverifieerd is

### Build

Geslaagd:

- `npm run build`

### Tests

Geslaagd:

- `npm test -- --watchAll=false`

Tests aanwezig:

- [src/utils.test.js](/home/yushuaabdulkadir/pulse-frontend/src/utils.test.js)
- [src/lib/e2ee/e2ee.test.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/e2ee.test.js)
- [src/lib/e2ee/v2/protocolV2Contract.test.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/protocolV2Contract.test.js)

Stap 3-verificatie:

- 49 gerichte frontend-v2-contracttests geslaagd
- device-registratie, key-bundle claim, message-send en device-delivery gedekt
- negatieve tests voor legacyprotocol, plaintextvelden, verkeerde devices,
  incomplete fan-out, duplicaten en ongeldig keymateriaal

### Lint

Geslaagd:

- `npm run lint`

## Bewuste beperkingen op dit moment

- echte crypto is nog niet actief
- encrypted edit-flow is bewust uitgeschakeld
- chatmedia en attachments horen niet bij de huidige productscope
- de focus blijft op chatten, bellen en videobellen

## Volgende stap

Het bindende vervolgontwerp staat in
[E2EE_PROTOCOL_V2_DECISION.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_PROTOCOL_V2_DECISION.md).

De v2-schema's, negatieve contracttests, backend device-lifecycle en
transactionele prekey-claim zijn toegevoegd zonder productieactivatie.

Backend gereed in deze fase:

- v2-device registreren, bekijken, roteren, aanvullen en intrekken;
- identity-versioning en security events;
- policygebonden key-bundle claim;
- atomische consumptie van een prekey per actief ontvangerdevice;
- idempotente netwerkretry via `claimId`;
- aparte prekey-claim voor uitsluitend de eigen overige devices;
- per-device message-opslag met gescheiden metadata en ciphertext-envelopes;
- exact-device fan-out, eigen-device synchronisatie en UUID-idempotentie;
- geverifieerde socket-device binding en inhoudsloze realtime notificaties;
- eigen-envelope-fetch via een geauthenticeerde HTTPS-route;
- 49 gerichte v2-backendtests en 185 backendtests in totaal geslaagd;
- legacy service- en socket-send worden geblokkeerd zodra een gesprek
  `v2_required` is.
- Firestore TTL is actief op `e2eePreKeyClaims.expiresAt` in de standaarddatabase
  van `pulse-messenger-3cb9d`;
- de TTL-policy en de twee bestaande samengestelde indexen zijn declaratief
  vastgelegd in
  [firestore.indexes.json](/home/yushuaabdulkadir/pulse-frontend/firestore.indexes.json);
- na de TTL-deploy zijn 49 gerichte v2-backendtests en alle 185 backendtests
  opnieuw geslaagd, zonder productieactivatie van E2EE.

TTL-verwijderprobe voor operationele controle:

- document:
  `conversations/pulse-e2ee-ttl-verification/e2eePreKeyClaims/ttl_probe_20261018080100135`;
- aangemaakt op `2026-10-18T08:01:00.135Z`;
- `expiresAt` staat op `2026-10-18T07:01:00.135Z`;
- de probe bevat uitsluitend testmetadata en geen gebruiker- of berichtgegevens;
- na de door Firestore gedocumenteerde verwerkingstijd moet een `NOT_FOUND`-
  controle bevestigen dat het document automatisch is verwijderd.

Android-providerbasis gereed:

- niet-exporteerbare Android Keystore-sleutel met AES-256-GCM-recordopslag;
- recordgebonden AAD en gehashte lokale recordnamen;
- hardware/StrongBox-capability zonder positieve aanname;
- uitsluiting van cloudbackup en device-transfer;
- Capacitor-statusbridge zonder export van private key- of sessiemateriaal;
- 129 Android JVM-tests, drie fysieke instrumentatietests en lint geslaagd;
- fysieke Android 16-validatie van encrypted write/read/remove,
  plaintextscheiding, secure-storage-capability en persistent identityherstel;
- hardware-backed Keystore bevestigd op de Samsung-testdevice, zonder
  StrongBox-capability;
- volledige toestelreboot doorstaan met behoud van dezelfde libsignal-identity
  en registration-ID;
- geisoleerde E2EE-testvariant die naast de ondertekende Play Store-app kan
  worden geinstalleerd zonder diens appdata te verwijderen.
- `libsignal-client` en `libsignal-android` vastgepind op `0.105.1`;
- libsignal-vereiste `signalDeviceId` en ondertekende Kyber-prekey toegevoegd aan
  registratie, rotatie en transactionele key-bundle claims;
- Signal Maven-repository beperkt tot groep `org.signal`;
- SHA-256 dependency verification voor de volledige Android-build vastgelegd;
- debugbuild en lint met de vastgepinde artifacts opnieuw geslaagd.
- native sessie-engine met geslaagde prekey- en Double Ratchet-roundtrip tussen
  twee geïsoleerde Android-device stores.
- persistente `SignalProtocolStore` boven op de Keystore-beveiligde recordstore;
- atomaire lokale identity/registration-opslag en persistente remote identities,
  signed-, one-time-, Kyber-prekeys, sessies en hergebruikdetectie;
- geslaagde restarttest die een bestaand ratchetgesprek na heropening voortzet.
- smalle native bootstrap/encrypt/decrypt-bridge met uitsluitend publieke
  registratie-output, ciphertext-output en gedecrypteerde UI-tekst;
- blijvende binding van `signalDeviceId` aan de versleuteld opgeslagen lokale
  identity en fail-closed weigering bij een mismatch;
- provider-roundtriptest voor prekeybericht en ratchet-antwoord na herstart;
- fail-closed JavaScript-adapter die buiten native Android niet beschikbaar is.
- strikt v2-API-clientcontract voor device-overzicht en registratie,
  recipient/own-device bundleclaims, exacte envelopeverzending en het ophalen
  van uitsluitend de eigen envelope;
- Android-registratie-orchestrator die native bootstrap pas uitvoert wanneer de
  providergate expliciet beschikbaar is en alleen publieke registratievelden
  naar de backend stuurt.
- versleutelde, persistente koppeling tussen opaque backend-device-ID's en
  numerieke Signal-device-ID's, inclusief fail-closed conflictcontrole;
- send/receive-orchestrator die bestaande ratchetsessies hergebruikt, alleen
  ontbrekende devicebundles claimt en bij een gewijzigde recipientset exact
  eenmaal veilig vernieuwt;
- deliverycontract met het geverifieerde `senderSignalDeviceId`, zodat een
  eerste inkomend prekeybericht aan het juiste native Signal-adres wordt
  gekoppeld;
- servergeverifieerde `senderIdentityVersion` op iedere delivery, zodat ook een
  gemist realtime identity-event bij het volgende bericht de oude sessie wist;
- fail-closed lifecyclehandler voor remote identity changes, ingetrokken remote
  devices en het wissen van alle lokale E2EE-status bij intrekking van het
  huidige device;
- seriele socketcoordinator voor identity-, revoke- en inhoudsloze
  message-available-events, inclusief deduplicatie, retry na fouten en exact
  afmelden van listeners;
- gevalideerde `e2eeDeviceId` in de Socket.IO-authenticatie, met gecontroleerde
  reconnect wanneer het lokale v2-device wordt gekoppeld;
- automatische sessievernieuwing met een nieuwe prekey-envelope na een hogere
  remote identity-versie, inclusief weigering van stale versies;
- interne Android QA-runtime die alleen met `REACT_APP_E2EE_TRANSPORT=v2`,
  `REACT_APP_E2EE_V2_QA_ENABLED=true` en een expliciet niet-productiebackendadres
  start;
- aparte debug-app-ID `com.pulsemessenger.chat.e2eeqa`; releasebuilds blokkeren
  de QA-provider en de normale debugvariant houdt `providerAvailable: false`;
- live een-op-een-tekstberichten via de native send/receive-orchestrator aan de
  chatruntime gekoppeld, zonder fallback naar legacy socket- of plaintextfeeds;
- nog niet door v2 ondersteunde groepen, reacties, antwoorden, vermeldingen,
  bewerken, doorsturen en contactkaarten worden in QA fail-closed geweigerd;
- 221 frontendtests en 185 backendtests in totaal geslaagd.
- de afgescheiden QA-backend draait op Railway met Firebase-project
  `pulse-messenger-e2ee-qa`, `E2EE_V2_ENABLED=true` en een EUR 5-budget; buiten
  actieve tests heeft de Railway-service geen actieve deployment;
- een live QA-contractsmoketest voor Auth, twee devices, prekeyclaim,
  ciphertextdelivery, recipient-envelope en idempotentie is geslaagd; alle
  tijdelijke gebruikers- en berichtdata is daarna verwijderd;
- Firestore TTL voor `e2eePreKeyClaims.expiresAt` is actief en alle bijbehorende
  indexen zijn gereed; een bewust verlopen record wacht op de asynchrone
  verwijdercontrole;
- een aparte QA-APK `com.pulsemessenger.chat.e2eeqa` versie
  `1.0.24-e2ee-qa` is gebouwd met SHA-256
  `730c4518ab81ffc39baa3a2959e30fbf90262cf4d4d247705a0b36435d465d2b`.

Releasegrootte met de native provider, lokaal gemeten op versiecode `80`:

- gesigneerde release-AAB: `136083980` bytes (`136.08 MB`, `129.78 MiB`);
- SHA-256:
  `643c047c4b1ac655cee51b12249103fbd44426951729619ac2baac746ba07d37`;
- door Bundletool `1.18.3` geschatte downloadgrootte: `43.26-46.91 MB`;
- `arm64-v8a`: `45.33-45.51 MB`;
- `armeabi-v7a`: `43.26-43.44 MB`;
- `x86`: `45.29-45.47 MB`;
- `x86_64`: `46.73-46.91 MB`;
- de grootste bijdrage is de niet-gestripte `libsignal_jni.so`, die voor vier
  ABI's in de uploadbundle zit; Play levert per apparaat alleen de passende ABI;
- de maximale geschatte download van `46.91 MB` blijft ruim onder de huidige
  Google Play-limieten en onder de `200 MB`-drempel voor de melding over een
  grote mobiele download.

De echte Android-protocolprovider blijft in normale debug- en releasebuilds
fail-closed `providerAvailable: false` en buiten de productiechatflow. Alleen de
expliciete, naast Pulse installeerbare interne QA-debugbuild rapporteert de
provider tijdelijk als beschikbaar. Productie-E2EE blijft uit totdat
registratie, delivery, offline herstel, multi-devicegedrag en lifecycle op echte
Android-apparaten zijn bewezen.

Deze frontendrepository is als `AGPL-3.0-only` gelicentieerd. Lokale
libsignal-builds zijn mogelijk; een publieke release blijft `NO-GO` totdat
dependencycompatibiliteit en de openbare releaseprocedure zijn bevestigd. Zie
[E2EE_LIBSIGNAL_LICENSE_DECISION.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_LIBSIGNAL_LICENSE_DECISION.md)
en
[E2EE_OPEN_SOURCE_READINESS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_OPEN_SOURCE_READINESS.md).

De eerstvolgende implementatiefase is:

1. Android-naar-Android live encryptie/decryptie en herregistratie met twee
   echte apparaten bewijzen;
2. een device-specifieke gemiste-berichtenfeed bouwen voordat restart,
   achtergrondontvangst en offline herstel als geslaagd mogen gelden;
3. multi-device sync, revoke en identity change op echte apparaten valideren;
4. bevestigen dat Firestore het bewust verlopen QA-testrecord binnen de gedocumenteerde
   verwerkingstijd verwijdert;
5. pas daarna een interne `v2_pending` pilot starten;
6. later een browserprovider selecteren en valideren.

## Praktisch oordeel

De frontend is nu niet "af" qua echte E2EE, maar wel functioneel gekoppeld aan een lokale servicefase voor chatten, bellen en videobellen.

De grootste open stap is nu de interne QA-flow tegen een aparte v2-backend op
twee echte Android-apparaten bewijzen. Live tekst is gekoppeld, maar de backend
mist nog een device-specifieke feed voor events die een apparaat offline heeft
gemist. Restart, achtergrondontvangst en offline herstel zijn daarom nog niet
bewezen. De huidige mock-serviceflow mag nog steeds niet als E2EE worden
geactiveerd.
