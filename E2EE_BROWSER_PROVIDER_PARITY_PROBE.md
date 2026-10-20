# Pulse E2EE Browser Provider Parity Probe

Uitgevoerd: 20 oktober 2026

## Doel

Vaststellen of de onderzochte `signal-wasm`-wrapper technisch kan compileren en
testen met exact dezelfde libsignal-release als de Pulse Android-provider,
zonder de kandidaat aan de Pulse-runtime of productiefrontend toe te voegen.

## Bronbasis

- wrapperrepository: `getmaapp/signal-wasm`
- wrappercommit: `0a5e3cb8bf282efb3521d7cdac5476caf3fb1acd`
- wrapperversie: `0.6.6`
- oorspronkelijke libsignal-pin: `0.101.0`, commit
  `b056faa6dd02961cff24064c54c089c52e1a0753`
- geteste libsignal-pin: tag `v0.105.1`, commit
  `1738ead8a12ffe539f6309958123dadb16dc3b95`
- Android-pin: `0.105.1`

De proef vond uitsluitend plaats in `/tmp`. Er is geen WASM-package aan
`package.json`, `package-lock.json` of de Pulse-runtime toegevoegd.

De formele reconstructie-inputs staan in
[security/e2ee/browser-provider-review](/home/yushuaabdulkadir/pulse-frontend/security/e2ee/browser-provider-review/README.md).
Een verse reconstructie vanaf de upstreamcommit met de opgeslagen patch en
lockfile is met `cargo check --locked --target wasm32-unknown-unknown`
geslaagd.

## Minimale paritywijzigingen

De bestaande wrapperbron compileerde zonder API-wijzigingen nadat uitsluitend:

1. `libsignal-protocol` en `zkgroup` van de oude commit naar
   `1738ead8a12ffe539f6309958123dadb16dc3b95` waren verplaatst;
2. `getrandom 0.4.3` met feature `wasm_js` was toegevoegd voor de nieuwere
   libsignal-dependencyboom.

Cargo trok daarbij onder andere SPQR `1.6.0` in. De gegenereerde `Cargo.lock`
heeft SHA-256:
`b284c73b1d2f4486b70aa158cbdc0df67d3a98f437bae1441392f5d8de42caa9`.

## Buildbewijs

Gebruikte omgeving:

- Rust `1.99.1` (`58cf8f9c3`)
- wasm-pack `0.15.0`
- Chromium `155.0.8059.79`
- ChromeDriver `155.0.8059.79`
- target `wasm32-unknown-unknown`
- releasecommand: `wasm-pack build --target web --scope getmaapp --release`

Resultaat:

- `signal_wasm_bg.wasm`: `759105` bytes;
- SHA-256 WASM:
  `ce473ceb9422a801d1bd48e3764f9e52b06f13191523ba1a944e9fa0985160bc`;
- SHA-256 JavaScript-wrapper:
  `42910a893b4a6b585622f38dbe901a307a4db954fc7eda36372153eacbc1e623`;
- twee builds met een volledige `cargo clean` ertussen leverden byte-identieke
  WASM-binaries op.

Dit bewijst reproduceerbaarheid in dezelfde vastgelegde omgeving. Voor een
release is nog een onafhankelijke rebuild in een tweede, schone omgeving nodig.

## Browsertests

De volledige upstream WASM-suite is in headless Chromium uitgevoerd:

- 51 tests geslaagd;
- 0 tests mislukt;
- 0 tests genegeerd.

De suite dekte onder andere:

- identity-, signed-prekey-, one-time-prekey- en Kyber-prekeygeneratie;
- PQXDH-sessieopbouw en berichten in beide richtingen;
- sessiepersistentie en herstel;
- out-of-order delivery en ratchetgrenzen;
- Kyber-replayweigering over een restart;
- ongeldige signed- en Kyber-prekeysignatures;
- gewijzigde of getordeerde base keys;
- sender-key- en groepsroundtrips.

Dit zijn wrappertests binnen de browserprovider. Ze vervangen niet de vereiste
Pulse Android-browser-interoperabiliteitstest met de echte backendcontracten.

## Besluit

De technische blokkade "libsignal-versies kunnen niet gelijk worden gemaakt"
is opgeheven. De gepubliceerde npm-package blijft echter op `0.101.0` en wordt
niet gebruikt. De geteste paritypatch is nog geen goedgekeurde dependency.

De browserprovider blijft `NO-GO` voor Pulse-integratie totdat:

- een onafhankelijke securityreview de actuele wrapper en paritypatch heeft
  beoordeeld;
- een onafhankelijke rebuild dezelfde artifacts oplevert;
- opslag, CSP, panic-herstel en JavaScript/WASM-secretgrenzen zijn uitgewerkt;
- de volledige Android-browser-testmatrix tegen de QA-backend slaagt.
