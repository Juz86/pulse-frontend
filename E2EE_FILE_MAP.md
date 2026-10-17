# Pulse E2EE File Map

Dit document koppelt de belangrijkste E2EE-bestanden aan hun rol in de codebase.

## Frontend Kernbestanden

### [src/App.js](/home/yushuaabdulkadir/pulse-frontend/src/App.js)

Rol:

- conditionele device bootstrap bij login

Status:

- voorbereid
- gekoppeld aan configflags

### [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)

Rol:

- laden van berichten
- optimistic send/retry/forward
- switch tussen sockettransport en servicetransport

Status:

- voorbereid voor serviceflow
- socketflow blijft fallback

### [src/hooks/useChat.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useChat.js)

Rol:

- realtime events
- hydratie van live binnenkomende berichten
- status- en edit-policy compatibiliteit

Status:

- voorbereid op `message:new`
- legacy compatibiliteit aanwezig

## E2EE Infrastructuur

### [src/lib/e2ee/v2/protocolV2Contract.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/protocolV2Contract.js)

Rol:

- bindende `pulse_e2ee_v2`-payloadschemas
- fail-closed validatie van device-registratie en key-bundle claims
- exacte per-device recipient-validatie bij send en delivery

Status:

- geimplementeerd en getest
- bewust nog niet gekoppeld aan runtime of featureflags

### [src/lib/e2ee/config.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/config.js)

Rol:

- centrale feature flags voor mode en transport

Status:

- actief

### [src/lib/e2ee/deviceBootstrap.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/deviceBootstrap.js)

Rol:

- identity opzetten
- device registreren via backend

Status:

- klaar voor backendkoppeling
- gebruikt nog mock crypto-adapter

### [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)

Rol:

- key bundle ophalen
- sessies aanmaken
- sendflow via backend
- hydration van wire messages

Status:

- centrale servicefaçade
- gebruikt nog mock crypto-adapter

### [src/lib/e2ee/messageModel.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messageModel.js)

Rol:

- normalisatie
- pending message shape
- sent/failed patching
- preview- en displayhelpers

Status:

- actief

### [src/lib/e2ee/policy.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/policy.js)

Rol:

- regels rond encrypted berichten
- edit-policy

Status:

- actief

### [src/lib/e2ee/secureKeyStore.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/secureKeyStore.js)

Rol:

- lokale identityopslag

Status:

- functioneel voor huidige tussenfase
- later aanscherpen voor sterkere security

### [src/lib/e2ee/sessionStore.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/sessionStore.js)

Rol:

- lokale sessiestatus per remote device

Status:

- functioneel voor huidige tussenfase

## Crypto Adapter

### [src/lib/e2ee/adapter/pulseCryptoAdapter.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/adapter/pulseCryptoAdapter.js)

Rol:

- abstractielaag tussen app en crypto

Status:

- actief

### [src/lib/e2ee/adapter/pulseCryptoMock.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/adapter/pulseCryptoMock.js)

Rol:

- mock implementatie voor architectuur- en backendintegratie

Status:

- actief
- nog geen echte cryptografie

## UI Bestanden Met E2EE-Impact

### [src/components/MessageBubble.js](/home/yushuaabdulkadir/pulse-frontend/src/components/MessageBubble.js)

Rol:

- statusweergave
- fallbacktekst zoals `Versleuteld bericht`

### [src/components/ConversationItem.js](/home/yushuaabdulkadir/pulse-frontend/src/components/ConversationItem.js)

Rol:

- veilige previewweergave

### [src/components/MsgContextMenu.js](/home/yushuaabdulkadir/pulse-frontend/src/components/MsgContextMenu.js)

Rol:

- verbergt editoptie voor encrypted berichten

### [src/screens/ChatScreen.js](/home/yushuaabdulkadir/pulse-frontend/src/screens/ChatScreen.js)

Rol:

- extra guard op legacy editflow

## Tests

### [src/lib/e2ee/v2/protocolV2Contract.test.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/protocolV2Contract.test.js)

Rol:

- positieve contractvoorbeelden vastleggen
- legacy-, plaintext-, duplicate-, fan-out- en device-mismatchgevallen weigeren

Status:

- 47 tests aanwezig en geslaagd

## Backend v2

### `/home/yushuaabdulkadir/pulse-backend/src/e2ee/v2`

Rol:

- strikte Zod-contracten voor v2-deviceverkeer
- transactionele device-lifecycle
- atomische en idempotente one-time-prekey-claims
- security events voor identity changes en ingetrokken devices
- transactionele per-device message-fan-out en envelope-opslag
- geverifieerde socket-device binding met inhoudsloze beschikbaarheidsevents
- geauthenticeerde fetch van uitsluitend de eigen device-envelope
- geverifieerde `senderSignalDeviceId` in iedere delivery-envelope
- geverifieerde `senderIdentityVersion` in iedere delivery-envelope
- uniqueness van Signal-device-ID's binnen de volledige devicehistorie

Status:

- geimplementeerd en getest
- naast legacyroutes gemonteerd en door de geisoleerde v2-client getest, maar
  nog niet aan de actieve chatruntime gekoppeld
- standaard uitgeschakeld met `E2EE_V2_ENABLED=false`

## Android v2-providerbasis

### `android/app/src/main/java/com/pulsemessenger/chat/e2ee/v2`

Rol:

- Keystore-backed AES-GCM-opslag voor serialized private protocolrecords
- gehashte recordadressering en AAD-binding
- capabilityrapportage zonder private material over de JavaScript-bridge
- persistente libsignal identity-, prekey-, Kyber- en sessiestore
- native bootstrap, tekst-encryptie en tekst-decryptie
- persistente mapping van opaque backend-device-ID naar Signal-device-ID

Status:

- lokale Android-provider geimplementeerd en met restart-roundtrips getest
- status blijft tot echte-devicevalidatie `providerAvailable: false`;
  productiechatkoppeling blijft uit
- echte-device-, multi-device- en distributietests staan nog open

### [src/lib/e2ee/v2/nativeAndroidProvider.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/nativeAndroidProvider.js)

Rol:

- smalle fail-closed JavaScript-adapter voor de Android Capacitor-plugin
- maakt geen private key- of sessie-export beschikbaar

Status:

- geimplementeerd en getest buiten de actieve chatruntime

### [src/lib/e2ee/v2/v2ApiClient.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/v2ApiClient.js)

Rol:

- geauthenticeerde en contractgevalideerde toegang tot de v2-backendroutes
- bewaakt device-registratie, bundleclaims, recipientsets en envelope-eigendom
- behoudt stabiele backendfoutcodes zonder cryptografische payloads te loggen

Status:

- geimplementeerd en getest, maar nog niet vanuit de chatruntime aangeroepen

### [src/lib/e2ee/v2/androidDeviceRegistration.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/androidDeviceRegistration.js)

Rol:

- combineert native publieke bootstrapdata met backend-device-registratie
- stopt voordat bootstrap begint zolang `providerAvailable` niet waar is

Status:

- geimplementeerd en fail-closed; productieprovidergate blijft dicht

### [src/lib/e2ee/v2/androidMessageOrchestrator.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/androidMessageOrchestrator.js)

Rol:

- hergebruikt bestaande native sessies zonder per bericht nieuwe prekeys te
  claimen
- claimt recipient- en sibling-devicebundles voor ontbrekende sessies
- bouwt exact een ciphertext-envelope per actief doeldevice
- haalt uitsluitend de lokale envelope op en geeft het geverifieerde Signal-
  adres van de afzender aan native decryptie door

Status:

- geimplementeerd en getest achter de gesloten native providergate
- nog niet aan de actieve chatruntime gekoppeld

### [src/lib/e2ee/v2/androidSessionLifecycle.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/androidSessionLifecycle.js)

Rol:

- valideert servergestuurde identity-change- en revoke-events fail-closed
- wist alleen de betrokken remote sessie en trusted identity
- wist alle lokale E2EE-records wanneer het huidige device wordt ingetrokken
- geeft expliciet terug wanneer herregistratie nodig is

Status:

- geimplementeerd en getest achter de gesloten native providergate
- herstel- en herregistratie-UX wachten op de echte-deviceproef

### [src/lib/e2ee/v2/androidSocketLifecycle.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/androidSocketLifecycle.js)

Rol:

- verwerkt identity-, revoke- en inhoudsloze message-available-events in vaste
  volgorde om ratchetraces te voorkomen
- dedupliceert gespiegeld of herhaald aangeboden events
- maakt een mislukte verwerking opnieuw uitvoerbaar en meldt alleen de eigen
  listeners af

Status:

- geimplementeerd en getest achter de gesloten native providergate
- nog niet aan de actieve chatruntime gekoppeld

### [src/services/socket.js](/home/yushuaabdulkadir/pulse-frontend/src/services/socket.js)

E2EE v2-rol:

- bindt een gevalideerd opaque v2-device-ID aan Socket.IO-authenticatie
- herverbindt een actieve socket wanneer die devicebinding wijzigt

Status:

- geimplementeerd en getest
- wordt pas gebruikt wanneer de interne v2-runtime na echte-devicevalidatie
  wordt geactiveerd

Zie ook
[E2EE_ANDROID_PROVIDER_GATE.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ANDROID_PROVIDER_GATE.md).

### [src/lib/e2ee/e2ee.test.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/e2ee.test.js)

Rol:

- test de helperlaag rond message model en policy

Status:

- aanwezig

## Praktisch Gebruik

Gebruik deze file map samen met:

- [E2EE_ARCHITECTURE_OVERVIEW.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ARCHITECTURE_OVERVIEW.md)
- [E2EE_BACKLOG.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKLOG.md)
- [E2EE_TEST_MATRIX.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_TEST_MATRIX.md)

Belangrijk:

- deze file map volgt de actieve E2EE-scope voor chatten, bellen en videobellen
- chatmedia of attachments versturen tussen gebruikers hoort niet bij deze productscope
