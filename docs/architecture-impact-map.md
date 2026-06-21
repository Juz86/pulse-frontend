# Pulse Architecture And Impact Map

Laatste update: 2026-06-21

Dit document beschrijft hoe `pulse-frontend` en `pulse-backend` technisch op elkaar aansluiten.
Het doel is om vooraf scherp te hebben waar wijzigingen landen, welke contracten geraakt worden
en welke onderdelen extra regressierisico hebben.

## 1. Systeemoverzicht

Pulse is opgebouwd als een 2-repo systeem:

- `pulse-frontend` bevat zowel de publieke site als de ingelogde webapp
- `pulse-backend` bevat REST endpoints, Socket.IO realtime gedrag en serverlogica

De frontend is niet alleen een UI-laag. Hij regelt ook auth-bootstrap, socket lifecycle, push,
call recovery en een groot deel van de E2EE/device-orchestratie. De backend is geen pure CRUD API,
maar een combinatie van Express, Socket.IO, Firebase Admin en gedeelde runtime-state in geheugen.

## 2. Frontend-opbouw

Belangrijkste lagen:

- `src/index.js`
  - bootstrap van de app-target
  - start globale services
  - mount React
- `src/App.js`
  - applicatie-shell
  - auth lifecycle
  - backend self-sync
  - socket connect/disconnect
  - push setup
  - call recovery
  - globale E2EE/device checks
- `src/screens/ChatScreen.js`
  - hoofdscherm voor de chat-webapp
  - orkestreert hooks en UI-delen
- `src/hooks/`
  - domeinlogica per feature
  - onder andere chat, gesprekken, contacten, profiel, calling
- `src/services/`
  - infra zoals socket, push en app updates
- `src/lib/e2ee/`
  - encryptie-, device-, transport- en attachmentlaag

Praktische lezing:

- UI-wijziging: meestal `screens/` of `components/`
- featuregedrag: meestal `hooks/`
- realtime of signaling: meestal `services/socket.js`
- encryptie, devices of media-access: meestal `lib/e2ee/`

## 3. Backend-opbouw

Belangrijkste lagen:

- `server.js`
  - Express bootstrap
  - CORS
  - route-registratie
  - Socket.IO setup
  - socket-auth
- `src/routes/`
  - HTTP-modules per domein
  - onder andere `users`, `friends`, `parent`, `misc`, `e2ee`
- `src/socket/`
  - realtime modules per domein
  - `presence`, `messages`, `calls`, `conversations`
- `src/firebase.js`
  - Firebase Admin integratie
- `src/redis.js`
  - ondersteunende infra voor realtime/rate limiting
- `src/state.js`
  - in-memory runtime-state voor online users, calls, sessies en pending calls

Praktische lezing:

- API-contract wijzigen: meestal `src/routes/`
- realtime gedrag wijzigen: meestal `src/socket/`
- auth, CORS of globale socketflow: `server.js`
- tijdelijke presence/call state: `src/state.js`

## 4. Afhankelijkhedenkaart

### 4.1 Auth en app bootstrap

Frontend:

- `src/screens/AuthScreen.js`
  - `GET /runtimez`
  - `GET /api/users/lookup-username`
- `src/App.js`
  - `GET /`
  - `POST /api/users/sync-self`
  - `POST /api/users`
  - `GET /calls/pending/:sessionId`
  - socket emit `user:online`
  - socket emit `users:online:request`
  - socket on `user:status`, `users:online`, `users:inactive`
  - socket on `parent:activity`, `coparent:accepted`, `coparent:declined`
  - socket on `call:offer`, `call:ended`, `call:busy`

Backend landing points:

- `src/routes/misc.js`
- `src/routes/users.js`
- `src/socket/presence.js`
- `src/socket/calls.js`

### 4.2 Chat en conversations

Frontend:

- `src/hooks/useConversations.js`
  - `GET /messages/feed/:convId`
  - fallback `GET /api/messages/:convId`
  - `GET /api/conversations/:uid`
  - `DELETE /api/conversations/:convId`
  - `DELETE /api/conversations/:convId/clear`
  - `DELETE /api/conversations/:convId/hard`
  - `POST /api/messages/:convId/:msgId/react`
  - `DELETE /api/messages/:convId/:msgId`
  - socket emit `conversation:join`
  - socket emit `conversation:create`
  - socket emit `conversation:addMember`
  - socket emit `conversation:removeMember`
  - socket emit `message:send`
  - socket emit `message:edit`
  - socket emit `message:react`
- `src/hooks/useChat.js`
  - socket on `message:received`, `message:new`
  - socket on `typing:update`
  - socket on `message:status`, `message:deleted`, `message:edited`, `message:reaction`
  - socket on `conversation:created`, `conversation:member_added`, `conversation:member_removed`, `conversation:hardCleared`
  - socket on `friend:request`, `friend:accepted`, `friend:request:cancelled`
  - socket on `account:paused`, `account:resumed`
  - socket on `contact:blocked-by-parent`, `contact:unblocked-by-parent`, `contact:removed-by-parent`
  - socket emit `conversation:join`, `users:online:request`, `user:active`, `user:inactive`

Backend landing points:

- `src/routes/users.js`
- `src/routes/e2ee.js`
- `src/socket/messages.js`
- `src/socket/conversations.js`
- `src/socket/presence.js`
- typing events direct in `server.js`

### 4.3 Calling

Frontend:

- `src/services/socket.js`
  - `GET /api/turn-credentials`
  - socket emit `call:offer`, `call:answer`, `call:ice-candidate`
  - socket emit `call:renegotiate`, `call:end`, `call:video-upgrade`
  - socket on `call:offer`, `call:answer`, `call:ice-candidate`
  - socket on `call:renegotiate`, `call:ended`, `call:declined`
  - socket on `call:unavailable`, `call:busy`, `call:video-upgrade`
- `src/hooks/useCalling.js`
  - `GET /api/messages/recent-calls`
  - `DELETE /api/messages/recent-calls`
  - socket emit `call:log`
  - socket on `message:new`, `message:received` voor call-log refresh

Backend landing points:

- `src/routes/misc.js`
- `src/routes/users.js`
- `src/socket/calls.js`

### 4.4 Contacten en friend requests

Frontend:

- `src/hooks/useContacts.js`
  - `GET /api/contacts/:uid`
  - `GET /api/users/:uid/blocked`
  - `GET /api/friend-requests/:uid`
  - `GET /api/friend-requests/:uid/sent`
  - `POST /api/friend-requests`
  - `POST /api/friend-requests/:requestId/remind`
  - `DELETE /api/friend-requests/:requestId/cancel`
  - `POST /api/friend-requests/:requestId/accept`
  - `POST /api/friend-requests/:requestId/decline`
  - `DELETE /api/contacts/:uid/:targetUid`
  - `POST /api/users/:uid/block`
  - `POST /api/users/:uid/unblock`
  - `GET /api/users/search`
  - `GET /api/users/lookup-username`

Backend landing points:

- `src/routes/friends.js`
- `src/routes/users.js`

### 4.5 Profiel en account

Frontend:

- `src/hooks/useProfile.js`
  - `POST /api/users`
  - `GET /api/users/lookup-username`
  - `DELETE /api/account/:uid`
  - `GET /api/parent/settings`
  - `GET /api/parent/children`
  - `POST /api/parent/settings/history`
  - `POST /api/parent/child/:childUid/settings/history`

Backend landing points:

- `src/routes/users.js`
- `src/routes/parent.js`

### 4.6 Parent dashboard

Frontend:

- `src/screens/ParentDashboard.js`
  - `GET /api/parent/children`
  - `GET /api/parent/child/:childUid/contacts`
  - `GET /api/parent/activities`
  - `GET /api/parent/analytics/:childUid`
  - `POST /api/parent/child/:childUid/block-contact`
  - `POST /api/parent/child/:childUid/unblock-contact`
  - `POST /api/parent/child/:childUid/remove-contact`
  - `GET /api/contacts/:uid`
  - `GET /api/users/check-username`
  - fallback `GET /api/users/lookup-username`
  - daarnaast create/update/delete child en coparent-routes

Backend landing points:

- `src/routes/parent.js`
- `src/routes/friends.js`

### 4.7 Push en diagnostics

Frontend:

- `src/services/pushNotifications.js`
- `src/screens/PushDiagnosticsScreen.js`
  - `POST /api/fcm-token`

Backend landing point:

- `src/routes/misc.js`

### 4.8 E2EE en devices

Frontend:

- `src/lib/e2ee/deviceBootstrap.js`
  - `GET /devices`
  - `POST /devices/register`
- `src/lib/e2ee/messagingService.js`
  - `GET /users/:remoteUserId/key-bundle`
  - `POST /messages/send`
  - `POST /messages/receipt`
- `src/lib/e2ee/attachmentAccessAdapter.js`
  - `GET /api/attachments/:attachmentId/meta`
- `src/hooks/useConversations.js`
  - `GET /messages/feed/:convId`

Backend landing point:

- `src/routes/e2ee.js`

## 5. Impactkaart Per Feature

Deze kaart helpt om vooraf in te schatten waar een wijziging echt doorwerkt.

### 5.1 Login en sessieopstart

Raakt meestal:

- frontend `src/screens/AuthScreen.js`
- frontend `src/App.js`
- frontend `src/firebase.js`
- backend `src/routes/users.js`
- backend `src/routes/misc.js`
- backend `server.js`

Extra risico:

- username lookup moet blijven aansluiten op Firebase login
- app-start regressies zijn vaak breed zichtbaar
- tokenvalidatie raakt zowel HTTP als sockets

### 5.2 Gesprekslijst en berichtfeed

Raakt meestal:

- frontend `src/hooks/useConversations.js`
- frontend `src/hooks/useChat.js`
- frontend `src/screens/ChatScreen.js`
- backend `src/routes/users.js`
- backend `src/routes/e2ee.js`
- backend `src/socket/messages.js`
- backend `src/socket/conversations.js`

Extra risico:

- legacy feed en E2EE feed bestaan naast elkaar
- optimistic UI en server-ack moeten consistent blijven
- read/unread status kan stil breken zonder zichtbare compile-fout

### 5.3 Berichtverzending, edit, delete en reacties

Raakt meestal:

- frontend `src/hooks/useConversations.js`
- frontend `src/hooks/useChat.js`
- frontend `src/lib/e2ee/messagingService.js`
- backend `src/socket/messages.js`
- backend `src/routes/users.js`
- backend `src/routes/e2ee.js`

Extra risico:

- dezelfde feature kan via socket of via service/E2EE pad lopen
- edits en reactions hebben aparte event-contracten
- attachment- en plaintext-presentatie kunnen uiteenlopen

### 5.4 Realtime presence en typing

Raakt meestal:

- frontend `src/App.js`
- frontend `src/hooks/useChat.js`
- frontend `src/services/socket.js`
- backend `src/socket/presence.js`
- backend `server.js`
- backend `src/state.js`

Extra risico:

- veel gedrag hangt af van in-memory state
- multi-tab en reconnect kunnen race conditions geven
- typing is losser gekoppeld dan message delivery

### 5.5 Audio en video calls

Raakt meestal:

- frontend `src/services/socket.js`
- frontend `src/hooks/useCalling.js`
- frontend `src/App.js`
- backend `src/socket/calls.js`
- backend `src/routes/misc.js`
- backend `src/routes/users.js`
- backend `src/state.js`

Extra risico:

- call signaling, pending recovery en recent-calls grijpen in elkaar
- WebRTC-fouten zijn vaak runtime-only zichtbaar
- session-based recovery heeft snel regressies bij refresh/reconnect

### 5.6 Contacten, blokkeren en friend requests

Raakt meestal:

- frontend `src/hooks/useContacts.js`
- frontend `src/hooks/useChat.js`
- backend `src/routes/friends.js`
- backend `src/routes/users.js`
- backend `src/socket/presence.js`

Extra risico:

- backend-routes en socketnotificaties moeten semantisch gelijk blijven
- block/unblock beïnvloedt ook chatgedrag en zichtbaarheid
- friend request UX bevat meerdere statusovergangen

### 5.7 Parent dashboard en ouderlijk toezicht

Raakt meestal:

- frontend `src/screens/ParentDashboard.js`
- frontend `src/hooks/useProfile.js`
- frontend `src/App.js`
- backend `src/routes/parent.js`
- backend `src/socket/presence.js`

Extra risico:

- parent actions hebben vaak side effects buiten het dashboard
- pause/resume en contactblokkades beïnvloeden chat en calls
- realtime parent-notificaties en REST-respons moeten op elkaar blijven aansluiten

### 5.8 Profiel, account en media

Raakt meestal:

- frontend `src/hooks/useProfile.js`
- frontend profielcomponenten en modalflows
- backend `src/routes/users.js`
- backend storage/firebase-koppelingen

Extra risico:

- account delete is destructiever dan gewone profielwijzigingen
- photo flows kunnen storage- en cacheproblemen geven
- usernamewijzigingen hebben impact op lookup en invite-flows

### 5.9 Push notificaties

Raakt meestal:

- frontend `src/services/pushNotifications.js`
- frontend `src/App.js`
- frontend `src/screens/PushDiagnosticsScreen.js`
- backend `src/routes/misc.js`
- backend push/FCM infra

Extra risico:

- push is fallbackgedrag, dus fouten zijn niet altijd direct zichtbaar
- auth, token refresh en device registratie moeten consistent blijven

### 5.10 E2EE, devices en attachment metadata

Raakt meestal:

- frontend `src/lib/e2ee/deviceBootstrap.js`
- frontend `src/lib/e2ee/messagingService.js`
- frontend `src/lib/e2ee/attachmentAccessAdapter.js`
- frontend `src/hooks/useConversations.js`
- backend `src/routes/e2ee.js`

Extra risico:

- deze laag loopt parallel aan legacy messaging
- fouten zijn vaak inhoudelijk zichtbaar, niet altijd technisch luid
- attachment metadata, key bundles en receipt flows moeten contractueel exact kloppen

## 6. Praktische wijzigingsregels

Gebruik deze korte vuistregels voordat je iets aanpast:

- Wijzig je een scherm? Controleer ook de bijbehorende hook.
- Wijzig je een hook met `fetch` of `socket.emit`? Controleer het backend-contract mee.
- Wijzig je een socket-event? Controleer altijd zender, ontvanger en recovery/reconnect gedrag.
- Wijzig je iets in parent controls? Controleer ook chat- en call-neveneffecten.
- Wijzig je iets in E2EE? Behandel legacy en service-paden bewust als aparte contracten.

## 7. Belangrijkste conclusie

De belangrijkste structurele eigenschap van deze app is dat er drie contractlagen tegelijk actief zijn:

- klassieke REST onder `/api/...`
- Socket.IO events voor realtime gedrag
- nieuwere E2EE/service-routes zoals `/devices`, `/messages/send` en `/messages/feed/...`

Bij bijna elke niet-triviale wijziging moet daarom expliciet gecontroleerd worden:

- raakt dit alleen UI?
- raakt dit frontend featurelogica?
- raakt dit een REST-contract?
- raakt dit een socket-contract?
- raakt dit een parallel E2EE/service-pad?

## 8. Wijzigingsstrategie Per Feature

Deze sectie vertaalt de impactkaart naar een praktische veranderstrategie. Het doel is niet alleen
te weten wat geraakt wordt, maar ook hoe veilig of risicovol een wijziging meestal is.

### 8.1 Laag risico

Past meestal goed bij:

- presentatiewijzigingen in `components/` en `screens/`
- copy, labels, eenvoudige layout- of stylingaanpassingen
- lokale validatie in formulieren zonder contractwijziging
- kleine dashboardweergaven die alleen bestaande responsevelden tonen

Typische voorbeelden:

- knoptekst aanpassen
- volgorde of presentatie van bestaande velden wijzigen
- foutmelding verduidelijken zonder backend-impact
- lege state of loading state verbeteren

Let alsnog op:

- `ChatScreen.js` en `App.js` lijken visueel, maar zijn ook orkestratielagen
- parent-schermen hebben vaak server side effects achter simpele UI-acties

### 8.2 Middel risico

Past meestal goed bij:

- wijzigingen in hooks met bestaand contract
- uitbreiden van bestaande REST responses zonder breaking change
- toevoegen van niet-kritische socketlisteners
- call-log, contact- of profielgedrag dat al fallbackgedrag heeft

Typische voorbeelden:

- extra filter of sortering in gesprekken of contacten
- extra metadata tonen uit bestaande endpointrespons
- parent dashboard uitbreiden met extra uitleesinformatie
- call history presentatie of refreshgedrag verbeteren

Belangrijk aandachtspunt:

- hier zitten vaak stille regressies
- compile en smoke kunnen groen zijn terwijl statusovergangen toch stuk zijn

### 8.3 Hoog risico

Past meestal bij:

- wijzigingen aan `src/services/socket.js`
- wijzigingen aan backend `src/socket/`
- wijzigingen aan auth lifecycle in `src/App.js`
- veranderingen in call recovery of pending call state
- contractwijzigingen in message send/edit/delete/reaction flows
- wijzigingen in parent pause/resume of contact enforcement
- alles in `lib/e2ee/` of backend `src/routes/e2ee.js`

Typische voorbeelden:

- nieuw socket-event of andere payloadvorm
- aanpassen van call signaling
- migreren van legacy message flow naar service/E2EE flow
- read/delivery receipt semantics wijzigen
- parent-blocks laten doorwerken in andere domeinen

Waarom dit hoog risico is:

- deze onderdelen verbinden meerdere subsystemen tegelijk
- fouten verschijnen vaak pas bij reconnect, multi-tab, offline of race-achtige situaties
- regressies raken snel meerdere schermen tegelijk

## 9. Aanbevolen Werkvolgorde

Als we veilig willen itereren, is dit meestal de beste volgorde:

### Stap 1. UI en uitleesverbeteringen

Eerst oppakken:

- presentatiewijzigingen
- dashboarduitleesvelden
- foutmeldingen en loading states
- kleine profiel- of contactweergaven

Waarom:

- snel zichtbare winst
- laag regressierisico
- helpt domeinbegrip verder te verdiepen zonder contractsprongen

### Stap 2. Bestaande featurelogica zonder contractbreuk

Daarna oppakken:

- filtering, sortering en stategedrag in hooks
- bestaande REST-consumers verbeteren
- kleine compatibiliteitslagen of fallbacks opruimen

Waarom:

- hier winnen we kwaliteit zonder meteen aan de gevaarlijkste infrastructuur te zitten
- goed moment om gericht tests toe te voegen rond huidige flows

### Stap 3. Realtime en calls

Pas daarna oppakken:

- presence- of typinggedrag
- call history
- signaling details
- reconnect en recoverylogica

Waarom:

- deze laag heeft veel runtime-complexiteit
- fouten zijn vaak niet lokaal maar sessie- en timingafhankelijk

### Stap 4. Parent enforcement en cross-feature gedrag

Daarna oppakken:

- pause/resume-effecten
- parent-contactblokkades
- neveneffecten richting chat, calls en aanwezigheid

Waarom:

- parent features zijn functioneel breed
- een kleine wijziging kan op meerdere plekken zichtbaar gedrag veranderen

### Stap 5. E2EE en service-transport

Als laatste of als apart traject oppakken:

- device bootstrap
- key bundles
- encrypted message transport
- attachment metadata en decrypt/access flows

Waarom:

- dit is de meest contractgevoelige laag
- legacy en nieuw transport bestaan deels naast elkaar
- regressies zijn hier vaak inhoudelijk moeilijker te debuggen

## 10. Praktische Beslisregels Voor Nieuwe Wijzigingen

Gebruik deze korte checklist voordat een wijziging start:

- Als het alleen renderen of tekst is: waarschijnlijk laag risico.
- Als er `fetch(...)` verandert: controleer backend-route en responsevorm mee.
- Als er `socket.emit(...)` of `socket.on(...)` verandert: behandel het als minimaal middel tot hoog risico.
- Als `App.js`, `services/socket.js`, backend `src/socket/` of `lib/e2ee/` geraakt wordt: standaard als hoog risico behandelen.
- Als parent controls geraakt worden: altijd ook chat-, presence- en call-neveneffecten nalopen.

## 11. Concreet Advies Voor Ons Vervolg

De veiligste manier om verder te werken is meestal:

1. eerst wijzigingen kiezen in een laag-risico of middel-risico featuregebied
2. per wijziging expliciet noteren welk contract geraakt wordt
3. pas daarna de realtime-, parent-enforcement- of E2EE-lagen aanpassen

Kort gezegd:

- UI en bestaande uitleeslogica eerst
- contractarme hook-wijzigingen daarna
- sockets, calls en E2EE pas met gerichte scope

## 12. Backend Env Audit

Deze audit is gebaseerd op de actuele code in `pulse-backend`. De indeling hieronder zegt:

- `vereist`: nodig voor een complete productieopstelling of voor een specifiek actief subsystem
- `optioneel`: gebruikt als aanwezig, maar de app kan zonder starten of terugvallen
- `verouderd of ongebruikt`: staat mogelijk nog in hosting, maar is in de huidige code niet actief gekoppeld

### 12.1 Vereist

| Variabele | Waarom |
| --- | --- |
| `APP_URL` | Wordt gebruikt voor marketing-origin/CORS en push-linking |
| `WEB_APP_URL` | Wordt gebruikt voor webapp-origin/CORS en auth fallback URLs |
| `NODE_ENV` | Stuurt productiegedrag zoals Sentry enablement en runtime info |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Nodig om Firebase Admin echt te initialiseren |
| `FIREBASE_ENABLED` | Moet `true` zijn om Firebase niet in disabled mode te laten draaien |
| `REDIS_URL` | Nodig voor Redis queueing, cross-instance rate limiting en Socket.IO adapter |
| `RESEND_API_KEY` | Nodig voor OTP- en resetmails via Resend |

Opmerking:

- `PORT` is technisch runtime-vereist, maar wordt op platforms zoals Railway meestal automatisch gezet.
- `DATABASE_URL` is vereist als jullie native/Postgres-routes uit `auth.native.js` actief willen gebruiken. Voor de web/Firebase-hoofdstroom is die niet nodig.

### 12.2 Optioneel

| Variabele | Waarom |
| --- | --- |
| `PORT` | Heeft een default van `3001` als de host hem niet zet |
| `SENTRY_DSN` | Zonder DSN draait de app nog steeds, alleen zonder werkende Sentry-telemetrie |
| `CORS_ORIGINS` | Extra expliciete origins naast `WEB_APP_URL` |
| `CORS_ORIGIN_SUFFIXES` | Extra host-suffixen voor flexibele CORS-toegang |
| `TURN_URL` | Optionele TURN-relay voor calls; zonder dit blijft STUN actief |
| `TURN_USERNAME` | Hoort bij TURN-configuratie |
| `TURN_CREDENTIAL` | Hoort bij TURN-configuratie |
| `EMAIL_FROM` | Overschrijft standaard afzender voor mail |
| `RESEND_FROM` | Fallback afzender als `EMAIL_FROM` ontbreekt |
| `OTP_SOFT_FAIL` | Stuurt gedrag bij mailfouten; default is al aanwezig |
| `FIREBASE_STORAGE_BUCKET` | Overschrijft default storage bucket voor Firebase |
| `NATIVE_AUTH_JWT_SECRET` | Nodig als native JWT-auth gebruikt wordt en je geen dev fallback wilt |
| `JWT_SECRET` | Fallback voor native JWT-auth |
| `NATIVE_AUTH_JWT_EXPIRES_IN` | Overschrijft default native JWT TTL |
| `DATABASE_URL` | Alleen nodig voor native/Postgres routes |
| `FIRESTORE_EMULATOR_HOST` | Alleen runtime/debug/emulator context |
| `GOOGLE_APPLICATION_CREDENTIALS` | Wordt in runtime-info genoemd als file-path signaal, maar niet gebruikt voor de feitelijke Firebase init in de huidige code |

### 12.3 Waarschijnlijk verouderd of ongebruikt

| Variabele | Observatie |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Niet teruggevonden als actieve env-read in de huidige backendcode |
| `RESEND_FROM_EMAIL` | De code gebruikt `EMAIL_FROM` of `RESEND_FROM`, niet deze naam |
| `RESEND_REPLY_TO` | Niet teruggevonden als actieve env-read in de huidige backendcode |

### 12.4 Praktische controle voor jullie huidige Railway set

Als een Railway project de volgende set heeft, zit het meestal goed voor de huidige webbackend:

- `APP_URL`
- `WEB_APP_URL`
- `NODE_ENV`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- `FIREBASE_ENABLED=true`
- `REDIS_URL`
- `RESEND_API_KEY`
- optioneel: `SENTRY_DSN`
- optioneel: `CORS_ORIGINS`
- optioneel: `CORS_ORIGIN_SUFFIXES`
- optioneel voor betere calls: `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`

### 12.5 Belangrijkste conclusie uit de audit

Voor jullie huidige setup is de grootste valkuil niet CORS, maar Firebase enablement:

- alleen `GOOGLE_APPLICATION_CREDENTIALS_JSON` zetten is niet genoeg
- `FIREBASE_ENABLED=true` moet er ook zijn

Daarnaast lijkt deze cleanup logisch:

- `FIREBASE_SERVICE_ACCOUNT_JSON` verwijderen of negeren als die nergens anders meer gebruikt wordt
- `RESEND_FROM_EMAIL` alleen laten staan als er buiten deze repo nog iets op leunt
- `RESEND_REPLY_TO` alleen houden als er later nog code voor komt
