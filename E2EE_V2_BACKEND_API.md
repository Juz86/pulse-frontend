# Pulse E2EE v2 Backend API

Status: geimplementeerd en getest in `pulse-backend`, gekoppeld aan een
geisoleerde fail-closed clientorchestrator maar nog niet aan de actieve
chatruntime, en standaard uitgeschakeld via serverflags.

Alle `/v2`-routes zijn standaard geblokkeerd met `v2_not_enabled`. Ze worden pas
bereikbaar wanneer de backend expliciet `E2EE_V2_ENABLED=true` krijgt. Deze flag
mag tijdens deze bouwfase niet in productie worden gezet.

Webregistratie heeft daarnaast een afzonderlijke
`E2EE_V2_WEB_PROVIDER_ENABLED`-gate. Die blijft uit totdat de browserprovider de
vastgelegde interoperabiliteits- en opslagtests heeft doorstaan.

Deze routes bestaan naast de legacy/mock E2EE-routes. Ze accepteren uitsluitend
`pulse_e2ee_v2` met `protocolVersion: 2`.

## Device registreren

`POST /v2/devices/register`

De body volgt `V2_DEVICE_REGISTRATION_SCHEMA` uit
[protocolV2Contract.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/protocolV2Contract.js).

De backend:

- bindt het device aan de geauthenticeerde gebruiker;
- bewaart naast de opaque `deviceId` een numerieke `signalDeviceId` van 1 t/m
  127 voor libsignal-adressering;
- weigert hergebruik van hetzelfde `signalDeviceId` door een ander opaque
  device van dezelfde gebruiker, ook wanneer dat oudere device is ingetrokken;
- accepteert alleen publieke keymaterialen;
- maakt registratie idempotent voor dezelfde identity key;
- verplicht een aparte key-rotation bij identity change;
- bewaart `identityVersion`, capabilities, een ondertekende Kyber-prekey en de
  klassieke prekeyvoorraad.

## Devices bekijken

`GET /v2/devices`

Retourneert alleen metadata van de eigen v2-devices, inclusief de
`signalDeviceId`. Identity keys, signed/Kyber-prekeys en one-time prekeys staan
niet in dit overzicht.

## Keys roteren

`PUT /v2/devices/:deviceId/keys`

Vervangt Signal-device-id, registration id, identity key, signed prekey,
Kyber-prekey en one-time prekeys in een transactie. Bij een gewijzigde identity
key:

- wordt `identityVersion` verhoogd;
- wordt `sessionsInvalidAfter` vastgelegd;
- wordt een `identity_changed` security event opgeslagen en realtime gemeld.

## One-time prekeys aanvullen

`POST /v2/devices/:deviceId/prekeys`

Voegt alleen nieuwe key-id's toe. Hergebruik van een bestaande key-id en een
voorraad boven 100 keys worden geweigerd.

## Device intrekken

`POST /v2/devices/:deviceId/revoke`

Zet het device op `revoked`, verwijdert de distributie van signed/one-time
prekeys en zet `sessionsInvalidAfter`. De handeling is idempotent.

## Key bundles claimen

`POST /v2/conversations/:conversationId/users/:recipientUserId/key-bundles/claim`

Request:

```json
{
  "protocol": "pulse_e2ee_v2",
  "protocolVersion": 2,
  "requesterDeviceId": "device-a1",
  "claimId": "123e4567-e89b-42d3-a456-426614174000"
}
```

De backend controleert binnen de claimflow:

- requester en ontvanger bestaan en zijn lid van hetzelfde een-op-eengesprek;
- chat is niet gepauzeerd of door gebruiker/ouder geblokkeerd;
- het requester-device is actief en v2-capable;
- ieder actief ontvangerdevice is v2-capable en heeft minimaal een prekey.

Daarna wordt in een Firestore-transactie exact een one-time prekey per actief
ontvangerdevice verwijderd en teruggegeven. Als een device geen voorraad heeft,
wordt de volledige transactie teruggedraaid.

Elke devicebundle bevat daarnaast de stabiele `signalDeviceId` en de publieke,
ondertekende `kyberPreKey`; die velden zijn vereist door libsignal `0.105.1` om
een moderne prekey-sessie op te bouwen.

`claimId` maakt netwerkretries idempotent. De eerste respons wordt vijftien
minuten opgeslagen onder `e2eePreKeyClaims`; dezelfde gebruiker en hetzelfde
requester-device krijgen bij retry dezelfde respons zonder extra consumptie.

Operationele eis voor deployment:

- configureer Firestore TTL op collection group `e2eePreKeyClaims`, veld
  `expiresAt`;
- monitor `v2_prekeys_unavailable` en vul de devicevoorraad aan;
- log nooit keymateriaal of volledige responses.

## Stabiele foutcodes

Belangrijke codes:

- `v2_contract_invalid`
- `v2_device_not_found`
- `v2_device_revoked`
- `v2_identity_change_requires_rotation`
- `v2_prekey_id_conflict`
- `v2_prekeys_unavailable`
- `v2_policy_denied`
- `v2_requester_device_not_capable`
- `v2_recipient_device_not_capable`
- `v2_claim_id_conflict`

Geen van deze fouten mag een client laten terugvallen naar mock of plaintext.

## Eigen overige devices claimen

`POST /v2/conversations/:conversationId/own-device-key-bundles/claim`

De requestbody is gelijk aan een gewone key-bundle claim. De route bindt
`recipientUserId` server-side aan de geauthenticeerde gebruiker en retourneert
uitsluitend key bundles van diens andere actieve devices; het requester-device
wordt uitgesloten. Hierdoor kan de sender ook de verplichte envelopes voor zijn
eigen andere devices maken. Als er geen sibling-device bestaat, is een lege
devicelijst geldig. Claim en prekeyconsumptie blijven transactioneel en
idempotent via `claimId`.

## Per-device bericht versturen

`POST /v2/messages/send`

De body volgt `V2_MESSAGE_SEND_SCHEMA`. De backend accepteert in fase 1 alleen
tekstberichten en controleert transactioneel dat:

- het gesprek een direct gesprek met `e2eeState: v2_pending|v2_required` is;
- afzender en ontvanger volgens het huidige beleid mogen chatten;
- `senderDeviceId` een actief v2-device van de geauthenticeerde gebruiker is;
- ieder actief ontvangerdevice en ieder ander actief afzenderdevice exact één
  envelope krijgt;
- alle actieve doeldevices v2-capable zijn;
- een envelope na base64-decoding maximaal 256 KiB is.

`clientMessageId` is ook het server-message-id. Een identieke retry is
idempotent. Hergebruik van dezelfde UUID met andere encrypted inhoud wordt met
`v2_message_id_conflict` geweigerd.

Firestore bewaart berichtmetadata zonder ciphertext in het message-document.
Iedere ciphertext staat in een afzonderlijk document onder
`deviceEnvelopes/{opaqueAudienceId}`. De backend bewaart geen plaintextpreview;
de chatlijst krijgt uitsluitend de generieke tekst `Versleuteld bericht`.

## Eigen envelope ophalen

`GET /v2/conversations/:conversationId/messages/:messageId/envelope?deviceId=:deviceId`

De backend verifieert opnieuw gesprekstoegang, device-eigendom, actieve status en
v2-capability. Alleen het envelope-document voor de combinatie van de
geauthenticeerde gebruiker en het opgegeven device wordt geretourneerd.
De response bevat tevens het servergeverifieerde `senderSignalDeviceId` en de
`senderIdentityVersion`. De ontvanger gebruikt deze samen met `senderUserId` en
`senderDeviceId` om het inkomende prekey- of sessiebericht aan exact het juiste
native Signal-adres te koppelen. Een hogere identity-versie maakt een lokaal
aanwezige oudere sessie ongeldig, ook als het realtime security-event is gemist.

Identity-change- en revoke-events bevatten protocolheader, user-, opaque
device-, Signal-device- en identity-versie. Clients accepteren deze events
alleen achter hun providergate en verwerken onvolledige events niet.

## Device-specifieke realtime delivery

Een socket kan bij de handshake optioneel `auth.e2eeDeviceId` meesturen. Als v2
actief is, controleert de server dit device tegen Firestore voordat de socket in
een opaque device-room wordt geplaatst. Een webdevice wordt bovendien geweigerd
zolang `E2EE_V2_WEB_PROVIDER_ENABLED` niet aan staat.

Na een nieuwe message schrijft de server geen ciphertext naar Socket.IO. Alleen
de juiste device-rooms ontvangen `e2ee:v2:message-available` met protocolversie,
conversation-id en message-id. Het device haalt daarna zijn eigen envelope via
HTTPS op. Een idempotente send-retry veroorzaakt geen tweede realtime-event.

Nieuwe stabiele foutcodes:

- `v2_conversation_not_enabled`
- `v2_sender_device_not_capable`
- `v2_recipient_set_mismatch`
- `v2_recipient_limit_exceeded`
- `v2_message_id_conflict`
- `v2_message_not_found`
- `v2_envelope_not_found`
- `v2_message_access_denied`
