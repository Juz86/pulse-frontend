# Pulse E2EE Rollout

> **Status: mock/legacy rolloutdocument.** De beschreven `signal_v1`-servicefase
> bewijst alleen integratie en mag niet als echte E2EE worden geactiveerd. Voor
> de beveiligde opvolger en actuele rolloutgates is
> [E2EE_PROTOCOL_V2_DECISION.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_PROTOCOL_V2_DECISION.md)
> leidend.

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

Voor uitsluitend lokale integratietests:

- laat `REACT_APP_E2EE_MODE=mock`
- zet `REACT_APP_E2EE_TRANSPORT=service`

Dan gebruikt de frontend de REST/service-flow met mock-crypto. Deze configuratie
is niet geschikt voor productie, een pilot of een E2EE-productclaim.

## Huidige lokale servicefase

Lokaal zijn inmiddels werkend en getest:

- `POST /devices/register`
- `GET /users/:userId/key-bundle`
- `POST /messages/send`
- `POST /messages/receipt`
- `GET /api/messages/:convId`
- realtime `message:new` / `message:status`

De volgende echte E2EE-stap is niet het activeren van deze routes, maar:

1. `pulse_e2ee_v2`-schema's en negatieve contracttests toevoegen
2. atomische prekey-claims en per-device envelopes implementeren
3. de native Android-provider bewijzen zonder plaintext over de JS-bridge
4. een browserprovider selecteren en met dezelfde vectors valideren

## Volgende frontendstap na de huidige lokale fase

Voor de volgende implementatiefase:

1. houd productie op `mock + socket`, zonder E2EE-claim
2. bouw v2 naast legacy en voorkom iedere automatische downgrade
3. start pas een interne pilot nadat alle gates uit het v2-besluit slagen

## Belangrijke productnuance

Pulse ondersteunt hiermee een model waarin:

- ouders toezicht houden op contacten, instellingen en metadata
- maar berichtinhoud niet automatisch server-side gelezen hoeft te worden

Dat past beter bij echte E2EE dan een model met standaard inhoudsinzage.
