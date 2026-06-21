# Pulse Backend Contract: Chat, Call, Video

> Overlap-notitie:
> Dit document is leidend voor Android ↔ backend contractafspraken rond chat,
> bellen en videobellen.
> `BACKEND_E2EE_API_SPEC.md` blijft aanvullend voor E2EE-transportdetails en
> overgangsscenario’s.

## Doel

Dit document is het normatieve contract tussen Android en de Pulse backend voor chat, bellen en videobellen.

## Kernregels

- De backend is de enige source of truth.
- Android vraagt acties aan, maar maakt geen definitieve records aan.
- PostgreSQL bewaart duurzame data.
- Redis bewaart alleen tijdelijke realtime state.
- FCM is alleen push fallback, nooit de primaire transport- of opslaglaag.

## 1. REST Endpoints

### 1.1 Auth- en sessievoorwaarden

Alle endpoints hieronder vereisen een geldige bearer token, behalve registratie/login/refresh.

| Methode | Pad | Doel |
|---|---|---|
| `POST` | `/native/auth/register` | Maak account en initiële sessie |
| `POST` | `/native/auth/login` | Login en verkrijg sessietokens |
| `POST` | `/native/auth/refresh` | Ververs access token |
| `POST` | `/native/auth/logout` | Trek sessie in |
| `GET` | `/native/auth/me` | Haal sessiegebruiker op |

### 1.2 Devices

| Methode | Pad | Doel | Request minimum |
|---|---|---|---|
| `POST` | `/devices/register` | Registreer device voor push en device-level messaging | `deviceId`, `pushToken`, `platform` |
| `POST` | `/devices/deregister` | Verwijder device/push-token koppeling | `deviceId` en/of `pushToken` |

**Norm**
- Backend kent `deviceId` toe aan de gebruiker; Android verzint geen server-record.
- Succesvolle registratie retourneert `200` met `success=true`.

### 1.3 Conversations

| Methode | Pad | Doel |
|---|---|---|
| `GET` | `/conversations` | Lijst gesprekken voor ingelogde gebruiker |
| `GET` | `/conversations/:uid` | Alias/lookup voor direct gesprek-resolutie indien ondersteund |
| `DELETE` | `/conversations/:conversationId` | Verwijder gesprek server-side |
| `POST` | `/conversations/:conversationId/clear` | Verwijder berichtenlogica voor gebruiker of gesprek conform backendregels |

### 1.4 Messages

| Methode | Pad | Doel | Request minimum |
|---|---|---|---|
| `GET` | `/conversations/:conversationId/messages` | Paginering van berichten | optioneel `cursor`, `limit` |
| `POST` | `/conversations/:conversationId/messages` | Verstuur bericht | `encryptedMessage` payload |
| `POST` | `/conversations/:conversationId/read` | Markeer gelezen status | `lastReadMessageId` |

**Norm message create**
- Android stuurt een intentie/payload.
- Backend valideert membership, schrijft record, kent definitieve `messageId` en `createdAt` toe en bepaalt status.
- Een message is pas definitief na backend-ack.

**Genormeerde encrypted payload**

```json
{
  "encryptedMessage": {
    "ciphertext": "string",
    "encryptionType": "lsv1",
    "signalMessageType": "signal",
    "clientMessageId": "client-generated-id",
    "senderDeviceId": "android-main",
    "receiverId": "user-id",
    "receiverDeviceId": "android-main",
    "timestamp": "2026-06-06T12:00:00Z",
    "recipients": [
      {
        "receiverId": "user-id",
        "receiverDeviceId": "android-main",
        "ciphertext": "string",
        "encryptionType": "lsv1",
        "signalMessageType": "signal"
      }
    ]
  }
}
```

### 1.5 Calls en video

| Methode | Pad | Doel |
|---|---|---|
| `GET` | `/calls/ice-servers` | Haal STUN/TURN configuratie op |
| `GET` | `/calls` | Haal calllog voor gebruiker op |
| `POST` | `/calls/:callId/mark-read` | Markeer calllog-item gelezen |

**Norm**
- Bellen en videobellen gebruiken WebSocket signaling.
- Backend legt duurzame callgeschiedenis pas vast via backend call logging.
- `isVideo=true` bepaalt video-callgedrag; video-upgrade blijft server-gestuurd via signaling-events.

## 2. WebSocket Events

Socket.IO is de realtime transportlaag. Android mag realtime state tonen, maar backend-events blijven leidend.

### 2.1 Client → server

| Event | Payload minimum | Betekenis |
|---|---|---|
| `conversation:join` | `convId` | Join gesprek-room |
| `conversation:create` | backend-defined | Vraag nieuw gesprek aan |
| `message:send` | message payload | Vraag berichtverzending aan |
| `messages:read` | `convId` | Vraag read update aan |
| `message:react` | `convId`, `msgId`, `emoji` | Voeg reactie toe |
| `message:edit` | `convId`, `msgId`, wijziging | Vraag edit aan |
| `user:online` | leeg of session info | Meld actieve sessie |
| `user:inactive` | — | Meld inactief |
| `user:active` | — | Meld weer actief |
| `users:online:request` | — | Vraag presence snapshot |
| `call:offer` | `to`, `from`, `offer`, `isVideo`, `callerName` | Start call signaling |
| `call:answer` | `to`, `answer` | Beantwoord call |
| `call:ice-candidate` | `to`, `candidate` | ICE candidate |
| `call:end` | `to` | Beëindig call |
| `call:decline` | `to` | Weiger call |
| `call:renegotiate` | `to`, `signal` | Renegotiation |
| `call:video-upgrade` | `to` | Upgrade audio naar video |
| `call:log` | `convId`, `isVideo`, `direction`, `duration` | Laat backend calllog vastleggen |

### 2.2 Server → client

| Event | Betekenis |
|---|---|
| `conversation:created` | Nieuw gesprek is definitief aangemaakt |
| `conversation:memberAdded` | Lid toegevoegd |
| `conversation:memberRemoved` | Lid verwijderd |
| `message:received` | Definitief backend-bericht of calllog-bericht |
| `message:status` | Delivery/read status update |
| `message:reaction` | Reactie toegevoegd/veranderd |
| `message:edited` | Bericht is aangepast |
| `mention:notify` | Mention-notificatie |
| `users:online` | Snapshot online users |
| `users:inactive` | Snapshot inactieve users |
| `user:status` | Presence delta |
| `user:updated` | Profiel-update |
| `account:paused` | Ouderlijk toezicht / account pause |
| `call:incoming` | Inkomende call |
| `call:answer` | Call beantwoord |
| `call:ice-candidate` | ICE candidate |
| `call:ended` | Call beëindigd |
| `call:declined` | Call geweigerd |
| `call:busy` | Ontvanger bezet |
| `call:unavailable` | Ontvanger offline/onbereikbaar |
| `call:renegotiate` | Call renegotiation |
| `call:video-upgrade` | Upgrade naar video |

**Norm**
- UI mag pas “definitief verzonden” tonen na backend ack of server-emitted `message:received`.
- Android mag optimistic UI gebruiken, maar moet die overschrijven met backend IDs/status/timestamps.

## 3. PostgreSQL Tabellen en Constraints

Dit zijn de duurzame contracttabellen voor chat/call/video.

### 3.1 Conversations en membership

- `conversations`
  - `id` primary key
  - `title`
  - `is_group`
  - `avatar_url`
  - `created_at`, `updated_at`

- `conversation_members`
  - primary key: `(conversation_id, user_id)`
  - foreign key `conversation_id -> conversations(id) ON DELETE CASCADE`
  - foreign key `user_id -> native_users(id) ON DELETE CASCADE`
  - foreign key `last_read_message_id -> messages(id) ON DELETE SET NULL`
  - flags: `is_muted`, `is_pinned`

### 3.2 Messages

- `messages`
  - primary key: `id`
  - foreign key `conversation_id -> conversations(id) ON DELETE CASCADE`
  - foreign key `sender_id -> native_users(id) ON DELETE CASCADE`
  - unieke index op `client_message_id WHERE client_message_id IS NOT NULL`
  - index op `(conversation_id, created_at DESC)`
  - index op `sender_id`
  - servervelden:
    - `sender_device_id`
    - `receiver_id`
    - `receiver_device_id`
    - `ciphertext`
    - `encryption_type`
    - `signal_message_type`
    - `status`
    - `created_at`, `updated_at`

- `message_reads`
  - primary key: `(message_id, user_id)`
  - foreign keys naar `messages` en `native_users`

- `message_receipts`
  - primary key: `(message_id, user_id, receipt_type)`

- `message_reactions`
  - primary key: `(message_id, user_id, emoji)`

### 3.3 Calls

- `calls`
  - primary key: `id`
  - foreign key `conversation_id -> conversations(id) ON DELETE SET NULL`
  - foreign key `caller_user_id -> native_users(id) ON DELETE SET NULL`
  - foreign key `callee_user_id -> native_users(id) ON DELETE SET NULL`
  - velden:
    - `direction`
    - `is_video`
    - `status`
    - `started_at`
    - `ended_at`
    - `duration_sec`
    - `created_at`, `updated_at`
  - indexen:
    - `(conversation_id, created_at DESC)`
    - `(caller_user_id, created_at DESC)`
    - `(callee_user_id, created_at DESC)`

- `call_reads`
  - primary key: `(user_id, call_id)`

### 3.4 Devices en E2EE

- `device_registrations`
  - unique: `(user_id, device_id)`
  - velden:
    - `push_token`
    - `platform`
    - `app_version`
    - `created_at`, `updated_at`

- `native_e2ee_identity_keys`
  - primary key: `(user_id, device_id)`

- `native_e2ee_signed_prekeys`
  - primary key: `(user_id, device_id)`

- `native_e2ee_one_time_prekeys`
  - geen duplicaten voor `(user_id, device_id, key_id)` verwacht
  - index voor device lookup verplicht

## 4. Redis Keys en TTL’s

Redis bevat alleen tijdelijke runtime-state.

| Key patroon | Doel | TTL |
|---|---|---|
| `queue:${receiverUid}` | Offline realtime queue voor nog te bezorgen events/berichten | `7 dagen` |
| `rl:${uid}:${event}:${bucket}` | Rate-limit teller per user/event/window | `window + 1 seconde` |

### Socket.IO adapter

- Redis pub/sub channels van de Socket.IO Redis adapter zijn intern en niet contractueel voor Android.
- Android mag daar nooit direct van afhankelijk zijn.

### Norm

- Geen duurzame businessrecords alleen in Redis.
- Backend moet kunnen herstellen zonder Redis-history als PostgreSQL nog intact is.

## 5. FCM Payload-regels

FCM is alleen fallback wanneer een device geen actieve WebSocket heeft.

### Verplicht

- Payload bevat alleen minimale wake/notificatie-data.
- Payload bevat altijd een `type`.
- Payload mag referenties bevatten zoals:
  - `conversationId`
  - `messageId`
  - `callId`
  - `fromUserId`
  - `isVideo`

### Verboden

- Geen plaintext message body als backend die niet ook als productregel ondersteunt.
- Geen payload die als definitief record wordt behandeld.
- Geen client-side state transitions puur op basis van FCM zonder backend-sync.

### Android-regel

- FCM mag UI wekken of een achtergrond-sync starten.
- Android moet daarna backend REST/WebSocket raadplegen voor definitieve state.

## 6. Error Responses

Alle fouten zijn backend-gedefinieerd en leidend.

### Formaat

```json
{
  "error": "Menselijke foutmelding"
}
```

### Minimale statuscodes

| Code | Betekenis | Android gedrag |
|---|---|---|
| `400` | Ongeldige input of statusovergang | Toon actiegebonden fout |
| `401` | Niet geauthenticeerd / ongeldig token | Refresh of logout-flow |
| `403` | Geen rechten / policy blokkade | Toon toegangs- of policyfout |
| `404` | Resource of endpoint niet gevonden | Geen fallback-record aanmaken |
| `409` | Conflict, al verwerkt, duplicate | Reconcile met backend-state |
| `429` | Rate limited | Backoff en retry later |
| `500` | Serverfout | Toon tijdelijke fout |
| `503` | Tijdelijk overbelast / unavailable | Retry later |

### Norm

- Android maakt nooit lokale “definitieve success”-records na een `4xx/5xx`.
- `clientMessageId` is idempotency-input, geen server-ID.

## 7. Android Repository/ViewModel Verantwoordelijkheden

### Repository-laag

- Bouwt requests op volgens dit contract.
- Voert token refresh en retrybeleid gecontroleerd uit.
- Doet optimistic UI alleen met reconcile op backend-response.
- Schrijft lokale cache als afgeleide van backend-state.
- Start background catch-up na FCM of reconnect.
- Zet WebSocket events om naar repository-state, maar finaliseert pas na backend-consistente data.

### ViewModel-laag

- Beheert UI-state, loading, retries en foutmeldingen.
- Maakt geen eigen protocol- of databasebeslissingen.
- Maakt geen server-ID’s of definitieve timestamps.
- Interpreteert call/chat status alleen via repository outputs.

### Expliciet verboden aan Android-zijde

- Definitieve `messageId`, `callId`, `conversationId` aanmaken
- Durable read/delivery state als waarheid bewaren zonder backend-bevestiging
- Redis- of PostgreSQL-kennis in appcode coderen
- FCM behandelen als primaire bron van waarheid

## 8. Acceptatiecriteria per feature

### 8.1 Device registratie

- Android kan `devices/register` aanroepen
- Backend schrijft naar `device_registrations`
- Duplicaatregistratie update dezelfde `(user_id, device_id)` record
- `200` response is voldoende om push fallback te activeren

### 8.2 Chat: conversation list

- `GET /conversations` retourneert alleen backend-records
- Android toont geen gesprek zonder backend `conversationId`
- Membership, unread count en last message komen uit backend

### 8.3 Chat: send message

- Android kan bericht sturen met encrypted payload
- Backend kent definitieve `messageId`, `createdAt`, `status` toe
- Andere deelnemers ontvangen `message:received`
- Sender krijgt reconcile van optimistic state naar backend state

### 8.4 Chat: message history

- `GET /conversations/:conversationId/messages` levert pagineerbare lijst
- Android kan na reconnect of push wake volledig resyncen
- Geen afhankelijkheid van alleen WebSocket-memory

### 8.5 Chat: read status

- `POST /conversations/:conversationId/read` slaat read state duurzaam op
- Andere deelnemers ontvangen `message:status`
- Refresh van gesprek toont dezelfde read state opnieuw

### 8.6 Audio call

- Client haalt eerst `/calls/ice-servers` op
- `call:offer`, `call:answer`, `call:ice-candidate`, `call:end`, `call:decline` werken via WebSocket
- Backend houdt call signaling transient, maar calllog duurzaam
- Gemiste actieve socket leidt hoogstens tot FCM fallback, niet tot verlies van duurzame call history

### 8.7 Video call

- Zelfde als audio call, plus `isVideo=true`
- Eventuele upgrade gebruikt `call:video-upgrade` of renegotiation-flow
- Backend legt definitieve calllog vast met `is_video=true`

### 8.8 Call history

- `GET /calls` toont backendgeschiedenis
- `POST /calls/:callId/mark-read` werkt duurzaam
- Android maakt geen eigen “gemiste oproep”-record zonder backend-calllog

### 8.9 Push fallback

- Bij offline device kan backend via FCM een wake/notificatie sturen
- Na wake haalt Android definitieve state op via backend
- Een gemiste FCM mag niet leiden tot permanent inconsistente chat- of callstate

## Contractbeslissing

Bij conflict tussen Android-implementatie en backend-respons wint altijd de backend.
