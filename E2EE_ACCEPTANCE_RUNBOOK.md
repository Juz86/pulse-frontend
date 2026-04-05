# Pulse E2EE Acceptance Runbook

Deze runbook bundelt de laatste acceptatiefase voor de huidige E2EE-implementatie.

## Doel

Valideren dat:

- service-transport stabiel werkt
- `mock_media_v1` attachments bruikbaar blijven
- het draftprofiel `pulse_media_v1` geen regressies veroorzaakt
- friend requests, chats, groepen en ouderregels nog intact zijn

## 1. Preflight

Draai eerst:

```bash
npm run verify:e2ee:acceptance-preflight
```

Verwacht:

- frontend lint groen
- frontend `test:e2ee` groen
- backend tests groen
- backend smoke groen
- backend `smoke:socket` groen
- backend `smoke:attachments` groen
- backend `smoke:attachments:future` groen

## 2. Lokale Config

Gebruik voor de huidige acceptatieronde:

```env
REACT_APP_BACKEND_URL=http://localhost:3001
REACT_APP_E2EE_TRANSPORT=service
REACT_APP_E2EE_MODE=mock
REACT_APP_E2EE_ATTACHMENT_TRANSPORT=remote_mock
REACT_APP_E2EE_ATTACHMENT_STRATEGY=mock_media_v1
```

Voor de draft media-ronde herhaal je de attachmentscenario's daarna nog met:

```env
REACT_APP_E2EE_ATTACHMENT_STRATEGY=pulse_media_v1
```

## 3. Accounts

- gebruik twee testaccounts
- laat beide accounts volledig laden
- gebruik voor group-tests indien nodig een derde testaccount
- zorg dat parent-policy deze contacten toelaat

## 4. Handmatige Ronde

Doorloop daarna:

- [E2EE_MANUAL_QA_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_MANUAL_QA_CHECKLIST.md)

Minimaal:

- friend requests
- 1-op-1 chat
- receipts
- groups
- attachments
- attachment retry/forward
- parent-policy deny-scenario

## 5. Draft Media Ronde

Zet daarna `REACT_APP_E2EE_ATTACHMENT_STRATEGY=pulse_media_v1` en herhaal:

- attachment verzenden
- attachment openen
- attachment downloaden
- attachment retry
- attachment forward
- lijst- en bubble-signalen
- banner/hints voor future media

## 6. Afronding

Na een geslaagde ronde:

- noteer eventuele UI-afwijkingen
- noteer backend capability-afwijkingen
- bevestig rollbackpad naar socket
- bevestig of alleen `mock_media_v1` klaar is voor rollout of ook het draftprofiel verder kan

## Zie Ook

- [E2EE_MANUAL_QA_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_MANUAL_QA_CHECKLIST.md)
- [E2EE_ACTIVATION_RUNBOOK.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ACTIVATION_RUNBOOK.md)
- [E2EE_TROUBLESHOOTING.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_TROUBLESHOOTING.md)
- [E2EE_MEDIA_STORAGE_PLAN.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_MEDIA_STORAGE_PLAN.md)
