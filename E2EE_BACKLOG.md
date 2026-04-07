# Pulse E2EE Backlog

Deze backlog zet de volgende E2EE-stappen in een praktische uitvoervolgorde.

## Nu Eerst

Deze items zijn nu de eerstvolgende echte afronders binnen de huidige E2EE-scope.

- doorloop de handmatige acceptatieronde end-to-end
- valideer chat, bel en video end-to-end
- bevestig expliciet dat chatmedia/attachments niet verstuurd kunnen worden
- stabiliseer `/readyz` zodat de backend readiness niet meer op `firestore_timeout` uitkomt
- leg rollout-monitoring vast voor service/fallback gedrag
- bepaal wanneer de serviceflow veilig genoeg is voor bredere interne testactivatie

## Daarna

Deze items zijn logisch na een stabiele fase 1 voor chat, bel en video.

- rolloutmonitoring en rollbackprocedure verder operationaliseren
- parent policy uitbreiden met quiet hours
- admin routes koppelen aan echte policy-opslag

## Later

Deze items horen niet bij de eerste activatie, maar wel bij een volwassen E2EE-model.

- echte crypto-adapter verder aanscherpen
- web storage hardening beoordelen
- groepsencryptie ontwerpen
- encrypted edit-model ontwerpen
- multi-device synchronisatie verder uitwerken

## Niet In Fase 1 Proberen Op Te Lossen

Deze onderwerpen zijn belangrijk, maar maken de eerste rollout onnodig groot als je ze te vroeg oppakt.

- volledige group E2EE
- encrypted edit support
- productbrede claimaanpassingen zonder backendvalidatie

## Aanbevolen Werkvolgorde

1. handmatige QA op de chat/bel/video-scope
2. backend readiness en rolloutmonitoring harden
3. productiegerichte rolloutbeslissing
4. echte crypto-adapter verder aanscherpen
5. langere-termijn uitbreidingen zoals groups en edits

## Lees Verder

- [E2EE_BACKEND_HANDOFF_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKEND_HANDOFF_CHECKLIST.md)
- [E2EE_ACTIVATION_RUNBOOK.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ACTIVATION_RUNBOOK.md)
- [E2EE_MANUAL_QA_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_MANUAL_QA_CHECKLIST.md)
- [E2EE_OPEN_QUESTIONS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_OPEN_QUESTIONS.md)
