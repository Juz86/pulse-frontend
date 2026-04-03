# Pulse E2EE Backlog

Deze backlog zet de volgende E2EE-stappen in een praktische uitvoervolgorde.

## Nu Eerst

Deze items blokkeren de eerste werkende service-rollout.

- bouw `POST /devices/register`
- bouw `GET /users/:userId/key-bundle`
- bouw `POST /messages/send`
- bouw `POST /messages/receipt`
- laat `GET /api/messages/:convId` mixed legacy + `signal_v1` data teruggeven
- voeg server-side parent policy checks toe op key bundle en send
- voeg socket auth en `message:new` delivery toe
- test frontend met `REACT_APP_E2EE_MODE=mock`
- test frontend met `REACT_APP_E2EE_TRANSPORT=service`

## Daarna

Deze items zijn logisch na een stabiele fase 1.

- receipts nauwkeuriger maken voor multi-device scenario's
- previewgedrag aanscherpen voor mixed gesprekken
- parent policy uitbreiden met quiet hours
- admin routes koppelen aan echte policy-opslag
- logging en audit events aanscherpen
- rolloutmonitoring en rollbackprocedure verder operationaliseren

## Later

Deze items horen niet bij de eerste activatie, maar wel bij een volwassen E2EE-model.

- echte crypto-adapter implementeren
- web storage hardening beoordelen
- encrypted attachments ontwerpen
- groepsencryptie ontwerpen
- encrypted edit-model ontwerpen
- multi-device synchronisatie verder uitwerken

## Niet In Fase 1 Proberen Op Te Lossen

Deze onderwerpen zijn belangrijk, maar maken de eerste rollout onnodig groot als je ze te vroeg oppakt.

- volledige group E2EE
- encrypted attachments
- encrypted edit support
- video/call E2EE-herontwerp
- productbrede claimaanpassingen zonder backendvalidatie

## Aanbevolen Werkvolgorde

1. backend basisroutes
2. parent policy enforcement
3. realtime `message:new`
4. frontend service-activatie met mock crypto
5. handmatige QA
6. productiegerichte rolloutbeslissing
7. echte crypto-adapter

## Lees Verder

- [E2EE_BACKEND_HANDOFF_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKEND_HANDOFF_CHECKLIST.md)
- [E2EE_ACTIVATION_RUNBOOK.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ACTIVATION_RUNBOOK.md)
- [E2EE_MANUAL_QA_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_MANUAL_QA_CHECKLIST.md)
- [E2EE_OPEN_QUESTIONS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_OPEN_QUESTIONS.md)
