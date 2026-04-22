# Migration QA Checklist

Gebruik deze checklist om de gesplitste architectuur te verifiëren:

- `https://pulse-messenger.com` = marketing only
- `https://web.pulse-messenger.com` = full app

## Test Setup

- Test minimaal op:
  - desktop Chrome
  - desktop Safari of Firefox
  - mobiele browser op iPhone of Android
- Gebruik:
  - een schone browserprofile / incognito sessie
  - een bestaand account met eerdere app- en E2EE-state
  - twee actieve accounts voor chat en calls
- Houd DevTools open:
  - Console
  - Network
  - Application > Local Storage / Session Storage
  - Application > Service Workers

## 1. Marketing Host Is Marketing-Only

- Open `https://pulse-messenger.com`
- Navigeer door meerdere marketingpagina's
- Verwacht:
  - geen chat shell
  - geen login modal in-app
  - geen contactlijst, gesprekken of call UI
  - geen app-websocket verbindingen
  - geen camera/microfoon prompt

## 2. Landing CTA Redirect Naar Web App

- Open `https://pulse-messenger.com`
- Klik op hoofd-CTA zoals `Aanmelden` of ouderregistratie
- Verwacht:
  - navigatie gaat naar `https://web.pulse-messenger.com`
  - eventuele `role` / `mode` query params blijven behouden
  - marketinghost probeert geen app-login zelf af te handelen

## 3. Login Modal Op Web App

- Open `https://web.pulse-messenger.com`
- Start login- en registratieflow
- Verwacht:
  - login modal of auth flow opent op webapp-host
  - geen bounce terug naar marketinghost
  - parent/child routes werken nog
  - succesvolle login opent de app-sessie

## 4. Firebase Auth Persistence

- Log in op `https://web.pulse-messenger.com`
- Refresh de pagina
- Sluit tab en open opnieuw
- Verwacht:
  - sessie blijft actief volgens bedoelde browser-session persistence
  - user komt terug in de app zonder onverwachte sign-out
  - geen origin-gerelateerde auth reset

## 5. E2EE Key Reuse

- Gebruik een account met bestaande encrypted chatgeschiedenis
- Log voor het eerst in op `https://web.pulse-messenger.com`
- Verwacht:
  - legacy E2EE-state wordt alleen geïmporteerd als er nog geen identity op webapp-origin bestaat
  - bestaande encrypted gesprekken blijven leesbaar
  - geen onnodige nieuwe device bootstrap bij succesvolle import
  - identity/session state staat daarna onder `web.pulse-messenger.com`
  - latere refresh of relogin reset de keys niet

## 6. Chat Send / Receive

- Laat User A een bericht sturen naar User B
- Laat User B antwoorden
- Verwacht:
  - bericht verzendt zonder CORS/origin fouten
  - bericht komt realtime binnen
  - volgorde en timestamp kloppen
  - encrypted payload wordt correct gedecrypt

## 7. Realtime Updates

- Test met twee ingelogde users:
  - typing indicator
  - presence online/offline
  - read state
  - unread counters
- Verwacht:
  - updates verschijnen zonder refresh
  - presence herstelt correct na reconnect
  - unread counters lopen op en af zoals verwacht

## 8. Voice Calls

- Start een audio call van User A naar User B
- Test accepteren, weigeren, busy en beëindigen
- Verwacht:
  - signaling werkt vanaf `web.pulse-messenger.com`
  - microfoonpermissie wordt gevraagd indien nodig
  - tweeweg audio werkt na accepteren
  - reject/busy/unavailable states tonen correcte UI
  - call teardown ruimt UI en media tracks op

## 9. Video Calls

- Start een video call van User A naar User B
- Test accepteren, weigeren en beëindigen
- Verwacht:
  - camera + microfoon prompt werkt
  - tweeweg video/audio werkt
  - geen CSP of Permissions-Policy blokkade
  - einde van call ruimt stream en overlay op

## 10. Websocket Reconnect

- Log in op de web app
- Schakel netwerk tijdelijk uit en weer aan
- Verwacht:
  - websocket reconnect automatisch
  - auth token refresh/reconnect pad werkt
  - app blijft niet permanent in disconnected state hangen
  - messaging, presence en signaling komen terug

## 11. Media Upload / Download

- Upload een afbeelding of bestand in chat
- Open preview en download het bestand
- Verwacht:
  - upload slaagt vanaf webapp-origin
  - preview laadt correct
  - download werkt
  - geen CSP/CORS fouten naar API of storage hosts

## 12. Notifications

- Sta notificaties toe op `web.pulse-messenger.com`
- Laat een nieuw bericht binnenkomen terwijl de app op achtergrond staat
- Klik op de notificatie
- Verwacht:
  - service worker registreert op webapp-host
  - push token registratie slaagt
  - notificatie opent of focust de web app
  - deep-link naar gesprek werkt waar van toepassing

## 13. Logout / Login Again

- Log uit
- Log opnieuw in met hetzelfde account
- Verwacht:
  - normale sessiestate wordt opgeschoond
  - E2EE identity/session blijft bruikbaar voor dezelfde user
  - encrypted chats blijven leesbaar na opnieuw inloggen

## 14. Refresh During Active Session

- Open een actief gesprek
- Refresh de pagina midden in een actieve sessie
- Verwacht:
  - auth state herstelt
  - gesprek kan opnieuw worden geopend
  - recente berichten en unread state worden herladen
  - websocket en realtime updates herstellen

## 15. Mobile Browser Behavior

- Test op mobiele browser:
  - login
  - chat
  - media upload
  - audio/video permissies
  - refresh/herstel
- Verwacht:
  - layout blijft bruikbaar
  - sessie blijft stabiel binnen browserbeperkingen
  - permissies werken correct op mobiel

## 16. Cross-Origin And Security Checks

- Controleer op `pulse-messenger.com`:
  - geen app-only websocket/API flow
  - geen camera/mic permissies
- Controleer op `web.pulse-messenger.com`:
  - API calls gaan naar de geconfigureerde API host
  - websocket/signaling gaat naar de geconfigureerde socket host
  - Firebase/service worker draaien op webapp-origin
  - geen onverwachte storage reads buiten de gecontroleerde E2EE migratieflow
- Verwacht:
  - geen CORS failures
  - geen origin mismatch errors
  - geen `postMessage` target-origin fouten
  - geen dependency op cookies als bearer-token auth verwacht is

## 17. Final Storage Validation

- Inspecteer browser storage op beide origins
- Verwacht:
  - marketinghost bevat geen actieve app-runtime state voor de nieuwe architectuur
  - webapp-host bevat auth/app/E2EE runtime state
  - gemigreerde E2EE-state staat op webapp-origin
  - geen herhaalde importlus bij elke login

## Pass Criteria

- `pulse-messenger.com` blijft marketing-only
- `web.pulse-messenger.com` draagt alle app-functionaliteit
- bestaande gebruikers behouden sessie- en encrypted chatcontinuïteit
- chat, calls, media, notificaties en reconnect werken zonder cross-origin issues
