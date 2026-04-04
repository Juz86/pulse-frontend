# Pulse Backend Skeleton Request Examples

Deze voorbeelden helpen om de belangrijkste backendroutes handmatig te testen.

## Variabelen

Vervang in de voorbeelden:

- `<TOKEN>` met een geldig Firebase ID token
- `<BASE_URL>` met bijvoorbeeld `http://127.0.0.1:3001`
- ids zoals `uid_child_1`, `uid_contact_9` en `conv_1` met echte testdata

## Lokale Dev Bypass

Als je lokaal test zonder echte Firebase token, kun je tijdelijk gebruiken:

- `ALLOW_DEV_AUTH_BYPASS=true`
- header:
  `x-dev-uid: uid_child_1`

Belangrijk:

- dit is alleen bedoeld voor lokaal testen
- standaard staat dit uit

## Health

```bash
curl -s <BASE_URL>/
curl -s <BASE_URL>/health
curl -s <BASE_URL>/configz
curl -s <BASE_URL>/readyz
```

## Device Register

```bash
curl -X POST <BASE_URL>/devices/register \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceLabel": "Demo Browser",
    "identityPublicKey": "mock-public-key",
    "signedPreKey": {
      "keyId": 1,
      "publicKey": "mock-signed-prekey",
      "signature": "mock-signature"
    },
    "oneTimePreKeys": [
      { "keyId": 1, "publicKey": "mock-onetime-key-1" }
    ],
    "platform": "web",
    "protocol": "signal_v1",
    "protocolVersion": 1
  }'
```

Lokaal met dev bypass:

```bash
curl -X POST <BASE_URL>/devices/register \
  -H "x-dev-uid: uid_child_1" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceLabel": "Demo Browser",
    "identityPublicKey": "mock-public-key",
    "signedPreKey": {
      "keyId": 1,
      "publicKey": "mock-signed-prekey",
      "signature": "mock-signature"
    },
    "oneTimePreKeys": [
      { "keyId": 1, "publicKey": "mock-onetime-key-1" }
    ],
    "platform": "web",
    "protocol": "signal_v1",
    "protocolVersion": 1
  }'
```

## Key Bundle Lookup

```bash
curl -X GET "<BASE_URL>/users/uid_contact_9/key-bundle" \
  -H "Authorization: Bearer <TOKEN>"
```

## Send Message

```bash
curl -X POST <BASE_URL>/messages/send \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conv_1",
    "senderDeviceId": "device_sender_1",
    "ciphertext": "mock-ciphertext",
    "messageType": "text",
    "protocol": "signal_v1",
    "protocolVersion": 1,
    "replyToMessageId": null,
    "recipientPayloads": [
      {
        "recipientUserId": "uid_contact_9",
        "recipientDeviceId": "device_target_1",
        "encryptedMessageKey": "mock-envelope-key"
      }
    ]
  }'
```

## Receipt

```bash
curl -X POST <BASE_URL>/messages/receipt \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "msg_123",
    "recipientDeviceId": "device_target_1",
    "type": "delivered"
  }'
```

## Message Feed

```bash
curl -X GET "<BASE_URL>/messages/feed/conv_1?limit=30&offset=0" \
  -H "Authorization: Bearer <TOKEN>"
```

## Start Call

```bash
curl -X POST <BASE_URL>/calls/start \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "targetUid": "uid_contact_9",
    "isVideo": false
  }'
```

## Parent Policy

### Policy ophalen

```bash
curl -X GET "<BASE_URL>/api/parent/child/uid_child_1/policy" \
  -H "Authorization: Bearer <TOKEN>"
```

### Feature toggles updaten

```bash
curl -X PATCH <BASE_URL>/api/parent/child/uid_child_1/policy/features \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "chat": true,
    "call": true,
    "video": false
  }'
```

### Quiet hours updaten

```bash
curl -X PATCH <BASE_URL>/api/parent/child/uid_child_1/policy/schedule \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "quietHoursEnabled": true,
    "quietHoursStart": "20:00",
    "quietHoursEnd": "07:00",
    "timezone": "Europe/Amsterdam"
  }'
```

### Contacten ophalen

```bash
curl -X GET "<BASE_URL>/api/parent/child/uid_child_1/contacts" \
  -H "Authorization: Bearer <TOKEN>"
```

### Contact goedkeuren

```bash
curl -X POST <BASE_URL>/api/parent/child/uid_child_1/approved-contacts \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "targetUid": "uid_contact_9",
    "chat": true,
    "call": true,
    "video": false
  }'
```

### Contact blokkeren

```bash
curl -X POST <BASE_URL>/api/parent/child/uid_child_1/block-contact \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "targetUid": "uid_contact_9"
  }'
```

### Parent activiteiten

```bash
curl -X GET "<BASE_URL>/api/parent/activities" \
  -H "Authorization: Bearer <TOKEN>"
```
