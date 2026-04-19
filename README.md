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

- standaard webapp-build:
  `npm run build`
- landing-only build:
  `npm run build:landing`
- webapp build:
  `npm run build:webapp`
- landing-only veiligheidscheck:
  `npm run verify:landing`
- webapp buildcheck:
  `npm run verify:webapp`
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
- acceptatie-preflight:
  `npm run verify:e2ee:acceptance-preflight`
- volledige Cloudflare-voorcontrole:
  `npm run verify:cloudflare`

Belangrijk voor Cloudflare Pages:

- deze repo verwacht Node `20`
- gebruik voor `pulse-messenger.com` altijd `npm run build:landing`
- gebruik voor `web.pulse-messenger.com` altijd `npm run build:webapp`
- beide target-builds schrijven hun eigen `build/_headers` met passende CSP
- `npm run build` is alleen een webapp-fallback; gebruik voor productie liever altijd het expliciete targetcommando
- Create React App draait daar met `CI=true`
- warnings tellen dan mee als build errors
- `npm run verify:cloudflare` bootst dat lokaal na
- de GitHub workflow `Cloudflare Guard` draait dezelfde controle ook automatisch op pushes en PR's
- nieuwe PR's krijgen ook een deploy-safety checklist via de pull request template

Zie ook:

- [DEPLOYMENT_TARGETS.md](/home/yushuaabdulkadir/pulse-frontend/DEPLOYMENT_TARGETS.md)

## E2EE Status

De frontend bevat een gecontroleerde tussenfase voor E2EE voor:

- chatten
- bellen
- videobellen

Huidige veilige defaults:

- `REACT_APP_E2EE_MODE=mock`
- `REACT_APP_E2EE_TRANSPORT=socket`

Service-based encrypted delivery is voorbereid, maar hangt nog af van backend-endpoints.

Belangrijk:

- media of bestanden versturen tussen gebruikers valt niet binnen de actieve productscope
- profielfoto of avatar-keuze staat hier los van als profielinstelling

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
- [E2EE_ACCEPTANCE_RUNBOOK.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ACCEPTANCE_RUNBOOK.md)
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
- de actieve scope is chat, bel en video
- de volgende grote stap ligt aan backendkant

## Backend Startpunt

Er staat nu ook een minimale backend-skeleton klaar in:

- [backend-skeleton/README.md](/home/yushuaabdulkadir/pulse-frontend/backend-skeleton/README.md)

Die map is bedoeld als implementatiestart voor de eerste E2EE-serviceflow, niet als af productiebackend.
