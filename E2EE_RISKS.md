# Pulse E2EE Risks

Dit document benoemt de belangrijkste risico's rond de huidige E2EE-voorbereiding en de eerste service-based activatiefase.

## 1. Backend Is Nog Niet Live

Risico:

- de frontend is voorbereid, maar de nieuwe serviceflow kan nog niet volledig werken zonder backend-endpoints

Impact:

- service transport faalt direct bij bootstrap, key lookup of send

Mitigatie:

- veilige defaults behouden:
  `REACT_APP_E2EE_MODE=mock`
  `REACT_APP_E2EE_TRANSPORT=socket`
- pas omschakelen via het runbook

## 2. Mock Crypto Kan Schijnveiligheid Geven

Risico:

- developers of stakeholders verwarren mock-integratie met echte E2EE

Impact:

- verkeerde productclaims
- te vroege productie-activatie

Mitigatie:

- documentatie expliciet houden over `mock`
- echte crypto pas na stabiele serviceflow
- het media-profiel expliciet benoemen als `mock_media_v1`

## 3. Web Storage Is Niet Hard Genoeg Voor Sterke Claims

Risico:

- web gebruikt voorlopig nog eenvoudige lokale opslagpatronen

Impact:

- security-claims voor web kunnen te sterk zijn

Mitigatie:

- web-support productmatig voorzichtig formuleren
- storage hardening als apart vervolgstap behandelen

## 4. Legacy En Nieuwe Flow Bestaan Tijdelijk Naast Elkaar

Risico:

- mixed gedrag tussen sockettransport, legacy plaintext en nieuwe wire messages

Impact:

- edge cases in previews, statusvelden of retries

Mitigatie:

- centralisatie in `messageModel.js`
- centralisatie in `messagingService.js`
- handmatige QA op mixed flows

## 5. Scope Kan Onbedoeld Weer Richting Chatmedia Groeien

Risico:

- nieuwe UI- of servicewijzigingen maken onbedoeld chatmedia of attachments weer zichtbaar

Impact:

- productscope verschuift zonder bewuste keuze
- UX en policy rond kindveilig communiceren worden diffuser

Mitigatie:

- acceptatiedocs expliciet houden op chat, bel en video
- composer en sendflow attachment-vrij houden
- regressiecheck opnemen dat media niet verstuurd kunnen worden

## 6. Encrypted Edit-Model Bestaat Nog Niet

Risico:

- bestaande plaintext editflow past niet op encrypted berichten

Impact:

- verkeerde of inconsistente berichtstate

Mitigatie:

- edits voor `signal_v1` bewust blokkeren
- later apart encrypted edit-model ontwerpen

## 7. Parent Policy Moet Server-Side Hard Zijn

Risico:

- frontend-only checks zijn niet genoeg voor Pulse

Impact:

- ongeautoriseerde key bundle lookup
- ongeautoriseerde message send

Mitigatie:

- policy enforcement in backendroutes
- approved contacts en featuretoggles server-side afdwingen

## 8. Multi-Device Gedrag Is Nog Niet Volwassen

Risico:

- receipts, sessies en statussamenvatting worden complexer bij meerdere devices

Impact:

- status in UI kan onnauwkeurig zijn

Mitigatie:

- fase 1 focust op werkende 1-op-1 flow
- multi-device verfijning pas daarna

## 9. Realtime Delivery Kan Achterlopen Op HTTP-Ingest

Risico:

- backend kan berichten wel opslaan maar nog niet correct realtime pushen

Impact:

- berichten komen pas na refresh of reload goed door

Mitigatie:

- `message:new` als expliciet doel-event
- socket auth en uid-binding opnemen in backendfase

## 10. ParentDashboard Kan Onbedoeld Te Veel Willen Tonen

Risico:

- bestaande of toekomstige dashboardfeatures kunnen richting inhoudsinzage schuiven

Impact:

- spanning met E2EE-model

Mitigatie:

- metadata-only dashboard als uitgangspunt houden
- policy en analytics scheiden van inhoud

## 11. Rollout Kan Te Groot Worden

Risico:

- teveel tegelijk willen oplossen: groups, edits, extra policy, bredere claims

Impact:

- vertraagde of instabiele eerste release

Mitigatie:

- vasthouden aan fase 1-scope:
  direct chats + calls/video + mock crypto + service transport + policy enforcement

## Samenvatting

De grootste operationele risico's voor de eerstvolgende stap zijn:

1. verwarring tussen mock en echte E2EE
2. onbedoelde scopegroei buiten chat/bel/video
3. te brede scope tijdens activatie

## Lees Verder

- [E2EE_BACKLOG.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKLOG.md)
- [E2EE_ACTIVATION_RUNBOOK.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ACTIVATION_RUNBOOK.md)
- [E2EE_TROUBLESHOOTING.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_TROUBLESHOOTING.md)
