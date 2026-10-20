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
De officiele Node-binding en oude JavaScript-forks vallen af. Een actuele
third-party WASM-wrapper is alleen als mogelijke QA-kandidaat vastgelegd en
blijft `NO-GO` voor integratie zolang de paritybron niet onafhankelijk is
beoordeeld. Een tijdelijke bronprobe tegen dezelfde libsignal `0.105.1` als
Android bouwde reproduceerbaar in dezelfde omgeving en alle 51 headless
Chromium-tests slaagden. Er is geen browserdependency geinstalleerd en de
browser blijft fail-closed voor `v2_required`. Zie
[E2EE_BROWSER_PROVIDER_PARITY_PROBE.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_PROVIDER_PARITY_PROBE.md).
De exacte paritypatch, volledige lockfile, provenance en reconstructiestappen
zijn als review-only bundle vastgelegd in
[security/e2ee/browser-provider-review](/home/yushuaabdulkadir/pulse-frontend/security/e2ee/browser-provider-review/README.md).
Een verse `--locked`-reconstructie slaagt. Het browseropslag-, CSP- en
panic-herstelontwerp staat in
[E2EE_BROWSER_SECURITY_DESIGN.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_SECURITY_DESIGN.md).
`npm run verify:e2ee:browser-review` bewaakt de reviewhashes, exacte
libsignal-pin en afwezigheid van een browserprovider in de runtime.

De eerstvolgende implementatiefase is:

1. de Android-implementatie onafhankelijk laten beoordelen;
2. de browser-reviewkandidaat onafhankelijk herbouwen en beoordelen;
3. het vastgelegde opslag-, CSP- en panic-herstelontwerp in een geisoleerde
   browser-QA-build implementeren;
4. die provider met dezelfde Android-browser-vectors valideren;
5. pas na beide gates een productiepilot overwegen.

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
Android-only `v2_pending`-pilot is eveneens geslaagd. De onafhankelijke
securityreview en een versiegelijkwaardige browserprovider zijn nog niet afgerond; een
productiepilot blijft daarom geblokkeerd. De huidige mock-serviceflow mag nog
steeds niet als E2EE worden geactiveerd.
