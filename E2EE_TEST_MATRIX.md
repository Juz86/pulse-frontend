# Pulse E2EE Test Matrix

Deze matrix helpt om E2EE-gerelateerd gedrag gericht te testen zonder steeds opnieuw te bedenken welke paden geraakt worden.

## 1. Login En Device Bootstrap

Scenario:

- gebruiker logt in
- device bootstrap draait alleen wanneer dat volgens config logisch is

Belangrijke bestanden:

- [src/App.js](/home/yushuaabdulkadir/pulse-frontend/src/App.js)
- [src/lib/e2ee/config.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/config.js)
- [src/lib/e2ee/deviceBootstrap.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/deviceBootstrap.js)

Verwachte uitkomst:

- in `mock + socket` geen onnodige bootstrapflow
- in `mock + service` wel bootstrappoging

## 2. Legacy Bericht Laden

Scenario:

- oud plaintext bericht wordt opgehaald uit gesprekshistorie

Belangrijke bestanden:

- [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)
- [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)
- [src/lib/e2ee/messageModel.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messageModel.js)

Verwachte uitkomst:

- bericht wordt genormaliseerd
- `protocol` valt terug op `legacy_plaintext`
- UI toont gewone tekst

## 3. Encrypted Wire Bericht Laden

Scenario:

- `signal_v1` bericht wordt opgehaald

Belangrijke bestanden:

- [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)
- [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)
- [src/components/MessageBubble.js](/home/yushuaabdulkadir/pulse-frontend/src/components/MessageBubble.js)

Verwachte uitkomst:

- hydrateert naar plaintext als mogelijk
- of toont `Versleuteld bericht`

## 4. Direct Chat Versturen Via Socket

Scenario:

- `REACT_APP_E2EE_TRANSPORT=socket`

Belangrijke bestanden:

- [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)

Verwachte uitkomst:

- bestaande socketflow blijft werken
- optimistic message verschijnt

## 5. Direct Chat Versturen Via Service

Scenario:

- `REACT_APP_E2EE_TRANSPORT=service`

Belangrijke bestanden:

- [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)
- [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)
- [src/lib/e2ee/sessionStore.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/sessionStore.js)

Verwachte uitkomst:

- optimistic message gaat van `sending` naar `sent`
- backend response levert `messageId`

## 6. Retry Flow

Scenario:

- versturen mislukt
- gebruiker kiest retry

Belangrijke bestanden:

- [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)
- [src/lib/e2ee/messageModel.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messageModel.js)

Verwachte uitkomst:

- bericht krijgt `failed`
- retry zet bericht weer naar `sending`

## 7. Live Ontvangst

Scenario:

- nieuw bericht komt realtime binnen via socket

Belangrijke bestanden:

- [src/hooks/useChat.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useChat.js)
- [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)

Verwachte uitkomst:

- frontend accepteert `message:received` en `message:new`
- bericht wordt eerst gehydrateerd

## 8. Conversation Preview

Scenario:

- gespreksoverzicht moet laatste bericht tonen

Belangrijke bestanden:

- [src/components/ConversationItem.js](/home/yushuaabdulkadir/pulse-frontend/src/components/ConversationItem.js)
- [src/lib/e2ee/messageModel.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messageModel.js)

Verwachte uitkomst:

- preview toont tekst
- of `Versleuteld bericht`
- maar geen lege string bij relevante input

## 9. Remote Mock Attachment Contract

Scenario:

- `REACT_APP_E2EE_ATTACHMENT_TRANSPORT=remote_mock`
- attachment gaat via backend-upload, metadata en download terug

Belangrijke bestanden:

- [src/lib/e2ee/attachmentUploadAdapter.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/attachmentUploadAdapter.js)
- [src/lib/e2ee/attachmentAccessAdapter.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/attachmentAccessAdapter.js)
- [src/lib/e2ee/attachmentPresentation.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/attachmentPresentation.js)
- [backend-skeleton/src/scripts/smokeAttachments.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/scripts/smokeAttachments.js)

Verwachte uitkomst:

- attachment gebruikt het expliciete profiel `mock_media_v1`
- metadataheaders en downloadheaders vertellen hetzelfde contract
- UI toont:
  - `Mock versleutelde opslaglink`
  - `Media-strategie: mock_media_v1`
  - `Envelope: pulse_mock_media_envelope`

## 10. Attachment Retry En Forward

Scenario:

- remote attachment faalt of wordt doorgestuurd

Belangrijke bestanden:

- [src/lib/e2ee/messageTransportPayload.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messageTransportPayload.js)
- [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)
- [src/lib/e2ee/attachmentPayload.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/attachmentPayload.js)

Verwachte uitkomst:

- attachment blijft `attachment`
- `accessVerification` blijft behouden waar relevant
- tijdelijke `blob:` URL’s lekken niet mee
- `mock_media_v1` contract blijft zichtbaar

## 11. Edit Policy

Scenario:

- gebruiker opent contextmenu van een encrypted bericht

Belangrijke bestanden:

- [src/lib/e2ee/policy.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/policy.js)
- [src/components/MsgContextMenu.js](/home/yushuaabdulkadir/pulse-frontend/src/components/MsgContextMenu.js)
- [src/screens/ChatScreen.js](/home/yushuaabdulkadir/pulse-frontend/src/screens/ChatScreen.js)
- [src/hooks/useChat.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useChat.js)

Verwachte uitkomst:

- editoptie ontbreekt voor `signal_v1`
- plaintext edit-event overschrijft encrypted bericht niet

## 12. Parent Policy Deny

Scenario:

- backend weigert key bundle of send

Belangrijke bestanden:

- [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)
- [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)

Verwachte uitkomst:

- send eindigt in `failed`
- UI blijft bruikbaar

## Gebruik

Deze matrix werkt goed samen met:

- [E2EE_MANUAL_QA_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_MANUAL_QA_CHECKLIST.md)
- [E2EE_TROUBLESHOOTING.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_TROUBLESHOOTING.md)
- [E2EE_BACKLOG.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKLOG.md)
