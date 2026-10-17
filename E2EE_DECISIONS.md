# Pulse E2EE Decisions

Dit document legt de belangrijkste ontwerpkeuzes vast die in deze frontendrepo al bewust zijn gemaakt.

## 1. Gefaseerde rollout in plaats van big-bang migratie

Besluit:

- de bestaande socketflow blijft voorlopig werken
- de nieuwe E2EE-laag wordt er gefaseerd naast gezet

Waarom:

- lagere migratierisico's
- bestaande chat breekt niet meteen
- backend kan later aansluiten zonder dat de UI opnieuw ontworpen hoeft te worden

Gevolg:

- `REACT_APP_E2EE_TRANSPORT=socket` blijft de veilige standaard

## 2. Mock crypto is uitsluitend een testharnas

Besluit:

- gebruik de bestaande mock alleen om UI- en transportintegratie te testen
- activeer `signal_v1` nooit als productie-E2EE
- bouw echte E2EE onder een nieuw, incompatibel `pulse_e2ee_v2`-protocol

Waarom:

- voorkomt dat Base64-data of gedeelde mock keys als encryptie worden aangemerkt
- maakt een harde scheiding tussen het prototype en het beveiligde wiremodel

Gevolg:

- `REACT_APP_E2EE_MODE=mock` blijft alleen de veilige legacystandaard
- een storing in v2 mag nooit terugvallen naar mock of plaintext

## 3. Adapterlaag tussen app en crypto

Besluit:

- alle crypto loopt via de adapterlaag onder
  [src/lib/e2ee/adapter](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/adapter)

Waarom:

- de rest van de app hoeft geen libraryspecifieke details te kennen
- mock en echte implementatie kunnen dezelfde interface delen

Gevolg:

- overstap naar echte crypto vraagt vooral aanpassingen in de adapter, niet in de UI-hooks

## 4. Wire model en view model blijven gescheiden

Besluit:

- backend/wire payloads worden eerst gehydrateerd
- componenten werken met genormaliseerde view messages

Waarom:

- UI hoeft niets te weten van ciphertext, key bundles of sessiestatus
- fallbackgedrag zoals `Versleuteld bericht` blijft centraal regelbaar

Gevolg:

- `messageModel.js` en `messagingService.js` zijn kernbestanden in de huidige opzet

## 5. Device bootstrap alleen als het logisch is

Besluit:

- device bootstrap draait alleen wanneer service transport of echte signalmodus relevant is

Waarom:

- voorkomt mislukte requests naar backend-endpoints die nog niet live zijn
- houdt de bestaande productieflow rustig

Gevolg:

- `App.js` bootstrapt niet onnodig in de standaard `mock + socket` modus

## 6. Encrypted editing is bewust geblokkeerd

Besluit:

- `signal_v1` berichten mogen voorlopig niet via de legacy editflow worden aangepast

Waarom:

- plaintext edit-events passen niet veilig op het toekomstige encrypted model
- een encrypted edit-model vraagt een apart ontwerp

Gevolg:

- de UI verbergt bewerken voor encrypted berichten
- realtime edit-events worden niet blind op encrypted berichten toegepast

## 7. Parent control stuurt op metadata en policy, niet op inhoud

Besluit:

- oudertoezicht blijft gericht op contacten, featuretoggles en metadata
- niet op standaard server-side meelezen van berichtinhoud

Waarom:

- dat past beter bij echte E2EE
- het sluit aan op de bestaande ParentDashboard-richting

Gevolg:

- backend moet parent policy hard afdwingen bij key bundles, sends en calls

## 8. Service transport wordt de toekomstige primaire send-flow

Besluit:

- encrypted send loopt uiteindelijk via backend endpoints
- sockets blijven vooral voor realtime signalering

Waarom:

- duidelijker contract
- betere policy enforcement
- betere aansluiting op device-aware delivery

Gevolg:

- `message:new` is het beoogde realtime event voor wire payloads

## 9. Productscope blijft bewust bij chat, bel en video

Besluit:

- de E2EE-productscope blijft gericht op chatten, bellen en videobellen
- media of bestanden tussen gebruikers versturen hoort daar niet bij

Waarom:

- het houdt Pulse rustiger en duidelijker voor kinderen
- het voorkomt scopegroei tijdens activatie
- het sluit beter aan op de bestaande productrichting

Gevolg:

- chatmedia blijft uit composer- en serviceflows
- acceptatie en rollout toetsen expliciet dat dit zo blijft

## 10. Echte E2EE gebruikt per-device envelopes

Besluit:

- ieder doelapparaat krijgt een eigen protocol-envelope
- ook de andere apparaten van de afzender krijgen een eigen envelope
- de backend bewaart en distribueert geen gedeelde message key

Waarom:

- sessies, prekeys en delivery-status horen bij een apparaat
- dit voorkomt dat een server-side sleutelconstructie de E2EE-claim ondermijnt

Gevolg:

- het v2-contract is device-aware van key claim tot receipt
- one-time prekeys worden atomair geclaimd en verbruikt

## 11. Android is de eerste proof client; browser heeft een harde gate

Besluit:

- de eerste echte provider wordt als native Android-provider bewezen
- private keys en sessierecords gaan niet over de JavaScript-bridge
- browserondersteuning komt pas vrij na selectie van een onderhouden provider die
  dezelfde protocolvectors verwerkt

Waarom:

- de officiele libsignal-TypeScriptbinding is voor Node en geen browserbundle
- Web Crypto levert cryptografische bouwstenen, geen Signal-ratchet

Gevolg:

- `v2_required` gesprekken zijn niet beschikbaar op een browser zonder
  goedgekeurde provider
- de backend ontsleutelt nooit als browserfallback

## 12. Productclaims volgen bewijs, niet feature flags

Besluit:

- Pulse toont pas `End-to-end versleuteld` nadat de relevante client, backend en
  protocoltests alle acceptatiegates halen
- WebRTC krijgt pas dezelfde claim na identity-bound verificatie van de
  verbinding

Waarom:

- transportencryptie en mock encoding zijn geen end-to-end encryptie
- een gedeeltelijke rollout mag gebruikers niet misleiden

Gevolg:

- legacygesprekken krijgen geen E2EE-label
- ontbrekende ondersteuning leidt tot blokkeren of duidelijke incompatibiliteit,
  nooit tot stille downgrade

## Open Beslissingen

Deze punten zijn bewust nog niet definitief gemaakt:

- definitieve Android-provider na juridische en technische review
- onderhouden browserprovider
- group encryption model
- encrypted edit-model
- concrete key-storage-implementatie per platform

## Lees Verder

- [E2EE_ARCHITECTURE_OVERVIEW.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ARCHITECTURE_OVERVIEW.md)
- [E2EE_PROTOCOL_V2_DECISION.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_PROTOCOL_V2_DECISION.md)
- [E2EE_IMPLEMENTATION_STATUS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_IMPLEMENTATION_STATUS.md)
- [E2EE_ROLLOUT.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ROLLOUT.md)
