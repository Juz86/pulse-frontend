# Pulse E2EE Rollout

Deze codebase bevat nu een gefaseerde frontend-basis voor end-to-end encryptie.

Volledig documentatie-overzicht:

- [E2EE_DOCS_INDEX.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_DOCS_INDEX.md)

## Huidige frontendstatus

- Device bootstrap draait na login via [src/App.js](/home/yushuaabdulkadir/pulse-frontend/src/App.js).
- Lokale identity- en session-opslag staat onder [src/lib/e2ee](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee).
- Berichten worden bij laden en live ontvangst gehydrateerd via [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js).
- `useConversations` kan gefaseerd overschakelen van socket-transport naar service-transport voor 1-op-1 chats.
- De huidige scope blijft bewust bij chatten, bellen en videobellen.
- Bewerken van `signal_v1`-berichten is bewust uitgeschakeld totdat daar een apart encrypted edit-model voor is.

## Feature flags

Veilige voorbeeldconfig:

- [.env.example](/home/yushuaabdulkadir/pulse-frontend/.env.example)

- `REACT_APP_E2EE_MODE=mock`
  Betekent: gebruik de mock crypto-adapter.

- `REACT_APP_E2EE_TRANSPORT=socket`
  Betekent: gebruik de bestaande socket-flow voor versturen.

De centrale frontend-config staat in [src/lib/e2ee/config.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/config.js).

Belangrijk:

- device bootstrap draait alleen als `REACT_APP_E2EE_TRANSPORT=service` of `REACT_APP_E2EE_MODE=signal`
- zolang beide flags op de veilige standaard staan, blijft de bestaande chatflow actief zonder verplichte backend-E2EE-endpoints

Voor de eerste backend-integratie:

- laat `REACT_APP_E2EE_MODE=mock`
- zet `REACT_APP_E2EE_TRANSPORT=service`

Dan gebruikt de frontend al de nieuwe REST/service-flow, maar nog met mock-crypto.

## Huidige lokale servicefase

Lokaal zijn inmiddels werkend en getest:

- `POST /devices/register`
- `GET /users/:userId/key-bundle`
- `POST /messages/send`
- `POST /messages/receipt`
- `GET /api/messages/:convId`
- realtime `message:new` / `message:status`

De volgende backend-/rolloutstap is daardoor niet meer “basisroutes bouwen”, maar:

1. `/readyz` en rollout-monitoring verder harden
2. handmatige acceptatie over de volledige flow afronden
3. de chat/bel/video-scope veilig activeren zonder scopegroei

## Volgende frontendstap na de huidige lokale fase

Nu de lokale servicefase staat:

1. doorloop de handmatige acceptatieronde
2. valideer chat, bel en video op regressies
3. bevestig dat chatmedia buiten scope blijft

## Belangrijke productnuance

Pulse ondersteunt hiermee een model waarin:

- ouders toezicht houden op contacten, instellingen en metadata
- maar berichtinhoud niet automatisch server-side gelezen hoeft te worden

Dat past beter bij echte E2EE dan een model met standaard inhoudsinzage.
