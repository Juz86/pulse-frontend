# Pulse E2EE Media Storage Plan

Dit document beschrijft een ouder intern plan voor de overgang van `mock_media_v1` naar echte encrypted media/storage.

Belangrijk:

- dit document is alleen historisch of intern referentiemateriaal
- media of bestanden versturen tussen gebruikers hoort niet bij de actieve productscope van Pulse
- de actieve E2EE-scope blijft chatten, bellen en videobellen

## Historische Fase

Vandaag gebruikt Pulse lokaal:

- `REACT_APP_E2EE_ATTACHMENT_TRANSPORT=remote_mock`
- `strategyKey: mock_media_v1`
- `contentEncoding: mock-e2ee-envelope-v1`
- `envelopeKind: pulse_mock_media_envelope`

Deze fase valideert al:

- upload via backend
- metadata + downloadheaders
- integrity checks via SHA-256
- wrapped media key-contractvelden
- open/download via access adapter
- historische runtime smoke via een oude attachment-scriptlaag buiten de actieve standaardflow

## Historisch Doel

De volgende echte stap is een productiegericht media-profiel:

- `strategyKey: pulse_media_v1`
- `alg: pulse-media-envelope-v1`
- `envelopeKind: pulse_media_envelope`
- `keyWrapAlg: pulse_media_key_wrap_v1`

Voor dit toekomstige profiel bestond historisch ook al een backend smoke via een aparte attachment-scriptlaag buiten de actieve standaardflow.

Die valideert lokaal al:

- `strategyKey: pulse_media_v1`
- `contentEncoding: pulse-media-envelope-v1`
- `envelopeKind: pulse_media_envelope`
- `mediaKeyId` en `keyWrapAlg` in metadata en downloadheaders

Historisch hoorde daar ook een gecombineerde frontend+backend check bij via een aparte verify-scriptlaag.

## Historisch Gewenst Contract

Een echte media-attachment hoort uiteindelijk minimaal te dragen:

- `downloadUrl`
- `storageKey`
- `strategyKey`
- `contentEncoding`
- `envelopeKind`
- `expectedPayloadSha256`
- `originalMimeType`
- `mediaKeyId`
- `keyWrapAlg`
- `wrappedMediaKey`
- `wrappedMediaKeyDigest`

## Historische Runtimeflow

1. client maakt een willekeurige media key
2. bestand wordt lokaal encrypted naar een media-envelope
3. envelope wordt geupload naar storage/backend
4. wrapped media key wordt per gesprek of devicecontract meegestuurd
5. metadata-endpoint geeft alleen contractvelden terug, geen plaintext
6. access-adapter haalt metadata op
7. access-adapter haalt binary op
8. unwrap + decrypt gebeurt client-side

## Wat Historisch Al Klaarstond

De huidige codebase heeft al voorbereid:

- strategie-resolver in [attachmentCrypto.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/attachmentCrypto.js)
- centrale strategieconstants in [attachmentStrategyConstants.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/attachmentStrategyConstants.js)
- access-validatie in [attachmentAccessAdapter.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/attachmentAccessAdapter.js)
- transport-/normalisatiehelpers in:
  - [attachmentPayload.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/attachmentPayload.js)
  - [attachmentPresentation.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/attachmentPresentation.js)

De oudere uploadadapterlaag uit die historische fase hoort niet meer bij de actieve codebasis.

## Historisch Nog Open

- keuze van echte storage provider
- keuze van echte media-encryptie primitive
- policy voor media key-rotatie
- keuze of wrapped media keys per user of per device gaan
- cache-/retentiebeleid voor object URLs en binaries

## Historische Bouwvolgorde

1. `pulse_media_v1` contract definitief maken
2. echte encrypt/decrypt adapter toevoegen achter de bestaande strategy-resolver
3. backend metadata/upload aanpassen op het nieuwe profiel
4. smoke en handmatige QA uitbreiden voor `pulse_media_v1`
5. `mock_media_v1` pas daarna afbouwen
