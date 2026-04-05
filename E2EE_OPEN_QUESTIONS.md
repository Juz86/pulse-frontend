# Pulse E2EE Open Questions

Dit document verzamelt de belangrijkste punten die bewust nog niet definitief zijn besloten.

## 1. Welke echte crypto-library wordt gebruikt?

Huidige status:

- frontend draait nog op mock crypto

Open vraag:

- welke library of combinatie wordt de echte implementatie voor device keys, sessies en message encryption?

Waarom nog open:

- eerst moet de serviceflow stabiel zijn met mock crypto

## 2. Hoe hard willen we web ondersteunen voor echte E2EE?

Huidige status:

- web kan de architectuur al volgen
- lokale opslag is nog niet hard genoeg voor sterke productclaims

Open vraag:

- is web een volwaardige E2EE-client, of vooral een lichtere/administratieve client?

Waarom belangrijk:

- dit beïnvloedt productcopy, security claims en storagekeuzes

## 3. Wat wordt het encrypted edit-model?

Huidige status:

- encrypted berichten gebruiken bewust geen legacy editflow

Open vraag:

- worden edits later een nieuw encrypted eventtype?
- of worden edits helemaal niet ondersteund voor encrypted chats?

## 4. Hoe zien encrypted attachments eruit?

Huidige status:

- er is nu een werkend `remote_mock` contract
- attachment metadata, headers, key-wrap en integrity lopen al via `mock_media_v1`

Open vraag:

- welke echte storage provider gebruiken we?
- hoe worden file keys echt gegenereerd, verpakt en per device gedeeld?
- welke delen van het huidige `mock_media_v1` contract blijven exact behouden?

## 5. Hoe ziet group encryption eruit?

Huidige status:

- huidige voorbereiding focust op 1-op-1 chats

Open vraag:

- welk groepsmodel wordt gekozen?
- hoe worden group membership changes en key rotation afgehandeld?

## 6. Hoe fijnmazig wordt parent policy?

Huidige status:

- ontwerp ondersteunt approved contacts, feature toggles en blocked contacts

Open vraag:

- komen er ook quiet hours per feature?
- komen er verschillende regels voor chat, audio en video per contact?

## 7. Welke metadata blijft zichtbaar in ParentDashboard?

Huidige status:

- metadata-only model is de beoogde richting

Open vraag:

- welke analytics zijn productmatig wenselijk zonder E2EE te ondermijnen?

## 8. Hoe gaan receipts precies werken in multi-device scenario's?

Huidige status:

- eerste model ondersteunt `message_recipients` per device

Open vraag:

- hoe worden delivered/read states samengevat voor de UI als meerdere devices meedoen?

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
- [E2EE_ARCHITECTURE_OVERVIEW.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ARCHITECTURE_OVERVIEW.md)
- [E2EE_BACKEND_HANDOFF_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKEND_HANDOFF_CHECKLIST.md)
