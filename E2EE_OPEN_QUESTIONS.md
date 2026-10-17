# Pulse E2EE Open Questions

Dit document verzamelt de belangrijkste punten die bewust nog niet definitief zijn besloten.

## 1. Welke echte crypto-library wordt gebruikt?

Huidige status:

- frontend draait nog op mock crypto; dit is geen productie-E2EE
- de officiele Android-libsignalbinding is kandidaat voor de eerste proof client
- de officiele TypeScriptbinding is Node-native en geen browserprovider

Open vraag:

- doorstaat de Android-kandidaat de licentie-, lifecycle- en technische review?
- welke onderhouden browserprovider verwerkt exact dezelfde vastgelegde vectors?

Waarom nog open:

- externe libsignal-API's worden niet als stabiele publieke API ondersteund
- providerkeuze moet aantoonbaar interoperabel, onderhoudbaar en auditbaar zijn
- de huidige officiele artifacts zijn AGPL-3.0-only; juridische goedkeuring voor
  Pulse en Google Play is nog niet vastgelegd

Gebouwde voorbereiding:

- de native Keystore-opslag, libsignal-sessieprovider en niet-exporterende
  Capacitor-bridge zijn gereed
- de plugin blijft tot de echte-devicevalidatie fail-closed
  `providerAvailable: false` rapporteren
- zie `E2EE_ANDROID_PROVIDER_GATE.md` voor de resterende acceptatiepunten

Besluit op 17 oktober 2026:

- libsignal bundelen staat op `NO-GO` zolang Pulse geen expliciet goedgekeurd
  licentie- en distributiepad heeft
- zie `E2EE_LIBSIGNAL_LICENSE_DECISION.md` voor de drie toegestane vervolgroutes

## 2. Hoe hard willen we web ondersteunen voor echte E2EE?

Huidige status:

- web heeft nog geen goedgekeurde protocolprovider
- Web Crypto en IndexedDB kunnen opslag beschermen, maar implementeren geen
  Double Ratchet of sessiebeheer

Open vraag:

- welke provider en key-storageconstructie maken web een volwaardige E2EE-client?

Waarom belangrijk:

- zonder goedgekeurde provider kan web geen `v2_required` gesprek openen
- er komt geen server-side decryptie of plaintextfallback

## 3. Wat wordt het encrypted edit-model?

Huidige status:

- encrypted berichten gebruiken bewust geen legacy editflow

Open vraag:

- worden edits later een nieuw encrypted eventtype?
- of worden edits helemaal niet ondersteund voor encrypted chats?

## 4. Hoe ziet group encryption eruit?

Huidige status:

- huidige voorbereiding focust op 1-op-1 chats

Open vraag:

- welk groepsmodel wordt gekozen?
- hoe worden group membership changes en key rotation afgehandeld?

## 5. Hoe fijnmazig wordt parent policy?

Huidige status:

- ontwerp ondersteunt approved contacts, feature toggles en blocked contacts

Open vraag:

- komen er ook quiet hours per feature?
- komen er verschillende regels voor chat, audio en video per contact?

## 6. Welke metadata blijft zichtbaar in ParentDashboard?

Huidige status:

- metadata-only model is de beoogde richting

Open vraag:

- welke analytics zijn productmatig wenselijk zonder E2EE te ondermijnen?

## 7. Hoe gaan receipts precies werken in multi-device scenario's?

Huidige status:

- eerste model ondersteunt `message_recipients` per device

Open vraag:

- hoe worden delivered/read states samengevat voor de UI als meerdere devices meedoen?

## 8. Hoe scherp bewaken we de productscope zonder chatmedia?

Huidige status:

- de afgesproken scope is chatten, bellen en videobellen

Open vraag:

- hoe borgen we in productbeslissingen en UI-reviews dat chatmedia buiten scope blijft?
- welke profielmediafeatures zijn wel toegestaan zonder die grens te vervagen?

## 9. Welke rolloutstrategie gebruiken we voor productie?

Huidige status:

- documentatie ondersteunt een gefaseerde activatie

Open vraag:

- komt er een beperkte pilot?
- komt er een percentage rollout?
- hoe wordt rollback operationeel gemonitord?

## 10. Welke logging blijft toegestaan?

Huidige status:

- inhoudslogging is onwenselijk

Open vraag:

- welke technische logs zijn nog acceptabel voor debugging zonder gevoelige inhoud te lekken?

## Praktisch Gebruik

Gebruik dit document samen met:

- [E2EE_DECISIONS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_DECISIONS.md)
- [E2EE_PROTOCOL_V2_DECISION.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_PROTOCOL_V2_DECISION.md)
- [E2EE_ARCHITECTURE_OVERVIEW.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ARCHITECTURE_OVERVIEW.md)
- [E2EE_BACKEND_HANDOFF_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKEND_HANDOFF_CHECKLIST.md)
