# Pulse E2EE Acceptance Runbook

Deze runbook bundelt de laatste acceptatiefase voor de huidige E2EE-implementatie.

## Doel

Valideren dat:

- service-transport stabiel werkt
- chatten stabiel werkt
- bellen en videobellen stabiel werken
- friend requests, chats, groepen en ouderregels nog intact zijn
- er geen chatmedia of attachments verstuurd kunnen worden

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

## 2. Lokale Config

Gebruik voor de huidige acceptatieronde:

```env
REACT_APP_BACKEND_URL=http://localhost:3001
REACT_APP_E2EE_TRANSPORT=service
REACT_APP_E2EE_MODE=mock
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
- bellen
- videobellen
- receipts
- groups
- blokkeren van chatmedia/attachments
- parent-policy deny-scenario

## 5. Afronding

Na een geslaagde ronde:

- noteer eventuele UI-afwijkingen
- noteer backend capability-afwijkingen
- bevestig rollbackpad naar socket
- bevestig dat de chat/bel/video-scope stabiel is zonder media-uitwisseling

## Zie Ook

- [E2EE_MANUAL_QA_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_MANUAL_QA_CHECKLIST.md)
- [E2EE_ACTIVATION_RUNBOOK.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ACTIVATION_RUNBOOK.md)
- [E2EE_TROUBLESHOOTING.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_TROUBLESHOOTING.md)
