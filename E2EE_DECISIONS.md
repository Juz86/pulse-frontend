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

## 2. Mock crypto eerst, echte crypto later

Besluit:

- eerst architectuur, berichtmodel en backendcontract stabiliseren
- pas daarna een echte crypto-adapter inpluggen

Waarom:

- maakt integratiefouten eerder zichtbaar
- voorkomt dat librarydetails de hele appstructuur bepalen

Gevolg:

- `REACT_APP_E2EE_MODE=mock` blijft voorlopig de veilige standaard

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

## Open Beslissingen

Deze punten zijn bewust nog niet definitief gemaakt:

- keuze voor echte crypto-library
- encrypted attachments
- group encryption model
- encrypted edit-model
- web-specifieke hardening van key storage

## Lees Verder

- [E2EE_ARCHITECTURE_OVERVIEW.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ARCHITECTURE_OVERVIEW.md)
- [E2EE_IMPLEMENTATION_STATUS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_IMPLEMENTATION_STATUS.md)
- [E2EE_ROLLOUT.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ROLLOUT.md)
