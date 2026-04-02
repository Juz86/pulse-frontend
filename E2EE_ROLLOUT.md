# Pulse E2EE Rollout

Deze codebase bevat nu een gefaseerde frontend-basis voor end-to-end encryptie.

## Huidige frontendstatus

- Device bootstrap draait na login via [src/App.js](/home/yushuaabdulkadir/pulse-frontend/src/App.js).
- Lokale identity- en session-opslag staat onder [src/lib/e2ee](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee).
- Berichten worden bij laden en live ontvangst gehydrateerd via [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js).
- `useConversations` kan gefaseerd overschakelen van socket-transport naar service-transport voor 1-op-1 chats.
- Bewerken van `signal_v1`-berichten is bewust uitgeschakeld totdat daar een apart encrypted edit-model voor is.

## Feature flags

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

## Backend endpoints die nog nodig zijn

De frontend verwacht deze endpoints:

1. `POST /devices/register`
   Response:
   ```json
   {
     "deviceId": "device_abc123",
     "status": "registered"
   }
   ```

2. `GET /users/:userId/key-bundle`
   Response:
   ```json
   {
     "userId": "target_uid",
     "devices": [
       {
         "deviceId": "device_target_1",
         "identityPublicKey": "base64-or-string",
         "signedPreKey": {
           "keyId": 77,
           "publicKey": "base64-or-string",
           "signature": "base64-or-string"
         },
         "oneTimePreKey": {
           "keyId": 9001,
           "publicKey": "base64-or-string"
         }
       }
     ],
     "protocolVersion": 1
   }
   ```

3. `POST /messages/send`
   Response:
   ```json
   {
     "messageId": "msg_123",
     "accepted": true
   }
   ```

4. `GET /api/messages/:convId`
   Deze endpoint moet zowel legacy plaintext als `signal_v1` wire messages kunnen teruggeven.

5. Socket event `message:new`
   De frontend luistert al naar zowel `message:received` als `message:new`.

## Aanbevolen backendvolgorde

1. Voeg `POST /devices/register` toe.
2. Voeg `GET /users/:userId/key-bundle` toe met parent/trusted-contact checks.
3. Voeg `POST /messages/send` toe.
4. Laat `GET /api/messages/:convId` gemengde legacy + `signal_v1` records teruggeven.
5. Introduceer daarna `message:new` voor realtime wire delivery.

## Volgende frontendstap na backend

Zodra de backend-endpoints er zijn:

1. Zet `REACT_APP_E2EE_TRANSPORT=service`.
2. Test 1-op-1 versturen en ontvangen met mock-crypto.
3. Vervang daarna pas de mock adapter door een echte crypto-adapter.

## Belangrijke productnuance

Pulse ondersteunt hiermee een model waarin:

- ouders toezicht houden op contacten, instellingen en metadata
- maar berichtinhoud niet automatisch server-side gelezen hoeft te worden

Dat past beter bij echte E2EE dan een model met standaard inhoudsinzage.
