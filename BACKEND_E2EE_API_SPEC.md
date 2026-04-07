# Pulse Backend E2EE API Spec

Dit document beschrijft het minimale backendcontract dat de huidige frontend verwacht voor de gefaseerde E2EE-rollout voor chatten, bellen en videobellen.

De frontend is bewust voorbereid op een overgangsfase waarin legacy plaintext en `signal_v1` naast elkaar bestaan.

Belangrijk:

- media of bestanden versturen tussen gebruikers valt niet binnen deze actieve productscope
- profielafbeeldingen of avatar-instellingen vallen buiten deze bericht-API

## Feature flags

Relevante frontendflags:

- `REACT_APP_E2EE_MODE=mock`
- `REACT_APP_E2EE_TRANSPORT=socket|service`

Bij `service` verwacht de frontend de endpoints hieronder.

## 1. Device bootstrap

### `POST /devices/register`

Doel:
- registreer een device voor de ingelogde gebruiker
- sla public identity key, signed prekey en one-time prekeys op

Headers:
- `Authorization: Bearer <firebase-id-token>`
- `Content-Type: application/json`

Request:

```json
{
  "deviceLabel": "MacIntel",
  "identityPublicKey": "base64-or-string",
  "signedPreKey": {
    "keyId": 1712060000000,
    "publicKey": "base64-or-string",
    "signature": "base64-or-string"
  },
  "oneTimePreKeys": [
    {
      "keyId": 1,
      "publicKey": "base64-or-string"
    }
  ],
  "platform": "web",
  "protocol": "signal_v1",
  "protocolVersion": 1
}
```

Response:

```json
{
  "deviceId": "device_abc123",
  "status": "registered"
}
```

Validatie:
- authenticated user required
- `deviceId` moet uniek zijn
- `signedPreKey` en `oneTimePreKeys` moeten per user/device opgeslagen kunnen worden

## 2. Key bundle lookup

### `GET /users/:userId/key-bundle`

Doel:
- geef key bundles terug voor toegestane ontvangerdevices
- alleen als trusted contact / parent policy dit toestaat

Headers:
- `Authorization: Bearer <firebase-id-token>`

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

Validatie:
- requester moet authenticated zijn
- requester moet volgens Pulse-regels deze gebruiker mogen benaderen
- bij voorkeur one-time prekeys transactioneel reserveren

## 3. Send message

### `POST /messages/send`

Doel:
- accepteer encrypted payloads
- sla wire message + recipient payloads op

Headers:
- `Authorization: Bearer <firebase-id-token>`
- `Content-Type: application/json`

Request:

```json
{
  "conversationId": "conv_1",
  "senderDeviceId": "device_sender_1",
  "ciphertext": "base64-ciphertext",
  "messageType": "text",
  "protocol": "signal_v1",
  "protocolVersion": 1,
  "replyToMessageId": null,
  "recipientPayloads": [
    {
      "recipientUserId": "target_uid",
      "recipientDeviceId": "device_target_1",
      "encryptedMessageKey": "base64-or-string"
    }
  ]
}
```

Response:

```json
{
  "messageId": "msg_123",
  "accepted": true
}
```

Validatie:
- requester moet participant zijn in `conversationId`
- requester mag alleen naar toegestane contacts sturen
- `recipientPayloads` mogen alleen devices bevatten die bij de ontvanger horen
- server mag geen plaintext body verwachten

## 4. Conversation messages

### `GET /api/messages/:convId?limit=30&offset=0`

Doel:
- geef bestaande berichten terug
- mixed mode ondersteunen: legacy plaintext én `signal_v1`

Legacy voorbeeld:

```json
[
  {
    "id": "msg_old_1",
    "conversationId": "conv_1",
    "senderId": "uid_a",
    "text": "Hallo",
    "createdAt": "2026-04-02T10:00:00Z",
    "protocol": "legacy_plaintext"
  }
]
```

Encrypted voorbeeld:

```json
[
  {
    "id": "msg_new_1",
    "conversationId": "conv_1",
    "senderUserId": "uid_b",
    "senderDeviceId": "device_b_1",
    "ciphertext": "base64-ciphertext",
    "encryptedMessageKey": "base64-or-string",
    "createdAt": "2026-04-02T10:01:00Z",
    "protocol": "signal_v1",
    "protocolVersion": 1,
    "messageType": "text",
    "replyToMessageId": null
  }
]
```

Minimumeis:
- frontend moet aan de hand van `protocol` kunnen kiezen hoe te hydrateren

## 5. Receipts

### `POST /messages/receipt`

Doel:
- delivery/read status opslaan

Headers:
- `Authorization: Bearer <firebase-id-token>`
- `Content-Type: application/json`

Request:

```json
{
  "messageId": "msg_123",
  "recipientDeviceId": "device_me_1",
  "type": "delivered"
}
```

of

```json
{
  "messageId": "msg_123",
  "recipientDeviceId": "device_me_1",
  "type": "read"
}
```

Response:

```json
{
  "ok": true
}
```

## 6. Conversation list

### `GET /api/conversations/:uid`

Deze endpoint mag voorlopig compatibel blijven met de bestaande frontend.

Voorbeeld:

```json
[
  {
    "id": "conv_1",
    "members": ["uid_a", "uid_b"],
    "memberNames": {
      "uid_a": "Jij",
      "uid_b": "Contact"
    },
    "memberEmails": {
      "uid_b": "vriend@example.com"
    },
    "isGroup": false,
    "lastMessage": "Hallo",
    "updatedAt": "2026-04-02T10:01:00Z"
  }
]
```

Later kan `lastMessage` generieker worden, bijvoorbeeld `Versleuteld bericht`, of lokaal uit decrypted messages worden afgeleid.

## 7. Socket events

De frontend ondersteunt nu:

- bestaand: `message:received`
- nieuw voorbereid: `message:new`

Aanbevolen nieuw event:

### `message:new`

Payload:

```json
{
  "id": "msg_123",
  "conversationId": "conv_1",
  "senderUserId": "uid_b",
  "senderDeviceId": "device_b_1",
  "ciphertext": "base64-ciphertext",
  "encryptedMessageKey": "base64-or-string",
  "createdAt": "2026-04-02T10:01:00Z",
  "protocol": "signal_v1",
  "protocolVersion": 1,
  "messageType": "text"
}
```

De frontend hydrateert deze payload lokaal.

## 8. Parent / trusted-contact rules

Backend moet hard afdwingen:

- alleen goedgekeurde contacten mogen key bundles opvragen
- alleen goedgekeurde contacten mogen berichten versturen
- kinderen mogen niet vrij nieuwe ontvangers targeten buiten parent policy

Deze checks moeten server-side gebeuren, niet alleen in de frontend.

## 9. Rollout volgorde

Aanbevolen backendvolgorde:

1. `POST /devices/register`
2. `GET /users/:userId/key-bundle`
3. `POST /messages/send`
4. `GET /api/messages/:convId` met mixed protocol support
5. `message:new` realtime event

Aanbevolen frontendactivatie daarna:

1. houd `REACT_APP_E2EE_MODE=mock`
2. zet `REACT_APP_E2EE_TRANSPORT=service`
3. test 1-op-1 direct chats
4. vervang daarna pas mock-crypto door echte crypto
