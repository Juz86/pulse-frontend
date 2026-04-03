# Pulse E2EE Backend Handoff Checklist

Deze checklist is bedoeld voor de backendimplementatie die aansluit op de huidige frontendrepo.

Aanvullende documentatie:

- [E2EE_DOCS_INDEX.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_DOCS_INDEX.md)
- [BACKEND_E2EE_API_SPEC.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_API_SPEC.md)
- [BACKEND_E2EE_FIRESTORE_PLAN.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_FIRESTORE_PLAN.md)

## Fase 1: basisroutes

- [ ] `POST /devices/register` gebouwd
- [ ] `GET /users/:userId/key-bundle` gebouwd
- [ ] `POST /messages/send` gebouwd
- [ ] `POST /messages/receipt` gebouwd

Acceptatie:

- frontend kan device bootstrap uitvoeren
- frontend kan key bundle ophalen voor toegestane 1-op-1 contacten
- frontend krijgt `messageId` terug na versturen

## Fase 2: datastore

- [ ] Firestore collecties aangemaakt:
  `devices`, `child_policies`, `approved_contacts`, `conversations`, `messages`, `message_recipients`
- [ ] benodigde indexes aangemaakt
- [ ] bestaande routes blijven compatibele dashboardshapes teruggeven

Acceptatie:

- ParentDashboard blijft werken
- mixed legacy + `signal_v1` berichtdata kan naast elkaar bestaan

## Fase 3: policy enforcement

- [ ] parent-child relatie server-side gevalideerd
- [ ] approved contact checks server-side afgedwongen
- [ ] chat/call/video toggles server-side afgedwongen
- [ ] blocked contacts server-side afgedwongen

Acceptatie:

- key bundles worden niet uitgegeven aan ongeautoriseerde contacten
- message send naar niet-goedgekeurde contacten wordt geweigerd

## Fase 4: realtime delivery

- [ ] socket auth via Firebase ID token
- [ ] uid -> socket registry
- [ ] `message:new` event toegevoegd
- [ ] `conversation:join` membership check toegevoegd

Acceptatie:

- encrypted wire payloads worden realtime naar de juiste ontvanger gestuurd
- frontend ontvangt `message:new` en hydrateert lokaal

## Fase 5: frontend activatie

- [ ] `REACT_APP_E2EE_TRANSPORT=service` lokaal getest
- [ ] 1-op-1 chat send/receive getest
- [ ] retries getest
- [ ] conversation previews tonen geen lege waarden

Acceptatie:

- build blijft groen
- tests blijven groen
- lint blijft groen
- direct chats werken via serviceflow

## Fase 6: daarna pas

- [ ] mock adapter vervangen door echte crypto-adapter
- [ ] echte sessie-opbouw per device
- [ ] attachments encrypten
- [ ] groepsmodel ontwerpen

## Definition of done voor de eerste release

- device bootstrap werkt
- key bundle lookup werkt
- encrypted send werkt voor 1-op-1 direct chats
- receipts werken
- parent policy blokkeert ongeautoriseerde contacten
- ParentDashboard blijft metadata-only bruikbaar
- frontend draait met `REACT_APP_E2EE_TRANSPORT=service`
