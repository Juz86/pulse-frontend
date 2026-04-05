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
- Cloudflare-veilige CI-build:
  `npm run build:ci`
- tests:
  `npm test -- --watchAll=false`
- E2EE-helpertests:
  `npm run test:e2ee`
- lint:
  `npm run lint`
- gerichte E2EE-verificatie:
  `npm run verify:e2ee`
- future media-profiel verificatie:
  `npm run verify:e2ee:future-media`
- volledige Cloudflare-voorcontrole:
  `npm run verify:cloudflare`

Belangrijk voor Cloudflare Pages:

- deze repo verwacht Node `20`
- Create React App draait daar met `CI=true`
- warnings tellen dan mee als build errors
- `npm run verify:cloudflare` bootst dat lokaal na
- de GitHub workflow `Cloudflare Guard` draait dezelfde controle ook automatisch op pushes en PR's
- nieuwe PR's krijgen ook een deploy-safety checklist via de pull request template

## E2EE Status

De frontend bevat een gecontroleerde tussenfase voor E2EE:

- huidige veilige defaults:
  `REACT_APP_E2EE_MODE=mock`
  `REACT_APP_E2EE_TRANSPORT=socket`
- service-based encrypted delivery is voorbereid, maar hangt nog af van backend-endpoints

Voor lokale acceptatie van de nieuwe attachment-route kun je nu ook gebruiken:

- `REACT_APP_E2EE_MODE=mock`
- `REACT_APP_E2EE_TRANSPORT=service`
- `REACT_APP_E2EE_ATTACHMENT_TRANSPORT=remote_mock`
- `REACT_APP_E2EE_ATTACHMENT_STRATEGY=mock_media_v1`

Voor de volgende mediadraft kun je lokaal ook al bewust testen met:

- `REACT_APP_E2EE_ATTACHMENT_STRATEGY=pulse_media_v1`

Start hier voor het volledige overzicht:

- [E2EE_DOCS_INDEX.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_DOCS_INDEX.md)

Belangrijkste documenten:

- [E2EE_IMPLEMENTATION_STATUS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_IMPLEMENTATION_STATUS.md)
- [E2EE_ARCHITECTURE_OVERVIEW.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ARCHITECTURE_OVERVIEW.md)
- [E2EE_FILE_MAP.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_FILE_MAP.md)
- [E2EE_DECISIONS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_DECISIONS.md)
- [E2EE_GLOSSARY.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_GLOSSARY.md)
- [E2EE_OPEN_QUESTIONS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_OPEN_QUESTIONS.md)
- [E2EE_ROLLOUT.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ROLLOUT.md)
- [E2EE_ACTIVATION_RUNBOOK.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ACTIVATION_RUNBOOK.md)
- [E2EE_ATTACHMENT_REMOTE_MOCK_RUNBOOK.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ATTACHMENT_REMOTE_MOCK_RUNBOOK.md)
- [E2EE_TROUBLESHOOTING.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_TROUBLESHOOTING.md)
- [E2EE_MANUAL_QA_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_MANUAL_QA_CHECKLIST.md)
- [E2EE_TEST_MATRIX.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_TEST_MATRIX.md)
- [E2EE_BACKLOG.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKLOG.md)
- [E2EE_RISKS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_RISKS.md)
- [E2EE_PRODUCT_IMPACT.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_PRODUCT_IMPACT.md)
- [BACKEND_E2EE_API_SPEC.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_API_SPEC.md)
- [BACKEND_E2EE_FIRESTORE_PLAN.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_FIRESTORE_PLAN.md)
- [E2EE_BACKEND_HANDOFF_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKEND_HANDOFF_CHECKLIST.md)

## Huidige Praktische Status

- frontendvoorbereiding voor E2EE is ingebouwd
- build, tests en lint zijn eerder succesvol gedraaid
- de volgende grote stap ligt aan backendkant

## Backend Startpunt

Er staat nu ook een minimale backend-skeleton klaar in:

- [backend-skeleton/README.md](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/README.md)

Die map is bedoeld als implementatiestart voor de eerste E2EE-serviceflow, niet als af productiebackend.
