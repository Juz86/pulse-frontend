# Pulse E2EE Browser Provider Gate

Datum besluit: 20 oktober 2026

## Uitkomst

Er wordt nu geen browsercryptoprovider aan Pulse toegevoegd. De browser blijft
fail-closed voor `v2_required`-gesprekken en er komt geen plaintextfallback of
server-side decryptie.

De officiele `@signalapp/libsignal-client`-uitgave is geen browserpakket: de
TypeScriptbinding laadt native libraries voor Node-platformen. Oude pure
JavaScript-forks worden niet gebruikt omdat ze de actuele PQXDH-, Kyber- en
Double Ratchet-contracten niet aantoonbaar volledig en veilig implementeren.

`@getmaapp/signal-wasm@0.6.6` is uitsluitend een mogelijke kandidaat voor een
afgeschermde browser-QA-proef. Het pakket wordt niet geinstalleerd totdat alle
voorwaarden hieronder zijn vervuld.

## Vastgelegde kandidaat

- package: `@getmaapp/signal-wasm@0.6.6`
- licentie: `AGPL-3.0-only`
- npm SHA-512-integrity:
  `sha512-cYpzAe+HV1xfiXJ1tfDEvAjNkIsKwQApmFgniWJw/dTonOx4By6NzJ7J5izi+pjvfrn5zuXa0TmcHJ7Y/bLZYg==`
- npm tarball SHA-1: `62ad482454e62187664bd4f9473f8afac2061b07`
- upstream basis volgens de broncode: libsignal `0.101.0`, commit `b056faa6d`
- huidige Pulse Android-provider: libsignal `0.105.1`

De versies zijn dus niet gelijk. De meegeleverde auditnotitie is afkomstig uit
dezelfde repository, behandelt een oudere providerbasis en geldt niet als de
vereiste onafhankelijke securityreview van de actuele release.

## Parityprobe

Op 20 oktober 2026 is de wrapperbron uitsluitend in `/tmp` naar de exacte
Android-pin `0.105.1` gebracht. Hiervoor waren geen wrapper-API-wijzigingen
nodig: alleen de twee libsignal-commits en de browserfeature voor
`getrandom 0.4.3` veranderden.

De release-WASM bouwde daarna succesvol, alle 51 headless Chromium-tests
slaagden en twee schone builds waren byte-identiek. Daarmee is technische
versiepariteit haalbaar. De gepubliceerde npm-package blijft echter op
`0.101.0`; de paritypatch is niet in Pulse geinstalleerd en nog niet
onafhankelijk beoordeeld.

Volledig bewijs en hashes staan in
[E2EE_BROWSER_PROVIDER_PARITY_PROBE.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_PROVIDER_PARITY_PROBE.md).
De reconstructie-inputs zijn als formele reviewkandidaat vastgelegd in
[security/e2ee/browser-provider-review](/home/yushuaabdulkadir/pulse-frontend/security/e2ee/browser-provider-review/README.md).

## Verplichte voorwaarden

Voor zelfs een geisoleerde browser-QA-integratie moeten alle onderstaande
voorwaarden aantoonbaar zijn vervuld:

1. De browserkandidaat gebruikt exact dezelfde vastgepinde libsignal-versie en
   protocolrecords als Android. De haalbaarheid is met een tijdelijke probe
   bewezen; de uiteindelijke reviewbron moet deze pin blijvend vastleggen.
2. De WASM-binary is reproduceerbaar uit een vastgepinde, controleerbare
   broncommit; package-integrity en build provenance worden vastgelegd.
3. Een onafhankelijke reviewer beoordeelt de actuele wrapper, serialisatie,
   opslag, foutafhandeling en grens tussen JavaScript en WASM.
4. Identity-, prekey-, Kyber-, sessie- en sender-keyrecords komen niet in
   `localStorage`, `sessionStorage`, logs, analytics of foutmeldingen terecht.
5. Persistente browserrecords worden versleuteld opgeslagen. Het wrapping-key-
   model, IndexedDB-gebruik, herstelgedrag en verlies van browserdata krijgen
   expliciete tests en productgedrag.
6. De benodigde CSP-uitzondering voor WASM wordt afgewogen tegen XSS-hardening.
   Een same-origin scriptschending wordt als volledige compromittering van de
   geopende browserclient behandeld.
7. De provider faalt gesloten bij initialisatie-, opslag-, panic-, versie- en
   migratiefouten en valt nooit terug naar mock, legacy of plaintext.

## Verplichte interoperabiliteitstest

De browser-QA-build moet tegen de bestaande Android-QA-provider minimaal deze
vectors doorstaan:

- eerste PQXDH-prekeybericht en antwoord via een bestaande ratchetsessie;
- encryptie en decryptie in beide richtingen na browserreload en appherstart;
- one-time-prekey- en Kyber-prekey-hergebruik weigeren;
- gewijzigde, herhaalde en verwisselde ciphertext weigeren;
- offline inhalen en idempotente bevestiging zonder duplicaten;
- multi-devicefan-out en own-device synchronisatie;
- remote device revoke en lokale herregistratie;
- identity-change, sessieverwijdering en gecontroleerde sessievernieuwing;
- controle dat backend, IndexedDB, browseropslag, console en netwerkmetadata
  geen berichtplaintext bevatten.

## Besluitgrenzen

- `GO` voor onderzoek: broncode en reproduceerbaarheid van de QA-kandidaat
  controleren en de versiepariteit voorbereiden.
- `NO-GO` voor dependency-installatie in de productiefrontend.
- `NO-GO` voor een browser-QA-build zolang versiepariteit en onafhankelijke
  review ontbreken.
- `NO-GO` voor een productiepilot en `v2_required` zolang alle bovenstaande
  vectors niet op Android en browser zijn geslaagd.

## Eerstvolgende stap

Laat de vastgelegde reviewkandidaat onafhankelijk herbouwen en beoordelen. Voeg
de package pas daarna aan een geisoleerde browser-QA-build toe. Het opslag-,
CSP- en panic-herstelontwerp staat in
[E2EE_BROWSER_SECURITY_DESIGN.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_SECURITY_DESIGN.md).

## Primaire bronnen

- officiele libsignal-repository: https://github.com/signalapp/libsignal
- onderzochte WASM-kandidaat: https://github.com/getmaapp/signal-wasm
- vastgepinde kandidaatbasis:
  https://github.com/getmaapp/signal-wasm/blob/main/Cargo.toml
