# Pulse E2EE Backlog

Deze backlog zet de volgende E2EE-stappen in een praktische uitvoervolgorde.

## Nu Eerst

Deze items zijn nu de eerstvolgende echte afronders na de huidige lokale `mock_media_v1` fase.

- doorloop de handmatige acceptatieronde end-to-end
- valideer `mock_media_v1` attachment flows op retry, forward en refresh
- stabiliseer `/readyz` zodat de backend readiness niet meer op `firestore_timeout` uitkomt
- leg rollout-monitoring vast voor service/fallback gedrag
- bepaal wanneer `remote_mock` veilig genoeg is voor bredere interne testactivatie

## Daarna

Deze items zijn logisch na een stabiele fase 1.

- echte storage provider aansluiten voor media
- echte media-encryptie/decryptie bovenop het huidige contract ontwerpen
- key lifecycle voor media (wrap/unwrap/rotatie) aanscherpen
- rolloutmonitoring en rollbackprocedure verder operationaliseren
- parent policy uitbreiden met quiet hours
- admin routes koppelen aan echte policy-opslag

## Later

Deze items horen niet bij de eerste activatie, maar wel bij een volwassen E2EE-model.

- echte crypto-adapter implementeren
- web storage hardening beoordelen
- groepsencryptie ontwerpen
- encrypted edit-model ontwerpen
- multi-device synchronisatie verder uitwerken

## Niet In Fase 1 Proberen Op Te Lossen

Deze onderwerpen zijn belangrijk, maar maken de eerste rollout onnodig groot als je ze te vroeg oppakt.

- volledige group E2EE
- echte productie-mediaopslag in dezelfde release als basisactivatie
- encrypted edit support
- video/call E2EE-herontwerp
- productbrede claimaanpassingen zonder backendvalidatie

## Aanbevolen Werkvolgorde

1. handmatige QA op de huidige `mock_media_v1` fase
2. backend readiness en rolloutmonitoring harden
3. echte encrypted media/storage ontwerpen en inbouwen
4. productiegerichte rolloutbeslissing
5. echte crypto-adapter

## Lees Verder

- [E2EE_BACKEND_HANDOFF_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKEND_HANDOFF_CHECKLIST.md)
- [E2EE_ACTIVATION_RUNBOOK.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ACTIVATION_RUNBOOK.md)
- [E2EE_MANUAL_QA_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_MANUAL_QA_CHECKLIST.md)
- [E2EE_OPEN_QUESTIONS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_OPEN_QUESTIONS.md)
