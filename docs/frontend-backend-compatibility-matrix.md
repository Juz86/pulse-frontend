# Pulse Frontend/Backend Compatibility Matrix

Laatste check: 2026-06-21

Deze matrix vergelijkt de actuele API-calls in `pulse-frontend` met de routes die nu zichtbaar zijn in `pulse-backend`.

Status-legenda:
- `werkt`: frontend-call heeft een duidelijke backend-route
- `fallback`: frontend probeert eerst iets nieuws, maar heeft een bruikbare fallback
- `mist`: frontend-call heeft geen zichtbare backend-route
- `onzeker`: er is een runtime/socket-pad, maar geen directe HTTP-route of alleen indirect gedrag

## Runtime en basis

| Frontend call | Frontend referentie | Backend route | Status | Opmerking |
| --- | --- | --- | --- | --- |
| `GET /` | `src/App.js` | `GET /` | werkt | Warm-up ping aanwezig |
| `GET /health` | indirect runtime/debug | `GET /health` | werkt | Bestaat, maar frontend gebruikt dit nu niet direct |
| `GET /runtimez` | `src/screens/AuthScreen.js` | niet gevonden | mist | Runtime debugkaart in login kan backend als onbereikbaar tonen |
| `GET /readyz` | `src/lib/e2ee/config.js` | niet gevonden | mist | Service-transport readiness probe heeft geen zichtbare backend-route |

## Gebruikers en profiel

| Frontend call | Frontend referentie | Backend route | Status | Opmerking |
| --- | --- | --- | --- | --- |
| `POST /api/users` | `src/App.js`, `src/hooks/useProfile.js` | `POST /api/users` | werkt | Zelfregistratie/profielsync aanwezig |
| `POST /api/users/sync-self` | `src/App.js` | `POST /api/users/sync-self` | werkt | Expliciete self-sync aanwezig |
| `GET /api/users/lookup-username` | `src/screens/AuthScreen.js`, `src/hooks/useContacts.js`, `src/hooks/useProfile.js` | `GET /api/users/lookup-username` | werkt | Gebruikt voor login en lookup |
| `GET /api/users/check-username` | `src/screens/ParentDashboard.js` | niet gevonden | fallback | Frontend valt terug op `lookup-username` |
| `GET /api/users/search` | `src/hooks/useContacts.js` | `GET /api/users/search` | werkt | Contact zoeken aanwezig |
| `DELETE /api/account/:uid` | `src/hooks/useProfile.js` | `DELETE /api/account/:uid` | werkt | Account verwijderen aanwezig |
| `GET /api/users/:uid/photo` | profiel/chat flows | `GET /api/users/:uid/photo` | werkt | Route bestaat |
| `POST /api/users/:uid/photo` | profiel/chat flows | `POST /api/users/:uid/photo` | werkt | Route bestaat |

## Contacten en friend requests

| Frontend call | Frontend referentie | Backend route | Status | Opmerking |
| --- | --- | --- | --- | --- |
| `GET /api/contacts/:uid` | `src/hooks/useContacts.js`, `src/screens/ParentDashboard.js` | `GET /api/contacts/:uid` | werkt | Hoofdcontactlijst aanwezig |
| `DELETE /api/contacts/:uid/:targetUid` | `src/hooks/useContacts.js` | `DELETE /api/contacts/:uid/:targetUid` | werkt | Contact verwijderen aanwezig |
| `POST /api/friend-requests` | `src/hooks/useContacts.js` | `POST /api/friend-requests` | werkt | Versturen aanwezig |
| `GET /api/friend-requests/:uid` | `src/hooks/useContacts.js` | `GET /api/friend-requests/:uid` | werkt | Inbox aanwezig |
| `GET /api/friend-requests/:uid/sent` | `src/hooks/useContacts.js` | `GET /api/friend-requests/:uid/sent` | werkt | Verzonden aanwezig |
| `POST /api/friend-requests/:requestId/accept` | `src/hooks/useContacts.js` | `POST /api/friend-requests/:requestId/accept` | werkt | Accepteren aanwezig |
| `POST /api/friend-requests/:requestId/decline` | `src/hooks/useContacts.js` | `POST /api/friend-requests/:requestId/decline` | werkt | Weigeren aanwezig |
| `POST /api/friend-requests/:requestId/remind` | `src/hooks/useContacts.js` | niet gevonden | mist | Frontend heeft reminder-flow, backend-route niet zichtbaar |
| `DELETE /api/friend-requests/:requestId/cancel` | `src/hooks/useContacts.js` | niet gevonden | mist | Frontend kan cancelen, backend-route niet zichtbaar |
| `POST /api/users/:uid/block` | `src/hooks/useContacts.js` | `POST /api/users/:uid/block` | werkt | Blokkeren aanwezig |
| `POST /api/users/:uid/unblock` | `src/hooks/useContacts.js` | `POST /api/users/:uid/unblock` | werkt | Deblokkeren aanwezig |
| `GET /api/users/:uid/blocked` | `src/hooks/useContacts.js` | `GET /api/users/:uid/blocked` | werkt | Geblokkeerde contacten aanwezig |

## Ouderdashboard

| Frontend call | Frontend referentie | Backend route | Status | Opmerking |
| --- | --- | --- | --- | --- |
| `GET /api/parent/children` | `src/screens/ParentDashboard.js`, `src/hooks/useProfile.js` | `GET /api/parent/children` | werkt | Aanwezig |
| `GET /api/parent/settings` | `src/hooks/useProfile.js` | `GET /api/parent/settings` | werkt | Aanwezig |
| `POST /api/parent/settings/history` | `src/hooks/useProfile.js` | `POST /api/parent/settings/history` | werkt | Aanwezig |
| `POST /api/parent/child/:childUid/settings/history` | `src/hooks/useProfile.js` | `POST /api/parent/child/:childUid/settings/history` | werkt | Aanwezig |
| `POST /api/parent/create-child` | `src/screens/ParentDashboard.js` | `POST /api/parent/create-child` | werkt | Aanwezig |
| `POST /api/parent/change-child-password/:childUid` | `src/screens/ParentDashboard.js` | `POST /api/parent/change-child-password/:childUid` | werkt | Aanwezig |
| `POST /api/parent/change-child-username/:childUid` | `src/screens/ParentDashboard.js` | `POST /api/parent/change-child-username/:childUid` | werkt | Aanwezig |
| `DELETE /api/parent/delete-child/:childUid` | `src/screens/ParentDashboard.js` | `DELETE /api/parent/delete-child/:childUid` | werkt | Aanwezig |
| `POST /api/parent/pause/:childUid` | `src/screens/ParentDashboard.js` | `POST /api/parent/pause/:childUid` | werkt | Aanwezig |
| `POST /api/parent/resume/:childUid` | `src/screens/ParentDashboard.js` | `POST /api/parent/resume/:childUid` | werkt | Aanwezig |
| `GET /api/parent/activities` | `src/screens/ParentDashboard.js` | `GET /api/parent/activities` | werkt | Aanwezig |
| `GET /api/parent/analytics/:childUid` | `src/screens/ParentDashboard.js` | `GET /api/parent/analytics/:childUid` | werkt | Aanwezig |
| `GET /api/parent/child/:childUid/contacts` | `src/screens/ParentDashboard.js` | `GET /api/parent/child/:childUid/contacts` | werkt | Aanwezig |
| `POST /api/parent/child/:childUid/block-contact` | `src/screens/ParentDashboard.js` | `POST /api/parent/child/:childUid/block-contact` | werkt | Aanwezig |
| `POST /api/parent/child/:childUid/unblock-contact` | `src/screens/ParentDashboard.js` | `POST /api/parent/child/:childUid/unblock-contact` | werkt | Aanwezig |
| `POST /api/parent/child/:childUid/remove-contact` | `src/screens/ParentDashboard.js` | `POST /api/parent/child/:childUid/remove-contact` | werkt | Aanwezig |
| `POST /api/parent/invite-coparent` | `src/screens/ParentDashboard.js` | `POST /api/parent/invite-coparent` | werkt | Aanwezig |
| `GET /api/parent/coparent-invitations` | `src/screens/ParentDashboard.js` | `GET /api/parent/coparent-invitations` | werkt | Aanwezig |
| `POST /api/parent/coparent-invitations/:inviteId/accept` | `src/screens/ParentDashboard.js` | `POST /api/parent/coparent-invitations/:inviteId/accept` | werkt | Aanwezig |
| `POST /api/parent/coparent-invitations/:inviteId/decline` | `src/screens/ParentDashboard.js` | `POST /api/parent/coparent-invitations/:inviteId/decline` | werkt | Aanwezig |

## Gesprekken en berichten

| Frontend call | Frontend referentie | Backend route | Status | Opmerking |
| --- | --- | --- | --- | --- |
| `GET /api/conversations/:uid` | `src/hooks/useConversations.js` | `GET /api/conversations/:uid` | werkt | Aanwezig |
| `GET /api/messages/:convId` | `src/hooks/useConversations.js` | `GET /api/messages/:convId` | werkt | Legacy berichtfeed aanwezig |
| `GET /messages/feed/:convId` | `src/hooks/useConversations.js` | niet gevonden | fallback | Frontend valt terug op legacy `/api/messages/:convId` |
| `POST /api/messages/:convId/:msgId/react` | `src/hooks/useConversations.js` | `POST /api/messages/:convId/:msgId/react` | werkt | Aanwezig |
| `DELETE /api/messages/:convId/:msgId` | `src/hooks/useConversations.js` | `DELETE /api/messages/:convId/:msgId` | werkt | Aanwezig |
| `DELETE /api/conversations/:convId` | `src/hooks/useConversations.js` | `DELETE /api/conversations/:convId` | werkt | Aanwezig |
| `DELETE /api/conversations/:convId/clear` | `src/hooks/useConversations.js` | niet gevonden | mist | Frontend ondersteunt chat wissen, backend-route niet zichtbaar |
| `DELETE /api/conversations/:convId/hard?mode=delete` | `src/hooks/useConversations.js` | `DELETE /api/conversations/:convId/hard` | werkt | Queryparam lijkt extra, basisroute bestaat |
| `POST /messages/send` | `src/lib/e2ee/messagingService.js` | niet gevonden | mist | Service/E2EE transport ontbreekt zichtbaar |
| `POST /messages/receipt` | `src/lib/e2ee/messagingService.js` | niet gevonden | mist | Read receipts voor service-transport missen zichtbaar |

## Bellen en realtime

| Frontend call | Frontend referentie | Backend route | Status | Opmerking |
| --- | --- | --- | --- | --- |
| `GET /api/turn-credentials` | `src/services/socket.js` | `GET /api/turn-credentials` | werkt | TURN/STUN config aanwezig |
| Socket.IO events | `src/services/socket.js`, hooks | Socket.IO server in `server.js` | werkt | Realtime chat/call basis aanwezig |
| `GET /calls/pending/:sessionId` | `src/App.js` | niet gevonden | mist | Herstelpad voor inkomende calls heeft geen zichtbare HTTP-route |
| `GET /api/messages/recent-calls` | `src/hooks/useCalling.js` | niet gevonden | fallback | Frontend valt terug op localStorage call log bij 404 |
| `DELETE /api/messages/recent-calls` | `src/hooks/useCalling.js` | niet gevonden | fallback | Frontend behandelt 404 als legacy fallback |

## Push en notificaties

| Frontend call | Frontend referentie | Backend route | Status | Opmerking |
| --- | --- | --- | --- | --- |
| `POST /api/fcm-token` | `src/services/pushNotifications.js`, `src/screens/PushDiagnosticsScreen.js` | `POST /api/fcm-token` | werkt | Aanwezig |

## E2EE devices en key management

| Frontend call | Frontend referentie | Backend route | Status | Opmerking |
| --- | --- | --- | --- | --- |
| `GET /devices` | `src/lib/e2ee/deviceBootstrap.js` | niet gevonden | mist | Device inventory ontbreekt zichtbaar |
| `POST /devices/register` | `src/lib/e2ee/deviceBootstrap.js` | niet gevonden | mist | Device bootstrap ontbreekt zichtbaar |
| `GET /users/:remoteUserId/key-bundle` | `src/lib/e2ee/messagingService.js` | niet gevonden | mist | Key bundle fetch ontbreekt zichtbaar |

## Attachments

| Frontend call | Frontend referentie | Backend route | Status | Opmerking |
| --- | --- | --- | --- | --- |
| `GET /api/attachments/:attachmentId/meta` | `src/lib/e2ee/attachmentAccessAdapter.js` | niet gevonden | mist | Remote attachment metadata-route niet zichtbaar |

## Samenvatting

Wat nu waarschijnlijk al goed aansluit:
- basisprofiel en users
- contacten en friend requests, behalve remind/cancel
- ouderdashboard flows
- klassieke gesprekken en berichten
- Socket.IO basis
- push token registratie
- TURN credentials

Wat nu duidelijke backend-gaten lijken:
- `GET /runtimez`
- `GET /readyz`
- `POST /api/friend-requests/:requestId/remind`
- `DELETE /api/friend-requests/:requestId/cancel`
- `DELETE /api/conversations/:convId/clear`
- `GET /calls/pending/:sessionId`
- `GET/DELETE /api/messages/recent-calls`
- alle zichtbare E2EE service-routes
- attachment metadata-route

Aanbevolen volgorde voor implementatie:
1. Kleine compatibiliteitsgaten met directe UX-impact: `runtimez`, `check-username` of frontend-call opschonen, `friend-request cancel/remind`, `conversation clear`
2. Call-herstel en recente calls: `calls/pending`, `recent-calls`
3. E2EE/service-transport routes als apart backend-traject
