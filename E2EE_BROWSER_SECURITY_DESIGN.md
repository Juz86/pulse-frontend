# Pulse E2EE Browser Security Design

Status: opslag-, worker-, bootstrap- en hydratatiebasis geimplementeerd voor geisoleerde QA, niet goedgekeurd voor productie

## Grenzen

Dit ontwerp geldt uitsluitend voor de toekomstige browserprovider van
`pulse_e2ee_v2`. De bestaande mockstores in `src/lib/e2ee/secureKeyStore.js` en
`src/lib/e2ee/sessionStore.js` gebruiken `localStorage` en mogen niet worden
hergebruikt voor echte cryptografische records.

De browserclient blijft fail-closed totdat dit ontwerp is geimplementeerd,
getest en onafhankelijk beoordeeld. Een `v2_required`-gesprek valt nooit terug
naar mock, legacy, server-side decryptie of plaintext.

## Dreigingsmodel

De browserprovider beschermt tegen:

- uitlezen van IndexedDB-bestanden buiten de actieve browsercontext;
- onbedoelde opname van private records in gewone webopslag, logs of backups;
- gedeeltelijke writes, crashes, reloads en dubbele delivery;
- gebruik van records van een andere Pulse-gebruiker of ander device;
- replay van al verwerkte envelopes.

De provider kan niet beschermen tegen kwaadaardige code die al onder dezelfde
origin draait. Een XSS-, extensie- of supply-chaincompromis tijdens een actieve
sessie kan een niet-exporteerbare `CryptoKey` nog steeds laten gebruiken en kan
plaintext rond encryptie/decryptie observeren. Same-origin code-uitvoering geldt
daarom als volledige compromittering van de geopende browserclient.

## Uitvoeringsisolatie

- libsignal-WASM draait in een dedicated module worker, niet op de UI-thread;
- de worker accepteert alleen gestructureerde, gevalideerde v2-opdrachten;
- de UI krijgt uitsluitend publieke registratievelden, ciphertext of de
  minimaal benodigde ontsleutelde berichttekst terug;
- private records, sessiesnapshots en wrapping keys worden nooit via React
  state, Redux, DOM-events, console, Sentry of analytics doorgegeven;
- iedere workerinstance krijgt een monotone generatie-ID. Antwoorden van een
  oude of beeindigde generatie worden geweigerd;
- een WASM-trap beeindigt de worker onmiddellijk. Dezelfde instance wordt nooit
  opnieuw gebruikt.

## Persistente opslag

Gebruik een aparte IndexedDB-database, bijvoorbeeld `pulse-e2ee-v2`, met
versioned object stores:

- `keyring`: niet-exporteerbare Web Crypto-wrapping keys;
- `records`: versleutelde identity-, prekey-, Kyber-, sessie- en mappingrecords;
- `operations`: transactionele decryptie-, encryptie- en outboxstatus;
- `metadata`: uitsluitend schema-, migratie- en lokale deviceversies.

`localStorage`, `sessionStorage`, Cache Storage en service-worker caches zijn
verboden voor private records, sessies, berichtplaintext en plaintextoutboxen.

### Wrapping key

- algoritme: AES-256-GCM;
- Web Crypto-key: `extractable: false`;
- usages: uitsluitend `encrypt` en `decrypt`;
- de `CryptoKey` wordt via structured clone in IndexedDB opgeslagen;
- een nieuwe browserinstallatie krijgt een nieuwe key; er is geen cloudexport;
- verwijderen van sitegegevens maakt lokale records onherstelbaar en vereist
  server-side device-intrekking plus herregistratie.

Niet-exporteerbaar betekent niet dat same-origin kwaadaardige JavaScript de key
niet kan gebruiken. Het beperkt vooral directe sleuteluitvoer en onbedoelde
serialisatie.

### Recordformaat

Elk record bevat minimaal:

- `schemaVersion` en `cryptoVersion`;
- `uid`, opaque backend-device-ID en numeriek Signal-device-ID;
- `recordType` en stabiele record-ID;
- willekeurige unieke 96-bit IV;
- AES-GCM-ciphertext;
- vaste AAD met alle bovenstaande bindings;
- aanmaak- en updateversie, maar geen berichtinhoud.

Een IV mag onder dezelfde wrapping key nooit worden hergebruikt. AAD-mismatch,
onbekende versie of decryptiefout blokkeert het record fail-closed.

## JavaScript/WASM-secretgrens

De huidige kandidaat serialiseert private libsignal-records naar bytearrays aan
de JavaScriptzijde voordat Web Crypto ze kan wrappen. Daarom gelden aanvullend:

- encryptie volgt onmiddellijk op export uit WASM;
- tijdelijke `Uint8Array`-buffers worden in `finally` best-effort met nullen
  overschreven en referenties worden losgelaten;
- private bytes worden nooit naar strings, JSON, Base64, exceptions of logs
  omgezet;
- records worden bij import alleen per operatie ontsleuteld en niet langer dan
  nodig in geheugen gehouden;
- de onafhankelijke review moet beoordelen of de wrapper de exportgrens kan
  verkleinen. JavaScript-geheugen kan niet gegarandeerd worden gewist.

## Transactioneel berichtgedrag

### Ontvangst

1. Valideer envelope, devicebinding, identityversie en ciphertexthash.
2. Open één IndexedDB-transactie voor de relevante records en operation-ID.
3. Als de operation-ID al `committed` is, retourneer het bestaande resultaat en
   decrypt niet opnieuw.
4. Laad de oude sessiestaat en decrypt in de actuele worker.
5. Bewaar bijgewerkte sessierecords, lokale berichtgeschiedenis en de
   `committed` operation-ID atomisch.
6. Bevestig de backend-envelope pas na een geslaagde lokale commit.

Crasht de worker voor stap 5, dan wordt hij vervangen en kan dezelfde envelope
tegen de oude, nog consistente sessiestaat worden verwerkt. Na stap 5 voorkomt
de operation-ID een tweede ratchetstap.

### Verzenden

1. Maak eerst een stabiel client-message-ID en operation-ID.
2. Encrypt eenmaal.
3. Commit bijgewerkte sessies en de exacte ciphertextoutbox atomisch.
4. Verzend uitsluitend de opgeslagen ciphertext.
5. Netwerkretries hergebruiken dezelfde ciphertext en message-ID; ze encrypten
   het bericht niet opnieuw.

Plaintext wordt niet in de persistente outbox opgeslagen.

## Panic- en crashherstel

- iedere WASM-trap of onverwachte panic markeert de worker als onbruikbaar;
- alle pending promises van die generatie falen met één generieke foutcode;
- de worker wordt beeindigd en als verse instance opnieuw geladen;
- alleen gecommitteerde IndexedDB-staat wordt opnieuw geimporteerd;
- maximaal één automatische herstelpoging per operatie;
- een tweede fout blokkeert de provider totdat de gebruiker Pulse opnieuw opent;
- decryptie-acknowledgements en outboxverwijdering gebeuren nooit vóór de
  lokale transactiecommit;
- crashdetails bevatten geen keys, ciphertext, plaintext of recordbytes.

## CSP voor browser-QA

De huidige algemene CSP bevat `script-src 'unsafe-inline'`. Een browser-E2EE-
QA-build krijgt daarom een aparte origin of afzonderlijke hostingconfiguratie
met minimaal:

```text
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
script-src-attr 'none';
worker-src 'self';
object-src 'none';
base-uri 'none';
frame-ancestors 'none';
frame-src 'none';
connect-src 'self' <exacte-QA-backend> <noodzakelijke-Firebase-endpoints>;
```

Voor deze QA-origin gelden verder:

- geen `'unsafe-inline'`, `'unsafe-eval'`, wildcard scriptbronnen of externe
  scripts;
- WASM, worker en JavaScript worden vanaf dezelfde origin geleverd;
- geen third-party analytics; fouttelemetrie is standaard uit;
- immutable assets krijgen build-time hashes;
- de legacy inline `e2ee-storage-bridge.html` wordt niet aangeboden;
- een CSP-report mag alleen richtlijnmetadata bevatten, nooit URL-querydata of
  berichtinhoud.

`'wasm-unsafe-eval'` wordt alleen toegevoegd als de doelbrowsers dit voor
WebAssembly-compilatie vereisen. De browsermatrix moet bewijzen dat er geen
ruimere `'unsafe-eval'` nodig is.

## Lifecycle

- accountwissel sluit databasehandles, beeindigt de worker en wist geheugen;
- gewoon uitloggen verwijdert niet stil een nog geregistreerd device, maar
  maakt lokale decryptie ontoegankelijk tot herauthenticatie;
- expliciet device verwijderen trekt eerst server-side in en wist daarna
  keyring, records, operations en workergeheugen;
- remote revoke wist lokale records onmiddellijk en blokkeert de provider;
- identity-change verwijdert alleen de betrokken remote sessies en vereist de
  bestaande trust-/herregistratieregels;
- een schemaupgrade werkt copy-on-write en behoudt de oude database totdat de
  nieuwe database volledig is gevalideerd.

## Acceptatietests

Voor browser-QA zijn minimaal vereist:

- geen private record- of plaintexttreffers in gewone webopslag, Cache Storage,
  console, CSP-rapporten en netwerkverkeer;
- databasecopy kan zonder de niet-exporteerbare wrapping key niet ontsleutelen;
- AAD-, IV-, ciphertext- en schemamanipulatie worden geweigerd;
- reload, workerpanic en browsertabcrash veroorzaken geen ratchetdubbelstap;
- ack-na-commit en exact-eenmaal UI-weergave bij offline delivery;
- ciphertextoutbox blijft idempotent over reload en netwerkretry;
- revoke, identity-change, accountwissel en site-data-verwijdering gedragen zich
  fail-closed;
- de strikte QA-CSP werkt in alle ondersteunde browsers zonder consolefouten of
  ruimere scriptrechten.
