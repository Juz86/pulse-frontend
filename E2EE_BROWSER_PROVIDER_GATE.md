# Pulse E2EE Browser Provider Gate

Datum besluit: 20 oktober 2026

## Uitkomst

De vastgepinde paritybuild is nu uitsluitend als geisoleerde browser-QA-runtime
toegevoegd, nadat voor deze bouwfase expliciet is aangenomen dat de externe
securityreview is goedgekeurd. Die aanname is vastgelegd als procesbasis en is
geen vervanging voor een zelfstandig controleerbaar reviewrapport vóór een
productierelease. De browser blijft fail-closed voor `v2_required`-gesprekken
en er komt geen plaintextfallback of server-side decryptie.

De officiele `@signalapp/libsignal-client`-uitgave is geen browserpakket: de
TypeScriptbinding laadt native libraries voor Node-platformen. Oude pure
JavaScript-forks worden niet gebruikt omdat ze de actuele PQXDH-, Kyber- en
Double Ratchet-contracten niet aantoonbaar volledig en veilig implementeren.

De gepubliceerde `@getmaapp/signal-wasm@0.6.6` wordt niet als npm-dependency
gebruikt. Alleen de reproduceerbare parityoutput tegen libsignal `0.105.1` is
met vaste hashes en licentie als afgeschermd QA-artifact opgenomen.

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
- `GO` voor de geisoleerde opslag-, worker- en WASM-initialisatie in browser-QA.
- `NO-GO` voor een npm-dependency of activering in de productiefrontend.
- `NO-GO` voor een productiepilot en `v2_required` zolang alle bovenstaande
  vectors niet op Android en browser zijn geslaagd.

## Eerstvolgende stap

Bootstrap, persistente storehydratie en transactionele encrypt/decrypt binnen
de worker zijn nu met echte libsignal-WASM en IndexedDB in Chromium bewezen.
De browserprovider gebruikt nu ook de bestaande v2 send/receive-orchestrator:
per-target encryptie heeft een stabiele operation-ID en acknowledgements volgen
pas na de lokale decryptiecommit. De duurzame ciphertextoutbox en versleutelde
lokale ontvangstgeschiedenis worden in echt Chromium na workerherstart
hersteld; de outbox wordt pas na succesvolle verzending verwijderd.
Browserregistratie en de lokale revoke/identity-change-lifecycle zijn eveneens
geïmplementeerd en unitgetest; persistente remote sessieverwijdering is in
Chromium bewezen. De browser-QA-runtime is inmiddels conditioneel aan de
chatinterface gekoppeld en de echte QA-webappbuild bundelt worker, WASM en
strikte CSP succesvol. Live browserregistratie, een PQXDH-bericht, offline
delivery na volledige workerherstart, exact-once acknowledgement en revoke zijn
op 21 oktober 2026 tegen het afgescheiden Firebase-QA-project geslaagd. Een
echte browser identity-change op dezelfde devicebinding verhoogde daarna de
server-side identityversie, verwijderde de oude sessie en TOFU-cache en bouwde
met de nieuw geclaimde prekeybundle gecontroleerd een verse PQXDH-sessie op.
Berichten na de rotatie slaagden in beide richtingen. Voer nu de
Android-browser-vectors uit. De eerste live baseline daarvan is op 21 oktober
2026 geslaagd: browserciphertext werd afzonderlijk naar twee actieve
Androiddevices gefan-out, een fysiek Androidtoestel ontsleutelde en bevestigde
zijn eigen envelop en een native Android-antwoord werd door het tijdelijke
browserdevice ontsleuteld en bevestigd. Het tijdelijke browseraccount, device
en gesprek zijn daarna verwijderd. Een aansluitende proef bewees pending
delivery en sessieherstel na een volledige Android-appstop en volledige
browserworkerstop in beide richtingen; de verse worker hydrateerde dezelfde
versleutelde IndexedDB-binding en ratchetsessie voordat hij het Androidantwoord
ontsleutelde en bevestigde. Een daaropvolgende cross-platform identity-change
verhoogde de browserbinding van identityversie `1` naar `2`; Android
ontsleutelde daarna met een vernieuwde sessie en het Androidantwoord werd door
de browser ontsleuteld en bevestigd. De aansluitende cross-platform revoke-
proef blokkeerde de oude browserfeed met `403`, registreerde een nieuwe binding
met een nieuw Signal-device-ID en slaagde daarna opnieuw in beide
berichtrichtingen. De release-WASM-proef in echt Chromium weigert bovendien
zowel bitgemanipuleerde ciphertext met transactionele sessierollback als replay
van een al verwerkte ciphertext met een nieuwe operation-ID. Alleen het
onafhankelijke reviewbewijs blijft vóór een productiepilot open.
Het opslag-, CSP- en panic-herstelontwerp staat in
[E2EE_BROWSER_SECURITY_DESIGN.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_SECURITY_DESIGN.md).

## Primaire bronnen

- officiele libsignal-repository: https://github.com/signalapp/libsignal
- onderzochte WASM-kandidaat: https://github.com/getmaapp/signal-wasm
- vastgepinde kandidaatbasis:
  https://github.com/getmaapp/signal-wasm/blob/main/Cargo.toml
