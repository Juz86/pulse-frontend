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
