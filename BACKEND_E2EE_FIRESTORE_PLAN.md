# Pulse Backend E2EE Firestore Plan

Dit document beschrijft een praktisch Firestore-plan voor de backendroutes en services die de frontend inmiddels verwacht voor chatten, bellen en videobellen.

Het doel is:

- encrypted message delivery mogelijk maken
- ouderbeleid centraal server-side afdwingen
- bestaande ParentDashboard-shapes zo veel mogelijk compatibel houden

Belangrijk:

- media of bestanden versturen tussen gebruikers valt niet binnen deze actieve productscope
- profielafbeeldingen of avatar-keuze vallen buiten dit berichten- en Firestore-plan

## Uitgangspunten

- berichtinhoud wordt bij `signal_v1` niet als plaintext opgeslagen
- Firestore blijft bron van waarheid voor devices, policies en message metadata
- ParentDashboard gebruikt metadata, niet berichtinhoud

## Collecties

### `users`

Doel:
- basisprofiel
- rol
- parent-child relatie

Documentvoorbeeld:

```json
{
  "uid": "uid_child_1",
  "displayName": "Sara",
  "username": "sara123",
  "email": "sara@pulse.internal",
  "role": "child",
  "parentUid": "uid_parent_1",
  "managedByParentId": "uid_parent_1",
  "photoURL": null,
  "createdAt": "2026-04-03T09:00:00Z",
  "status": "active"
}
```

### `child_policies`

Doel:
- feature rules per kind
- contactregels
- quiet hours

Document-id:
- `childUid`

Documentvoorbeeld:

```json
{
  "childId": "uid_child_1",
  "managedByParentId": "uid_parent_1",
  "contactRules": {
    "requiresParentApproval": true,
    "allowOnlyApprovedContacts": true
  },
  "featureRules": {
    "chat": true,
    "call": true,
    "video": false
  },
  "visibilityRules": {
    "showUsageStatsToParent": true,
    "showContactListToParent": true,
    "showMessageContentToParent": false
  },
  "scheduleRules": {
    "quietHoursEnabled": true,
    "quietHoursStart": "20:00",
    "quietHoursEnd": "07:00",
    "timezone": "Europe/Amsterdam"
  },
  "updatedAt": "2026-04-03T09:30:00Z"
}
```

### `approved_contacts`

Doel:
- goedgekeurde kind-contactrelaties
- per contact chat/call/video toestemming
- blokkeren/deblokkeren

Document-id:
- `${childUid}_${targetUid}`

Documentvoorbeeld:

```json
{
  "childId": "uid_child_1",
  "targetUid": "uid_contact_9",
  "approved": true,
  "approvedByParentId": "uid_parent_1",
  "chat": true,
  "call": true,
  "video": false,
  "blocked": false,
  "createdAt": "2026-04-03T09:45:00Z"
}
```

### `devices`

Doel:
- E2EE key material lookup per device
- actieve/revoked device lifecycle

Documentvoorbeeld:

```json
{
  "id": "device_abc123",
  "userId": "uid_child_1",
  "deviceLabel": "iPhone 15",
  "identityPublicKey": "base64...",
  "signedPreKey": {
    "keyId": 77,
    "publicKey": "base64...",
    "signature": "base64..."
  },
  "oneTimePreKeys": [
    { "keyId": 1, "publicKey": "base64..." },
    { "keyId": 2, "publicKey": "base64..." }
  ],
  "platform": "ios",
  "protocol": "signal_v1",
  "protocolVersion": 1,
  "status": "active",
  "createdAt": "2026-04-03T10:00:00Z",
  "revokedAt": null
}
```

### `conversations`

Doel:
- lidmaatschap
- updatetijd
- veilige preview voor bestaande conversation list

Documentvoorbeeld:

```json
{
  "id": "conv_1",
  "members": ["uid_child_1", "uid_contact_9"],
  "memberNames": {
    "uid_child_1": "Sara",
    "uid_contact_9": "Oma"
  },
  "memberEmails": {
    "uid_contact_9": "oma@example.com"
  },
  "isGroup": false,
  "groupName": null,
  "updatedAt": "2026-04-03T10:05:00Z",
  "lastMessage": "Versleuteld bericht",
  "lastCallDirection": null,
  "lastCallSenderId": null,
  "lastCallIsVideo": null
}
```

### `messages`

Doel:
- encrypted wire message store
- mixed legacy + `signal_v1` fase ondersteunen

Documentvoorbeeld:

```json
{
  "id": "msg_123",
  "conversationId": "conv_1",
  "senderUserId": "uid_child_1",
  "senderDeviceId": "device_child_phone",
  "ciphertext": "base64...",
  "messageType": "text",
  "protocol": "signal_v1",
  "protocolVersion": 1,
  "replyToMessageId": null,
  "createdAt": "2026-04-03T10:05:00Z",
  "deliveryState": "sent"
}
```

Legacy voorbeeld:

```json
{
  "id": "msg_old_1",
  "conversationId": "conv_1",
  "senderId": "uid_contact_9",
  "text": "Hallo",
  "createdAt": "2026-04-02T10:00:00Z",
  "protocol": "legacy_plaintext"
}
```

### `message_recipients`

Doel:
- delivery/read tracking per recipient device

Documentvoorbeeld:

```json
{
  "messageId": "msg_123",
  "recipientUserId": "uid_contact_9",
  "recipientDeviceId": "device_contact_ipad",
  "encryptedMessageKey": "base64...",
  "deliveredAt": null,
  "readAt": null
}
```

### `policy_events`

Doel:
- ouderacties
- denied policy checks
- veiligheidsrelevante audit trail

Documentvoorbeeld:

```json
{
  "actorUid": "uid_parent_1",
  "childUid": "uid_child_1",
  "targetUid": "uid_contact_9",
  "action": "update_contact_policy",
  "allowed": true,
  "reason": null,
  "createdAt": "2026-04-03T10:10:00Z"
}
```

## Belangrijkste queries

### ParentDashboard kinderen

Route:
- `GET /api/parent/children`

Bron:
- `users` filter op `parentUid == currentParentUid`
- `child_policies` per child

Output kan blijven:

```json
{
  "uid": "uid_child_1",
  "displayName": "Sara",
  "username": "sara123",
  "online": false,
  "pausedFeatures": {
    "chat": false,
    "call": true,
    "video": true
  }
}
```

### ParentDashboard contacten

Route:
- `GET /api/parent/child/:childUid/contacts`

Bron:
- `approved_contacts` filter op `childId == :childUid`
- `users` join-achtig verrijken voor naam/avatar

### Key bundle lookup

Route:
- `GET /users/:userId/key-bundle`

Bron:
- `devices` filter op `userId == targetUserId` en `status == active`
- policy check via `child_policies` + `approved_contacts`

### Message feed

Route:
- `GET /api/messages/:convId`

Bron:
- `messages` filter op `conversationId == :convId`
- `orderBy(createdAt, desc)`

### Receipts

Route:
- `POST /messages/receipt`

Bron:
- `message_recipients`

## Firestore index-plan

Waarschijnlijk nodig:

### `devices`

- `userId ASC, status ASC`

Voor:
- actieve devices van target user ophalen

### `messages`

- `conversationId ASC, createdAt DESC`

Voor:
- berichtenlijst per conversation met paginatie

### `approved_contacts`

- `childId ASC`

Voor:
- alle goedgekeurde contacten van kind ophalen

### `policy_events`

- `childUid ASC, createdAt DESC`

Voor:
- activiteitenoverzicht per kind

## Query-aanpak voor ParentDashboard

### Aanbevolen

Laat backend de frontendshape server-side al construeren.

Dus:
- frontend houdt huidige API-shapes
- backend leest nieuwe collecties
- backend mapped alles terug naar dashboardvorm

Dat voorkomt een grote frontendrefactor.

## Security en eigenaarschap

### Firestore via Admin SDK

Voor backendroutes:
- gebruik Admin SDK
- route-auth bepaalt toegang
- niet vertrouwen op client Firestore rules voor policy enforcement

### Client-side Firestore rules

De frontend mag zo min mogelijk rechtstreeks in deze collecties schrijven.

Bij voorkeur:
- devices, policies en recipients alleen via backend

## Rolloutstrategie

1. maak collecties `devices`, `child_policies`, `approved_contacts`, `message_recipients`, `policy_events`
2. laat bestaande routes backendmatig lezen/schrijven uit deze nieuwe bronnen
3. voeg E2EE-routes toe uit `BACKEND_E2EE_API_SPEC.md`
4. activeer frontend `service` transport

## Praktische aanbeveling

Voor Pulse is de kleinste werkende backendcombinatie:

- `users`
- `child_policies`
- `approved_contacts`
- `devices`
- `conversations`
- `messages`
- `message_recipients`

`policy_events` is sterk aanbevolen, maar kan als eerste auditlaag desnoods iets later.
