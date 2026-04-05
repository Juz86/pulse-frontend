# Pulse E2EE Troubleshooting

Deze gids helpt bij de eerste backendintegratie en de overgang van `socket` naar `service` transport.

## Snelle Context

De veilige standaard is:

- `REACT_APP_E2EE_MODE=mock`
- `REACT_APP_E2EE_TRANSPORT=socket`

De eerste echte integratiefase is meestal:

- `REACT_APP_E2EE_MODE=mock`
- `REACT_APP_E2EE_TRANSPORT=service`
- `REACT_APP_E2EE_ATTACHMENT_TRANSPORT=remote_mock`

Het attachment-profiel hoort in die fase expliciet:

- `strategyKey: mock_media_v1`

## Probleem: device bootstrap gebeurt niet

Mogelijke oorzaak:

- de flags staan nog op `mock + socket`

Check:

- [src/lib/e2ee/config.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/config.js)
- [.env.example](/home/yushuaabdulkadir/pulse-frontend/.env.example)
- [src/App.js](/home/yushuaabdulkadir/pulse-frontend/src/App.js)

Verwacht gedrag:

- bootstrap draait alleen als `REACT_APP_E2EE_TRANSPORT=service` of `REACT_APP_E2EE_MODE=signal`

## Probleem: send via service mislukt direct

Mogelijke oorzaak:

- backend mist `POST /devices/register`
- backend mist `GET /users/:userId/key-bundle`
- backend mist `POST /messages/send`

Check:

- [BACKEND_E2EE_API_SPEC.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_API_SPEC.md)
- [E2EE_BACKEND_HANDOFF_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKEND_HANDOFF_CHECKLIST.md)

Herkenbaar symptoom:

- optimistic message gaat naar `failed`

## Probleem: berichten laden, maar preview is leeg

Mogelijke oorzaak:

- wire bericht wordt nog niet goed gehydrateerd
- backend levert een shape die niet past op de frontendverwachting

Check:

- [src/lib/e2ee/messageModel.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messageModel.js)
- [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)
- [src/components/ConversationItem.js](/home/yushuaabdulkadir/pulse-frontend/src/components/ConversationItem.js)

Verwacht gedrag:

- preview toont plaintext
- of fallback `Versleuteld bericht`
- attachment summaries blijven consistent met `mock_media_v1` als het om remote mock media gaat

## Probleem: message bubble toont niets

Mogelijke oorzaak:

- `text` ontbreekt
- `ciphertextAvailable` of `decryptedLocally` staat niet zoals verwacht

Check:

- [src/lib/e2ee/messageModel.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messageModel.js)
- [src/components/MessageBubble.js](/home/yushuaabdulkadir/pulse-frontend/src/components/MessageBubble.js)

Verwacht gedrag:

- bubble toont plaintext
- of fallback `Versleuteld bericht`

## Probleem: remote attachment opent wel, maar contractlabels wijken af

Mogelijke oorzaak:

- metadataheaders en downloadheaders vertellen niet hetzelfde attachmentcontract
- backend draait nog een oude instantie zonder `X-Pulse-Encryption-Strategy`
- de attachment is geen `mock_media_v1` payload meer

Check:

- `backend-skeleton npm run smoke:attachments`
- [backend-skeleton/src/scripts/smokeAttachments.js](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/src/scripts/smokeAttachments.js)
- [src/lib/e2ee/attachmentAccessAdapter.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/attachmentAccessAdapter.js)
- [src/lib/e2ee/attachmentPresentation.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/attachmentPresentation.js)

Verwacht gedrag:

- metadataheaders en downloadheaders tonen hetzelfde:
  - `X-Pulse-Encryption-Strategy: mock_media_v1`
  - `X-Pulse-Content-Encoding: mock-e2ee-envelope-v1`
  - `X-Pulse-Envelope-Kind: pulse_mock_media_envelope`
- de bubble toont daarna:
  - `Mock versleutelde opslaglink`
  - `Media-strategie: mock_media_v1`

## Probleem: live binnenkomende berichten verschijnen niet

Mogelijke oorzaak:

- backend emit nog alleen `message:received`
- backend emit geen toekomstig `message:new`
- payloadshape komt niet overeen

Check:

- [src/hooks/useChat.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useChat.js)
- [BACKEND_E2EE_API_SPEC.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_API_SPEC.md)

Verwacht gedrag:

- frontend kan zowel `message:received` als `message:new` aan

## Probleem: encrypted bericht is niet lokaal te openen

Mogelijke oorzaak:

- geen lokale identity beschikbaar
- geen sessie voor afzenderdevice
- backend key bundle/sessieflow is nog incompleet

Check:

- [src/lib/e2ee/secureKeyStore.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/secureKeyStore.js)
- [src/lib/e2ee/sessionStore.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/sessionStore.js)
- [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)

Verwacht gedrag:

- frontend valt terug op `Versleuteld bericht`
- UI breekt niet hard

## Probleem: bewerken verdwijnt uit contextmenu

Mogelijke oorzaak:

- bericht draait op `signal_v1`

Check:

- [src/lib/e2ee/policy.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/policy.js)
- [src/components/MsgContextMenu.js](/home/yushuaabdulkadir/pulse-frontend/src/components/MsgContextMenu.js)

Verwacht gedrag:

- encrypted berichten gebruiken voorlopig geen legacy edit-flow

## Probleem: backend is gebouwd, maar frontend blijft sockettransport gebruiken

Mogelijke oorzaak:

- `REACT_APP_E2EE_TRANSPORT` staat nog op `socket`

Check:

- [.env.example](/home/yushuaabdulkadir/pulse-frontend/.env.example)
- [.env](/home/yushuaabdulkadir/pulse-frontend/.env)
- [.env.production](/home/yushuaabdulkadir/pulse-frontend/.env.production)

Verwacht gedrag:

- serviceflow wordt pas actief als `REACT_APP_E2EE_TRANSPORT=service`

## Eerste Debugvolgorde

1. check env flags
2. check of bootstrap draait
3. check of backend basisroutes live zijn
4. check of loaded messages de verwachte shape hebben
5. check of realtime events `message:received` of `message:new` leveren
6. check of attachment smoke groen is en `mock_media_v1` in metadata/downloadheaders terugkomt
7. check of optimistic messages op `sent` of `failed` eindigen

## Lees Verder

- [E2EE_DOCS_INDEX.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_DOCS_INDEX.md)
- [E2EE_ROLLOUT.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ROLLOUT.md)
- [BACKEND_E2EE_API_SPEC.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_API_SPEC.md)
