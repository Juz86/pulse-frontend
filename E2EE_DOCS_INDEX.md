# Pulse E2EE Docs Index

Dit bestand bundelt de E2EE-documentatie in deze repo op één plek.

## Start Hier

Als je wilt weten wat er al gebouwd is en wat de eerstvolgende stap is:

- [E2EE_IMPLEMENTATION_STATUS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_IMPLEMENTATION_STATUS.md)

Als je wilt begrijpen hoe de frontend-E2EE-laag intern is opgesplitst:

- [E2EE_ARCHITECTURE_OVERVIEW.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ARCHITECTURE_OVERVIEW.md)
- [E2EE_FILE_MAP.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_FILE_MAP.md)

Als je wilt zien welke ontwerpkeuzes al bewust vastliggen:

- [E2EE_DECISIONS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_DECISIONS.md)
- [E2EE_PROTOCOL_V2_DECISION.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_PROTOCOL_V2_DECISION.md)
- [E2EE_ANDROID_PROVIDER_GATE.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ANDROID_PROVIDER_GATE.md)
- [E2EE_BROWSER_PROVIDER_GATE.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_PROVIDER_GATE.md)
- [E2EE_BROWSER_PROVIDER_PARITY_PROBE.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_PROVIDER_PARITY_PROBE.md)
- [E2EE_BROWSER_SECURITY_DESIGN.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_SECURITY_DESIGN.md)
- [E2EE_LIBSIGNAL_LICENSE_DECISION.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_LIBSIGNAL_LICENSE_DECISION.md)
- [E2EE_OPEN_SOURCE_READINESS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_OPEN_SOURCE_READINESS.md)
- [E2EE_V2_BACKEND_API.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_V2_BACKEND_API.md)

Als je snel de gebruikte termen wilt kunnen plaatsen:

- [E2EE_GLOSSARY.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_GLOSSARY.md)

Als je wilt zien wat bewust nog openstaat:

- [E2EE_OPEN_QUESTIONS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_OPEN_QUESTIONS.md)

## Frontend Rollout

Voor feature flags, veilige defaults en de overstap van socket naar service:

- [E2EE_ROLLOUT.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ROLLOUT.md)
- [E2EE_ACTIVATION_RUNBOOK.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ACTIVATION_RUNBOOK.md)

Voor praktische foutopsporing tijdens de eerste integratie:

- [E2EE_TROUBLESHOOTING.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_TROUBLESHOOTING.md)

Voor handmatige validatie van de eerste service-rollout:

- [E2EE_MANUAL_QA_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_MANUAL_QA_CHECKLIST.md)
- [E2EE_ACCEPTANCE_RUNBOOK.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ACCEPTANCE_RUNBOOK.md)
- [E2EE_TEST_MATRIX.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_TEST_MATRIX.md)
- [E2EE_V2_INTERNAL_PILOT.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_V2_INTERNAL_PILOT.md)

Voor prioritering van het resterende werk:

- [E2EE_BACKLOG.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKLOG.md)

Voor de belangrijkste rollout- en architectuurrisico's:

- [E2EE_RISKS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_RISKS.md)

Voor product- en copy-impact van echte activatie:

- [E2EE_PRODUCT_IMPACT.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_PRODUCT_IMPACT.md)

## Backend Contract

Voor de API-endpoints en payloads die de frontend inmiddels verwacht:

- [BACKEND_E2EE_API_SPEC.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_API_SPEC.md)

## Firestore En Datamodel

Voor collecties, documentvormen, queryrichting en indexplanning:

- [BACKEND_E2EE_FIRESTORE_PLAN.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_FIRESTORE_PLAN.md)

## Backend Handoff

Voor implementatiefases en acceptatiecriteria aan backendkant:

- [E2EE_BACKEND_HANDOFF_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKEND_HANDOFF_CHECKLIST.md)

## Configuratie

Voor veilige voorbeeldconfiguratie zonder productiegeheimen:

- [.env.example](/home/yushuaabdulkadir/pulse-frontend/.env.example)

## Aanbevolen Leesvolgorde

1. [E2EE_IMPLEMENTATION_STATUS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_IMPLEMENTATION_STATUS.md)
2. [E2EE_PROTOCOL_V2_DECISION.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_PROTOCOL_V2_DECISION.md)
3. [E2EE_BROWSER_PROVIDER_GATE.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_PROVIDER_GATE.md)
4. [E2EE_BROWSER_PROVIDER_PARITY_PROBE.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_PROVIDER_PARITY_PROBE.md)
5. [E2EE_V2_BACKEND_API.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_V2_BACKEND_API.md)
6. [E2EE_ROLLOUT.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ROLLOUT.md)
7. [BACKEND_E2EE_API_SPEC.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_API_SPEC.md)
8. [BACKEND_E2EE_FIRESTORE_PLAN.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_FIRESTORE_PLAN.md)
9. [E2EE_BACKEND_HANDOFF_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKEND_HANDOFF_CHECKLIST.md)

## Praktisch

De bestaande frontend is voorbereid op een mock-servicefase, maar niet op echte
cryptografische E2EE. Voor nieuwe implementatie en productieclaims is
`E2EE_PROTOCOL_V2_DECISION.md` leidend.

Oudere attachment- of media-runbooks kunnen nog in de repo staan als historisch of intern referentiemateriaal, maar horen niet bij de actieve productscope.
