# Browser Provider Review Candidate

Deze map bevat uitsluitend reproduceerbare reviewinputs voor de mogelijke
Pulse-browserprovider. De bestanden zijn geen runtime-dependency en mogen niet
naar `src`, de productiebuild of een releasepackage worden gekopieerd voordat
de browsergate formeel is goedgekeurd.

## Inhoud

- `candidate.json`: bron-, toolchain-, test- en artifactprovenance;
- `review-subject.json`: exact vastgepinde frontend-, backend-, upstream- en
  libsignalcommits plus de te beoordelen artifacthashes;
- `libsignal-0.105.1-parity.patch`: minimale wijziging boven op de vastgepinde
  upstreamwrapper;
- `Cargo.lock`: volledige dependencyresolutie van de geslaagde paritybuild.

De upstreambron zelf wordt niet in deze repository gekopieerd. Daardoor blijft
zichtbaar welk deel upstream is en welk deel Pulse voor de parityprobe heeft
gewijzigd.

## Onafhankelijke reconstructie

Voer dit uit in een nieuwe, lege werkmap:

```bash
git clone https://github.com/getmaapp/signal-wasm.git
cd signal-wasm
git checkout 0a5e3cb8bf282efb3521d7cdac5476caf3fb1acd
git apply /path/to/libsignal-0.105.1-parity.patch
cp /path/to/Cargo.lock Cargo.lock
rustup target add wasm32-unknown-unknown
cargo check --locked --target wasm32-unknown-unknown
wasm-pack test --headless --chrome -- --locked
wasm-pack build --target web --scope getmaapp --release -- --locked
sha256sum pkg/signal_wasm_bg.wasm pkg/signal_wasm.js Cargo.lock
```

De verwachte hashes staan in `candidate.json`. Een afwijking is fail-closed:
publiceer of integreer het artifact dan niet en onderzoek eerst de toolchain,
bronstatus en dependencyresolutie.

Vanuit de Pulse-repository controleert onderstaande guard de inputhashes, de
libsignal-pin en de afwezigheid van een runtime-installatie:

```bash
npm run verify:e2ee:browser-review
```

## Reviewscope

Een onafhankelijke review moet minimaal beoordelen:

- het verschil tussen upstreamcommit en paritypatch;
- alle JavaScript/WASM-grenzen waar private bytes worden gekopieerd;
- serialisatie en import/export van identity-, prekey-, Kyber- en sessierecords;
- replay-, identity-change-, revoke- en foutafhandeling;
- panicgedrag en herstel met een nieuwe WASM-instance;
- persistente browseropslag, wrapping keys en dataverwijdering;
- CSP-impact en het same-origin/XSS-dreigingsmodel;
- licentie- en distributieverplichtingen van de volledige dependencyboom.

Een geslaagde review maakt dit nog niet automatisch productiegeschikt. Daarna
blijven de geisoleerde Pulse-QA-integratie en Android-browser-testmatrix vereist.

De formele overdracht, aftekencriteria en het machineleesbare bewijscontract
staan in `REVIEW_HANDOFF.md` en `review-attestation.schema.json`. Gebruik
`review-attestation.example.json` uitsluitend als invultemplate. De
productiepoort controleert alleen een echt `review-attestation.json` met een
aanwezig rapport waarvan de SHA-256 overeenkomt:

```bash
npm run verify:e2ee:security-review
```
