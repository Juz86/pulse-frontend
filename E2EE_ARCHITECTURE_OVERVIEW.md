# Pulse E2EE Architecture Overview

Dit document beschrijft kort hoe de huidige E2EE-voorbereiding in de frontendrepo is opgezet.

## Doel

De frontend moet in twee modi kunnen werken:

- huidige veilige modus:
  bestaande socketchat blijft werken
- voorbereid E2EE-pad:
  service-based berichtflow met lokale encryptie/decryptie

Daarom is de implementatie bewust opgesplitst in kleine lagen.

## Belangrijkste Lagen

### Config

- [src/lib/e2ee/config.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/config.js)

Verantwoordelijk voor:

- `REACT_APP_E2EE_MODE`
- `REACT_APP_E2EE_TRANSPORT`
- bepalen of device bootstrap nodig is

## Lokale Storage

- [src/lib/e2ee/secureKeyStore.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/secureKeyStore.js)
- [src/lib/e2ee/sessionStore.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/sessionStore.js)

Verantwoordelijk voor:

- lokale device identity
- lokale sessiestatus per remote device

## Crypto Adapter

- [src/lib/e2ee/adapter/pulseCryptoAdapter.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/adapter/pulseCryptoAdapter.js)
- [src/lib/e2ee/adapter/pulseCryptoMock.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/adapter/pulseCryptoMock.js)

Verantwoordelijk voor:

- key generation
- sessie-opbouw
- encryptie
- decryptie

Belangrijk:

- de rest van de app kent alleen de adapterinterface
- echte crypto kan later de mock-implementatie vervangen zonder grote UI-refactor

## Bootstrap En Messaging

- [src/lib/e2ee/deviceBootstrap.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/deviceBootstrap.js)
- [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)

`deviceBootstrap.js` doet:

- identity maken
- device registreren
- lokale identity opslaan

`messagingService.js` doet:

- key bundle ophalen
- sessies aanmaken indien nodig
- berichten encrypten voor versturen
- binnenkomende wire messages hydrateren naar UI-berichten

## Message En Policy Helpers

- [src/lib/e2ee/messageModel.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messageModel.js)
- [src/lib/e2ee/policy.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/policy.js)

`messageModel.js` centraliseert:

- normalisatie van binnenkomende berichten
- optimistic pending message shape
- sent/failed patching
- preview- en display-fallbacks

`policy.js` centraliseert:

- wanneer een bericht als encrypted telt
- wanneer edits wel of niet zijn toegestaan

## App Integratie

- [src/App.js](/home/yushuaabdulkadir/pulse-frontend/src/App.js)
- [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)
- [src/hooks/useChat.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useChat.js)

### `App.js`

Doet conditioneel device bootstrap bij login.

### `useConversations.js`

Verantwoordelijk voor:

- laden van berichten
- optimistic send flow
- retry
- forward
- keuze tussen sockettransport en servicetransport

### `useChat.js`

Verantwoordelijk voor:

- realtime events
- hydratie van binnenkomende berichten
- statusupdates
- compatibiliteit met legacy socket-events en toekomstig `message:new`

## UI Laag

- [src/components/MessageBubble.js](/home/yushuaabdulkadir/pulse-frontend/src/components/MessageBubble.js)
- [src/components/ConversationItem.js](/home/yushuaabdulkadir/pulse-frontend/src/components/ConversationItem.js)
- [src/components/MsgContextMenu.js](/home/yushuaabdulkadir/pulse-frontend/src/components/MsgContextMenu.js)
- [src/screens/ChatScreen.js](/home/yushuaabdulkadir/pulse-frontend/src/screens/ChatScreen.js)

Verantwoordelijk voor:

- renderen van fallbacktekst zoals `Versleuteld bericht`
- tonen van consistente previews
- blokkeren van legacy edit-acties op encrypted berichten

## Huidige Runtime Modus

Veilige standaard:

- `REACT_APP_E2EE_MODE=mock`
- `REACT_APP_E2EE_TRANSPORT=socket`

Dat betekent:

- bestaande chat blijft leidend
- E2EE-lagen zijn aanwezig maar nog niet volledig actief

## Activatiepad

De bedoelde volgorde is:

1. backend bouwt de benodigde endpoints
2. frontend zet `REACT_APP_E2EE_TRANSPORT=service`
3. direct chats worden getest met mock crypto
4. daarna pas echte crypto-adapter inpluggen

## Lees Verder

- [E2EE_DOCS_INDEX.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_DOCS_INDEX.md)
- [E2EE_IMPLEMENTATION_STATUS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_IMPLEMENTATION_STATUS.md)
- [E2EE_ROLLOUT.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ROLLOUT.md)
