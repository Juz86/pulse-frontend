# Pulse Frontend

Frontendrepo voor Pulse, inclusief de huidige marketingpagina's, chat-UI en de voorbereidende E2EE-laag.

## Snel Starten

1. Installeer dependencies:
   `npm install`
2. Gebruik lokale configuratie op basis van:
   [.env.example](/home/yushuaabdulkadir/pulse-frontend/.env.example)
3. Start de app:
   `npm start`

## Verificatie

- build:
  `npm run build`
- tests:
  `npm test -- --watchAll=false`
- lint:
  `npm run lint`

## E2EE Status

De frontend bevat een gecontroleerde tussenfase voor E2EE:

- huidige veilige defaults:
  `REACT_APP_E2EE_MODE=mock`
  `REACT_APP_E2EE_TRANSPORT=socket`
- service-based encrypted delivery is voorbereid, maar hangt nog af van backend-endpoints

Start hier voor het volledige overzicht:

- [E2EE_DOCS_INDEX.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_DOCS_INDEX.md)

Belangrijkste documenten:

- [E2EE_IMPLEMENTATION_STATUS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_IMPLEMENTATION_STATUS.md)
- [E2EE_ARCHITECTURE_OVERVIEW.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ARCHITECTURE_OVERVIEW.md)
- [E2EE_DECISIONS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_DECISIONS.md)
- [E2EE_GLOSSARY.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_GLOSSARY.md)
- [E2EE_OPEN_QUESTIONS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_OPEN_QUESTIONS.md)
- [E2EE_ROLLOUT.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ROLLOUT.md)
- [E2EE_ACTIVATION_RUNBOOK.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ACTIVATION_RUNBOOK.md)
- [E2EE_TROUBLESHOOTING.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_TROUBLESHOOTING.md)
- [E2EE_MANUAL_QA_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_MANUAL_QA_CHECKLIST.md)
- [BACKEND_E2EE_API_SPEC.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_API_SPEC.md)
- [BACKEND_E2EE_FIRESTORE_PLAN.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_FIRESTORE_PLAN.md)
- [E2EE_BACKEND_HANDOFF_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKEND_HANDOFF_CHECKLIST.md)

## Huidige Praktische Status

- frontendvoorbereiding voor E2EE is ingebouwd
- build, tests en lint zijn eerder succesvol gedraaid
- de volgende grote stap ligt aan backendkant
