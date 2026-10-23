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
  recipient/own-device bundleclaims, exacte envelopeverzending, een
  inhoudsloze devicefeed en het ophalen van uitsluitend de eigen envelope;
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
- 229 frontendtests en 191 backendtests in totaal geslaagd.
- de afgescheiden QA-backend draait op Railway met Firebase-project
  `pulse-messenger-e2ee-qa`, `E2EE_V2_ENABLED=true` en een EUR 5-budget; buiten
  actieve tests heeft de Railway-service geen actieve deployment;
- een live QA-contractsmoketest voor Auth, twee devices, prekeyclaim,
  ciphertextdelivery, recipient-envelope en idempotentie is geslaagd; alle
  tijdelijke gebruikers- en berichtdata is daarna verwijderd;
- Firestore TTL voor `e2eePreKeyClaims.expiresAt` is actief en alle bijbehorende
  indexen zijn gereed; op 19 oktober 2026 is met `404 NOT_FOUND` bevestigd dat
  de policy het bewust verlopen QA-testrecord automatisch heeft verwijderd;
- een aparte QA-APK `com.pulsemessenger.chat.e2eeqa` versie
  `1.0.24-e2ee-qa` is gebouwd met SHA-256
  `730c4518ab81ffc39baa3a2959e30fbf90262cf4d4d247705a0b36435d465d2b`;
- op een fysieke Samsung SM-A266B met Android 16 zijn native providerbootstrap,
  hardware-backed Keystore-opslag en behoud van dezelfde opaque device-ID,
  `signalDeviceId: 1` en `identityVersion: 1` na een volledige processherstart
  bevestigd.
- op hetzelfde fysieke toestel hebben twee volledig gescheiden Android-
  appinstanties in beide richtingen een live `v2_pending`-tekstbericht
  uitgewisseld, na appupdate en processherstart uit de devicefeed opgehaald en
  native ontsleuteld;
- een rechtstreekse controle van beide QA-Firestore-berichten bevestigde dat de
  herkenbare plaintextmarkeringen nergens in metadata of envelopes stonden;
  server-side stond uitsluitend `Versleuteld bericht` plus een ciphertext-
  envelope voor het geadresseerde device.
- Capacitor-bridge-logging en Android WebView-debugging zijn expliciet
  uitgeschakeld, zodat plaintext en pluginargumenten ook in debug-/QA-builds
  niet via Logcat of remote WebView-inspectie beschikbaar komen.
- device-enveloppen hebben nu een server-side `pending`-status, worden per
  Android-runtime oudste-eerst en serieel ontsleuteld en pas na succesvolle
  decryptie idempotent bevestigd; interne aflevervelden verlaten de backend
  niet via het cryptografische envelopecontract;
- een herkenbare offline markering is na een volledige stop en herstart van
  QA-B exact eenmaal native ontsleuteld; daarna was de devicefeed leeg, bleef
  het bericht bij opnieuw openen eenmaal zichtbaar en kwamen plaintext en
  decryptieargumenten beide nul keer voor in Logcat.
- een herkenbare achtergrondmarkering is verzonden terwijl QA-B nog als levend
  proces op de achtergrond stond; de feed bevatte vooraf precies een pending
  envelope, bij hervatten verscheen het bericht exact eenmaal en daarna was de
  feed leeg; een tweede hervatting leverde geen duplicaat op en het QA-B-proces
  logde de plaintext nul keer.
- bevestigde inkomende en uitgaande v2-tekstberichten worden per gesprek in de
  bestaande Keystore-backed secure store bewaard, inclusief een versleutelde
  index en een begrenzing van 200 berichten; berichtplaintext wordt in QA niet
  naar `localStorage` of `sessionStorage` geschreven;
- na een koude start met uitgeschakelde QA-backend toonde QA-B de eerder
  ontvangen herkenbare markering direct vanuit de native geschiedenis. De
  marker kwam nul keer als plaintext voor in de secure preferences en nul keer
  in een schone, tot het QA-B-proces beperkte Logcat-meting;
- een geldige bestaande QA-devicebinding, inclusief bindings van voor de
  `registered`-metadata, start direct offline. Een chatopvraag tijdens native
  startup wacht op dezelfde runtimebelofte en valt niet terug naar de gewone
  backendroute.
- op 20 oktober 2026 is de actieve QA-B-devicebinding server-side ingetrokken;
  het realtime revoke-event sloot het gesprek fail-closed, wiste de lokale
  native Signal-records en verwijderde de persistente publieke devicebinding;
- na processherstart registreerde QA-B precies een nieuwe actieve binding met
  `signalDeviceId: 2`, terwijl de oude binding met `signalDeviceId: 1`
  ingetrokken bleef. Daarna zijn nieuwe versleutelde berichten in beide
  richtingen native ontsleuteld;
- een gemist bericht voor een reeds geopende chat wordt bij terugkeer uit de
  achtergrond via de devicefeed opgehaald. De live proef met
  `ACTIVECHATRESUME202610200028` verscheen direct ontsleuteld in QA-B zonder
  appherstart of duplicaat.
- op 20 oktober 2026 is de volledige live proef herhaald op twee afzonderlijke
  fysieke Samsung-toestellen: een SM-A166B en een SM-A266B, beide met een eigen
  geisoleerde QA-app, account en opaque backend-device-ID;
- QA-A verstuurde `PHYSICALATOB202610201336` en QA-B antwoordde met
  `PHYSICALBTOA202610201337`; beide teksten verschenen direct en native
  ontsleuteld op het andere fysieke toestel;
- na een gelijktijdige force-stop en processherstart herstelden beide toestellen
  hun bestaande Signal-sessie en de volledige Keystore-versleutelde lokale
  berichtgeschiedenis zonder opnieuw registreren;
- terwijl QA-B volledig gestopt was, bleef
  `PHYSICALOFFLINE202610201345` als precies een pending device-envelope staan.
  Na starten haalde QA-B het bericht op, ontsleutelde het exact eenmaal en
  bevestigde het, waarna beide devicefeeds weer leeg waren;
- alle drie serverrecords bevatten uitsluitend `Versleuteld bericht`, alle
  drie device-enveloppen bevatten ciphertext en geen van de herkenbare markers
  kwam plaintext voor in Firestore. De procesgebonden Logcat-controle op het
  ontvangende toestel bevatte eveneens nul plaintexttreffers.
- op dezelfde twee fysieke toestellen is daarna echte multi-devicefan-out
  getest met drie geisoleerde appinstanties: account A had twee actieve
  bindings met `signalDeviceId` 1 en 2 en account B een eigen binding;
- `MULTIDEVICEBTOA202610201417` is vanaf account B met exact twee afzonderlijke
  ciphertext-enveloppen naar beide account-A-devices gestuurd. Device 1
  verwerkte de live delivery, device 2 haalde zijn pending envelope bij
  hervatten op en beide toonden dezelfde native ontsleutelde tekst;
- `MULTIDEVICEAOWN202610201423` is vanaf account A device 1 met exact een
  recipient-envelope voor account B en een own-device-envelope voor account A
  device 2 verzonden. Device 2 toonde het bericht als eigen uitgaand bericht en
  account B als inkomend bericht;
- na beide multi-deviceproeven waren alle betrokken devicefeeds leeg en alle
  vier envelopes `decrypted`. Firestore bevatte uitsluitend
  `Versleuteld bericht` plus ciphertext en de twee ontvangende app-processen
  bevatten nul plaintexttreffers in Logcat.
- account A device 2 is vervolgens op de QA-backend ingetrokken terwijl beide
  echte accountdevices online waren. Het getroffen toestel sloot de actieve
  chat fail-closed en keerde terug naar de chatlijst; account A device 1 bleef
  zonder onderbreking in het gesprek werken;
- server-side bleef `signalDeviceId: 1` actief en werd `signalDeviceId: 2`
  blijvend `revoked`. Na een processherstart maakte het getroffen toestel een
  nieuwe opaque binding met `signalDeviceId: 3`, zodat de oude route niet kon
  worden hergebruikt;
- `POSTREVOKEBTOA202610201441` is daarna vanaf account B uitsluitend naar de
  actieve devices 1 en 3 gefan-out en op beide fysiek ontsleuteld. Beide
  envelopes eindigden als `decrypted` en de oude revoked binding ontving geen
  audience of envelope;
- `POSTREVOKEA2TOB202610201446` is vanaf het nieuwe device 3 naar account B en
  own-device 1 verzonden. Beide ontvangers ontsleutelden hun eigen envelope,
  alle feeds eindigden op nul, Firestore bevatte geen plaintextmarker en beide
  ontvangende app-processen hadden nul plaintexttreffers in Logcat.
- op 20 oktober 2026 is vervolgens de identity van account A device 3
  gecontroleerd vervangen, met behoud van het opaque device-ID en
  `signalDeviceId: 3`. De backend bevestigde `identityChanged: true`, verhoogde
  `identityVersion` van 1 naar 2 en publiceerde een `identity_changed`-event;
- account A device 1 verwijderde daarop onmiddellijk zijn bestaande sessie naar
  device 3. Een native sessie-inventarisatie rapporteerde nul resterende
  sessies voor dat remote device voordat nieuw verkeer werd toegestaan;
- `IDENTITYCHANGEBTOA202610201806` bouwde daarna vanaf account B afzonderlijk
  nieuwe sessies naar account A devices 1 en 3 op. Beide fysieke devices
  ontsleutelden het bericht zonder laadfout;
- device 3 antwoordde met `IDENTITYCHANGEA3TOB202610201822`. Account B
  ontsleutelde de recipient-envelope en account A device 1 de own-device-
  envelope. Beide envelopes eindigden als `decrypted`, alle feeds stonden op
  nul en Firestore bevatte uitsluitend ciphertext plus de serverpreview
  `Versleuteld bericht`.
- aansluitend is een begrensde interne Android-only `v2_pending`-pilot
  uitgevoerd met vijf normale tekstberichten in beide richtingen, een
  achtergrondhervatting en een volledige QA-B-processherstart;
- alle vijf pilotberichten stonden exact eenmaal in de chat, alle drie feeds
  eindigden op nul en de backend bevatte exact tien ciphertext-enveloppen met
  status `decrypted`;
- Firestore bevatte uitsluitend `Versleuteld bericht` als preview en geen
  plaintext pilotmarker; ook beide procesgebonden Logcat-controles hadden nul
  markerhits. De Railway QA-deployment is na de sessie weer verwijderd.

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

De browserprovider-selectie is gedocumenteerd in
[E2EE_BROWSER_PROVIDER_GATE.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_PROVIDER_GATE.md).
De officiele Node-binding en oude JavaScript-forks vallen af. De actuele
third-party WASM-wrapper is na de reproduceerbare parityprobe uitsluitend als
gehashte, vendored QA-runtime opgenomen. Dit gebeurt onder de expliciete
aanname dat de externe review voor deze bouwfase is goedgekeurd; vóór productie
blijft een controleerbaar reviewrapport vereist. De bronprobe tegen dezelfde
libsignal `0.105.1` als Android bouwde reproduceerbaar en alle 51 headless
Chromium-tests slaagden. Er is geen signal-WASM npm-dependency geinstalleerd en
de browser blijft fail-closed voor `v2_required`. Zie
[E2EE_BROWSER_PROVIDER_PARITY_PROBE.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_PROVIDER_PARITY_PROBE.md).
De exacte paritypatch, volledige lockfile, provenance en reconstructiestappen
zijn als review-only bundle vastgelegd in
[security/e2ee/browser-provider-review](/home/yushuaabdulkadir/pulse-frontend/security/e2ee/browser-provider-review/README.md).
Een verse `--locked`-reconstructie slaagt. Het browseropslag-, CSP- en
panic-herstelontwerp staat in
[E2EE_BROWSER_SECURITY_DESIGN.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_SECURITY_DESIGN.md).
`npm run verify:e2ee:browser-review` bewaakt de reviewinputs en exacte
libsignal-pin. `npm run verify:e2ee:browser-runtime` bewaakt de vendored
QA-artifacthashes en `npm run test:e2ee:browser-worker` bewijst in echt Chromium
dat twee moduleworkers, WASM en een niet-exporteerbare IndexedDB-wrapping key
starten. Dezelfde proef genereert per device identity-, signed-prekey-, Kyber-
en one-time-prekeyrecords, wisselt een echt PQXDH-prekeybericht uit, controleert
een idempotente encryptieretry, hydrateert beide ratchets na volledige
workerherstart en wisselt daarna een normaal Signal-ratchetbericht terug uit.
Sessierecords, remote-devicebindings, operationele ciphertext- en
plaintextresultaten en verbruikte one-time-prekeys worden daarbij in dezelfde
IndexedDB-transactie als de operation-ID vastgelegd. De resultaten zelf staan
uitsluitend als AES-GCM-versleutelde records in IndexedDB.

De browser send/receive-adapter bewaart vóór iedere netwerkverzending het
volledige netwerkpakket met uitsluitend recipient-ciphertexts in de
AES-GCM-versleutelde outbox. Een netwerkfout laat dit record staan; een retry
verzendt exact hetzelfde pakket en verwijdert het pas na een succesvolle
backendrespons. Ontvangen plaintext wordt na de transactionele decryptie in de
versleutelde lokale geschiedenis gezet voordat de backend-ack wordt verstuurd.
De Chromium-proef herstelt outbox en geschiedenis na volledige workerherstart.
De worker weigert outboxobjecten met een `text`- of `plaintext`-veld, ook als
dat veld genest is.

Browser-device-registratie gebruikt nu dezelfde gevalideerde v2-contracten met
`platform: web`. Alleen identity-public-key, signed-prekey, Kyber-public-key en
one-time-public-prekeys verlaten de worker; de persistente browserbinding bevat
uitsluitend opaque `deviceId`, `signalDeviceId`, identityversie en
registratiestatus. Remote `identity_changed` en `device_revoked` verwijderen de
betrokken sessie transactioneel uit WASM en IndexedDB. Een eigen revoke wist de
volledige device-store. De Chromium-proef bevestigt dat een verwijderde sessie
na workerherstart niet terugkeert. Normale ratchetenvelopes gebruiken nu de
contractwaarde `message` in plaats van de interne WASM-benaming `signal`.

De bestaande chatruntime-hook selecteert nu uitsluitend bij de combinatie
webomgeving plus `REACT_APP_E2EE_V2_BROWSER_QA_ENABLED=true` de geïsoleerde
browserprovider. De runtime initialiseert de workerbinding, registreert of
herstelt het browserdevice, hervat de ciphertextoutbox, levert versleutelde
lokale geschiedenis bij backenduitval en gebruikt dezelfde socket-lifecycle
voor message-available, revoke en identity-change. Android blijft de native
provider gebruiken; webbuilds zonder browserflag blijven disabled. Een echte
browser-QA-webappbuild bundelt de moduleworker en de 759105-byte WASM succesvol,
verwijdert de legacy storage bridge en schrijft de strikte QA-CSP.

Op 21 oktober 2026 is de browserprovider vervolgens live tegen het afgescheiden
Firebase-QA-project getest. Omdat Railway tijdens de proef platformbreed nieuwe
builds had gepauzeerd, draaide exact dezelfde geteste QA-backend tijdelijk
lokaal met `E2EE_V2_WEB_PROVIDER_ENABLED=true` en een kortlevende QA-
serviceaccountsleutel. Twee tijdelijke browser-only accounts en een tijdelijk
`v2_pending`-gesprek doorliepen in headless Chromium:

- registratie van twee nieuwe `platform: web`-devices met afzonderlijke
  libsignal-identities en publieke prekeybundels;
- een live PQXDH-bericht van browser A naar browser B, gevolgd door lokale
  decryptie en backend-acknowledgement;
- volledige stop van de B-worker, een tweede ciphertextdelivery terwijl B
  offline was en herstel van dezelfde IndexedDB-identiteit en ratchetsessie in
  een nieuwe worker;
- exact eenmaal ophalen, decrypten en bevestigen van het offline bericht,
  waarna het bericht niet meer in de pending devicefeed stond;
- rotatie van browser B naar nieuw lokaal identitymateriaal op dezelfde opaque
  devicebinding, waarbij de backend `identityChanged: true` teruggaf en de
  identityversie verhoogde;
- duurzame verwijdering van de oude A-naar-B-sessie en vernieuwing van de
  in-memory TOFU-cache, waarna A uitsluitend met de nieuw geclaimde prekeybundle
  een verse PQXDH-sessie kon opbouwen;
- versleutelde berichten na de identity-change in beide richtingen, inclusief
  lokale commit en backend-acknowledgement;
- intrekking van beide tijdelijke browserdevices en lokale providercleanup.

De twee tijdelijke Firebase Auth-accounts, gebruikersdocumenten, device-
subcollecties, security-events, prekeyclaims, berichten en het tijdelijke
gesprek zijn na afloop verwijderd. De lokale backend is gestopt en IAM
bevestigde met `404` dat de kortlevende QA-serviceaccountsleutel niet meer
bestaat. Bestaande Android-QA-accounts en hun devices zijn niet gewijzigd.

De voor accountverwijdering benodigde collection-group-index voor
`contacts.uid` is daarna expliciet aan `firestore.indexes.json` toegevoegd en
uitsluitend naar het afgescheiden QA-project gedeployed. Firestore rapporteerde
alle vier indexvarianten als `READY`. Een verse proef met twee tijdelijke
accounts en een gesprek gaf voor beide echte `DELETE /api/account/:uid`-
aanroepen status `200`; rechtstreekse controles op beide gebruikersdocumenten
en het gesprek gaven daarna status `404`. Ook voor deze proef zijn de lokale
backend en kortlevende IAM-sleutel aansluitend verwijderd.

Op 21 oktober 2026 is ook de eerste echte browser-Android-interoperabiliteits-
proef geslaagd. Een tijdelijk `platform: web`-device stuurde vanuit headless
Chromium hetzelfde plaintextbericht als twee afzonderlijke libsignal-
ciphertexts naar de twee actieve Androiddevices van het ontvangende QA-account.
De backend accepteerde de verzending alleen met de volledige recipientset. Het
aangesloten fysieke Androidtoestel haalde uitsluitend zijn eigen envelop op,
toonde de ontsleutelde tekst in de Pulse-chat en bevestigde de delivery. Een
native Android-antwoord werd vervolgens voor het tijdelijke browserdevice
versleuteld, door de WASM-worker ontsleuteld, lokaal gecommit en daarna bij de
backend bevestigd. Beide berichtinhouden bleven buiten de backendpayloads en
de server-side previews bleven `Versleuteld bericht`.

Na de proef is het tijdelijke browserdevice ingetrokken. De echte
accountverwijderingsroute gaf status `200`; controles op het tijdelijke
gebruikersdocument en gesprek gaven daarna beide status `404`. De bestaande
Androidaccounts en bindings bleven behouden. De lokale QA-backend is gestopt
en de kortlevende serviceaccountsleutel is verwijderd.

Een aansluitende cross-platform herstelproef op dezelfde datum is eveneens
geslaagd. De Android-QA-app was volledig geforceerd gestopt toen een nieuw
browserdevice een per-device versleuteld bericht naar twee actieve
Androidbindings verstuurde. Na een volledige appstart hydrateerde Android de
bestaande native identity en sessiestore, ontsleutelde het pending bericht en
bevestigde het pas na lokale opslag. Daarna werd de browserworker volledig
beëindigd voordat Android antwoordde. Een verse moduleworker hydrateerde
vervolgens dezelfde niet-exporteerbare IndexedDB-binding en ratchetsessie,
ontsleutelde het wachtende normale Signal-bericht en bevestigde het bij de
backend. Daarmee zijn offline delivery en sessieherstel over een echte
Android-appstop en volledige browserworkerstop in beide richtingen bewezen.
Ook dit tijdelijke browseraccount en gesprek zijn via de echte
accountverwijderingsroute verwijderd; beide Firestore-controles gaven `404` en
de kortlevende QA-serviceaccountsleutel is verwijderd.

De cross-platform identity-change-proef is op 21 oktober 2026 vervolgens
geslaagd. Een tijdelijk browserdevice wisselde op dezelfde opaque binding van
nieuw identitymateriaal; de backend bevestigde `identityChanged: true` en
verhoogde `identityVersion` van `1` naar `2`. Het fysieke Androidtoestel
ontsleutelde zowel het bericht voor als het bericht na deze wisseling. Het
Androidantwoord na de wisseling werd door de vernieuwde browsersessie eveneens
ontsleuteld en bevestigd. De proef eindigde met intrekking van het tijdelijke
browserdevice; account en gesprek zijn via de echte verwijderingsroute
verwijderd en beide Firestore-controles gaven `404`.

Op 22 oktober 2026 zijn de negatieve browserprovidervectors met dezelfde
release-WASM in echt Chromium geslaagd. Een bitgewijzigde prekey-ciphertext
werd fail-closed geweigerd zonder de ontvangende ratchetsessie te committen;
het ongewijzigde origineel kon onmiddellijk daarna nog correct worden
ontsleuteld. Een tweede decryptiepoging van die geldige ciphertext met een
nieuwe operation-ID werd vervolgens als replay geweigerd. Daarmee zijn zowel
authenticatiefalen met transactionele rollback als Signal-replaybescherming
voor de browserprovider uitvoerbaar vastgelegd.

De cross-platform device-revoke-proef is op 22 oktober 2026 eveneens
geslaagd. Een tijdelijk browserdevice wisselde eerst in beide richtingen
versleutelde berichten uit met het fysieke Androidtoestel. Na intrekking
rapporteerde de backend status `REVOKED` en werd toegang tot de oude devicefeed
met `403 v2_recipient_device_not_capable` geweigerd. Herregistratie leverde een
nieuwe opaque devicebinding en een nieuw Signal-device-ID (`1` naar `2`) op.
Android ontsleutelde daarna het bericht van de vervangende binding en het
Androidantwoord werd door die nieuwe browsersessie ontsleuteld en bevestigd.
Het tijdelijke account en gesprek zijn aansluitend verwijderd; beide
Firestore-controles gaven `404` en de kortlevende servicesleutel is verwijderd.

De eerstvolgende implementatiefase is:

1. het onafhankelijke reviewbewijs vastleggen en pas daarna een productiepilot
   overwegen.

De server-side productiepilotgate is op 22 oktober 2026 als ongeactiveerde
voorbereiding gebouwd. De gate kent uitsluitend `disabled`, expliciet
bevestigde `qa` en allowlist-gebaseerde `pilot` als modi. Pilotmodus vereist
een SHA-256 van het review-attestation, volledige frontend- en backendcommitpins
en niet-lege user- en conversation-allowlists. Alle device-, keybundle-, send-,
feed-, acknowledgement- en enveloperoutes controleren de cohort server-side.
Een afzonderlijke send-kill-switch kan nieuwe verzending onmiddellijk stoppen
zonder herstel en bevestiging van bestaande ciphertext te blokkeren.

De bijbehorende gestructureerde telemetrie bevat alleen een vaste
operatienaam, statusklasse, HTTP-status, rolloutmodus en grove tijdsbucket. Ze
accepteert geen identifiers, URL, ciphertext of berichtinhoud. De volledige
backendtestset telt na deze stap 30 geslaagde suites en 207 geslaagde tests.
De gate is op 23 oktober 2026 als backendcommit
`38665cb986de58717c0d7364bf666e9c29bd5413` naar de Railway-productieservice
gedeployed. De productieconfiguratie staat expliciet fail-closed op
`E2EE_V2_ENABLED=false`, rolloutmodus `disabled`, uitgeschakelde pilot-sends en
een uitgeschakelde webprovider. `/readyz` rapporteert daarom bewust
`capabilities.e2eeV2: false`. De deployment activeert geen E2EE en vervangt het
ontbrekende echte reviewbewijs niet.

De productieclient controleert vóór iedere native of browserbootstrap de
geauthenticeerde `/v2/pilot/status`-response. Alleen `enabled: true` plus
`enrolled: true` maakt de runtime actief; andere accounts initialiseren geen
worker, native sleutels of devicebinding. QA- en pilotbindings gebruiken
gescheiden local-storagekeys en opaque device-ID-prefixes. Een gepauzeerde
pilot kan bestaande ciphertext blijven ontvangen en bevestigen, maar de client
weigert nieuwe sends lokaal en de backend weigert ze nogmaals autoritatief.

De client blijft standaard uit. Een pilotbuild vereist expliciet
`REACT_APP_E2EE_V2_PILOT_ENABLED=true`, `REACT_APP_E2EE_MODE=signal` en
`REACT_APP_E2EE_TRANSPORT=v2`; browserdeelname vereist daarnaast
`REACT_APP_E2EE_V2_BROWSER_PILOT_ENABLED=true`. QA- en pilotflags tegelijk
worden fail-closed geweigerd. Na deze stap slagen 29 frontendtestsuites met 282
tests, lint en de productiebuild.

De Android-provider heeft daarnaast een afzonderlijke native buildgate. Alleen
een debugbuild met `pulseE2eeQa=true` of een releasebuild met
`pulseE2eePilot=true` stelt de provider beschikbaar; alle crypto- en lokale
geschiedenismethoden weigeren andere builds. `npm run android:build:e2ee-pilot`
bouwt de release-assets met de productiepilotflags, maar controleert eerst het
onafhankelijke review-attestation en vereist een
`PULSE_NATIVE_UPDATE_PUBLIC_KEY`. De poort is getest en stopt momenteel correct
omdat `review-attestation.json` nog ontbreekt; er is dus geen nieuwe pilot-AAB
gemaakt.

De reviewoverdracht is inmiddels machineleesbaar voorbereid in
`security/e2ee/browser-provider-review`: het handoffdocument, attestation-
schema, invultemplate en `npm run verify:e2ee:security-review` binden het
reviewoordeel aan exacte frontend-, backend-, upstream- en libsignalcommits,
een onafhankelijke rebuild, artifacthashes, verplichte tests, open bevindingen
en de SHA-256 van het inhoudelijke rapport. De check faalt bewust zolang het
echte externe attestation en rapport ontbreken.

De Android release-omvang is op 22 oktober 2026 eveneens gemeten. De
ondertekende meet-AAB voor `1.0.24` (`versionCode 80`) is `136405181` bytes;
Bundletool `1.18.3` berekent voor het aangesloten Samsung `SM-A166B`-profiel
een Play-download van `45818771` bytes. De open-source geheimencontrole en de
opgeloste release-runtime dependencygraph slagen. De meetbuild bevat net als de
bewaarde versionCode-71-AAB geen `PULSE_NATIVE_UPDATE_PUBLIC_KEY`; daarmee staat
alleen het aparte native web-updatekanaal uit. Het is nog geen E2EE-
productiekandidaat omdat review-, notice- en pilotgates openstaan. De exacte
hashes en resterende distributiegates staan in
`E2EE_RELEASE_DISTRIBUTION_AUDIT.md`.

De versiegebonden Android noticegenerator heeft daarnaast alle 174 opgeloste
release-runtimecomponenten vastgelegd met POM-hash, licentiebron en
licentiemetadata. De technische AndroidX/Kotlin-inventaris is daarmee compleet;
juridische goedkeuring van Google SDK-voorwaarden, WebRTC-binarynotices en de
uiteindelijke gecombineerde distributie blijft open.

Frontend en backend zijn inmiddels zonder GitHub-authenticatie publiek
leesbaar en beide zijn expliciet als `AGPL-3.0-only` gelicentieerd. De
release-audit en 174-componenten-noticecatalogus staan in de publieke
frontendrepository.

## Praktisch oordeel

De frontend is nu niet "af" qua echte E2EE, maar wel functioneel gekoppeld aan een lokale servicefase voor chatten, bellen en videobellen.

De kernproef tegen de aparte v2-backend is nu op twee echte Android-apparaten
bewezen: live verkeer in beide richtingen, sessie- en geschiedenisherstel na
processherstart, pending delivery terwijl de ontvanger volledig gestopt is,
idempotente bevestiging en afwezigheid van plaintext in Firestore en app-logs.
Echte multi-devicefan-out naar twee devices van hetzelfde account en
own-device synchronisatie zijn eveneens bewezen. Het intrekken en met een
nieuwe Signal-device-ID herregistreren van een van deze twee echte
accountdevices is nu ook in beide berichtrichtingen gevalideerd. Een echte
identity-change op een bestaand device is eveneens fail-closed verwerkt en na
sessievernieuwing in beide richtingen gevalideerd. De eerste begrensde interne
Android-only `v2_pending`-pilot is eveneens geslaagd. De live
browser-Android-baseline, identity-change, device-revoke, stop/herstartherstel
en negatieve browserprovidervectors zijn nu bewezen. Alleen het onafhankelijke
securityreviewbewijs ontbreekt nog; een productiepilot blijft daarom
geblokkeerd. De huidige mock-serviceflow mag nog steeds niet als E2EE worden
geactiveerd.
