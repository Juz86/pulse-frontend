# Independent E2EE Security Review Handoff

Dit document beschrijft het minimale controleerbare bewijs dat Pulse nodig
heeft voordat een productiepilot mag worden overwogen. De implementerende
partij mag het onafhankelijke oordeel niet zelf aftekenen.

## Bevroren Reviewbasis

De definitieve scope staat in `review-subject.json`. De reviewer neemt die
commit- en artifactwaarden ongewijzigd over in `review-attestation.json` en
noteert daarnaast:

- de exacte frontendcommit;
- de exacte backendcommit;
- de upstream- en libsignalcommits uit `candidate.json`;
- de hashes van de gereconstrueerde JavaScript- en WASM-artifacts;
- de hash van het inhoudelijke reviewrapport;
- alle open bevindingen per ernstniveau.

De verificatie faalt wanneer een geattesteerde commit of artifacthash afwijkt
van `review-subject.json`.

Beide repositories moeten vóór overdracht schoon en gepusht zijn. Een dirty
worktree, een niet-herleidbaar artifact of een hashafwijking blokkeert de
review.

## Verplichte Uitvoering

1. Herbouw de kandidaat onafhankelijk volgens `README.md`.
2. Vergelijk de artifacthashes met `candidate.json` en
   `browser-provider-runtime.json`.
3. Beoordeel de volledige scope uit `README.md`, inclusief Androidprovider,
   browserworker, IndexedDB-store, backend-device-lifecycle en deliveryroutes.
4. Voer unit-, Chromium/WASM-, manipulatie-, replay-, identity-change- en
   revokeproeven uit.
5. Leg bevindingen, mitigaties en hertests vast in een zelfstandig rapport.
6. Maak `review-attestation.json` op basis van
   `review-attestation.example.json` en leg het rapport onder
   `security/e2ee/browser-provider-review/evidence/` vast.
7. Voer `npm run verify:e2ee:security-review` uit.

## Goedkeuringscriteria

- `status` is `approved`;
- de reviewer verklaart onafhankelijk te zijn;
- er staan geen kritieke of hoge bevindingen open;
- rebuild, runtime-, manipulatie-, replay- en interoperabiliteitstests slagen;
- rapport- en artifacthashes komen exact overeen;
- de review geldt voor de commits die daadwerkelijk naar de pilot gaan.

Een geslaagde technische testmatrix zonder dit bewijs is geen onafhankelijke
securityreview en opent de productiepoort niet.
