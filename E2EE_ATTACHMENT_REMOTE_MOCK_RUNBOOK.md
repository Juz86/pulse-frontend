# Pulse E2EE Attachment Remote Mock Runbook

Dit document beschrijft een oudere lokale testflow voor attachments via de `remote_mock` route.

Belangrijk:

- dit document is alleen historisch of intern referentiemateriaal
- media of bestanden versturen tussen gebruikers hoort niet bij de actieve productscope van Pulse
- de actieve E2EE-scope blijft chatten, bellen en videobellen

## Oorspronkelijk Doel

Valideren dat attachments niet meer alleen inline data-urls gebruiken, maar via de backend een echte download-URL krijgen.

## Benodigde Frontend Flags

- `REACT_APP_E2EE_MODE=mock`
- `REACT_APP_E2EE_TRANSPORT=service`
- `REACT_APP_E2EE_ATTACHMENT_TRANSPORT=remote_mock`

## Benodigde Backend Setup

In `backend-skeleton`:

- `npm run dev:emulator`
- optioneel vooraf:
  - `npm run wipe:attachments`
  - `npm run smoke:attachments`
  - `npm run smoke:attachments:future`

## Verwachte Flow

1. gebruiker kiest een bestand in de composer
2. frontend toont `Bijlage voorbereiden...`
3. attachment gaat naar `POST /api/attachments/upload`
4. backend zet mock-storage metadata terug met:
   - `downloadUrl`
   - `storageKey`
   - `transfer: remote`
   - `encryption`
   - `strategyKey: mock_media_v1`
5. bericht wordt als attachment via de serviceflow verstuurd
6. backend bewaart de mock media-envelope en metadata zoals:
   - `contentEncoding: mock-e2ee-envelope-v1`
   - `envelopeKind: pulse_mock_media_envelope`
   - `strategyKey: mock_media_v1`
   - `originalMimeType`
7. ontvanger ziet een attachmentkaart met `Mock versleutelde opslaglink`
8. conversatielijst toont `versleuteld`

## Handmatige Test

- [ ] frontend opnieuw gestart na env-wijziging
- [ ] backend draait op `localhost:3001`
- [ ] twee testaccounts ingelogd
- [ ] kleine afbeelding of tekstbestand verzonden
- [ ] composer toont `Bijlage voorbereiden...`
- [ ] composer toont daarna `Bijlage geupload`
- [ ] ontvanger ziet attachmentkaart
- [ ] attachmentkaart toont `Mock versleutelde opslaglink`
- [ ] attachmentkaart toont ook `Media-strategie: mock_media_v1` na openen/downloaden
- [ ] attachmentkaart toont `Envelope: pulse_mock_media_envelope`
- [ ] conversatielijst toont `versleuteld`
- [ ] conversatielijst/samenvatting blijft op `mock_media_v1`-contract staan
- [ ] conversatielijst toont het originele mime type
- [ ] `Openen` werkt
- [ ] `Downloaden` werkt
- [ ] attachment blijft werken na refresh
- [ ] attachment blijft werken na backend-herstart
- [ ] retry van een mislukte attachment behoudt dezelfde contractweergave
- [ ] forward van een attachment behoudt dezelfde contractweergave

## Snelle Backend Checks

- health:
  `curl -s http://127.0.0.1:3001/health`
- attachment smoke:
  `npm run smoke:attachments`
- future attachment smoke:
  `npm run smoke:attachments:future`
- metadata-contract:
  controleer in de smoke-output:
  - `strategyKey`
  - `contentEncoding`
  - `envelopeKind`
  - `originalMimeType`
- attachment cleanup:
  `npm run wipe:attachments`

## Bekende Grenzen

- dit is nog geen echte productie-storage
- encryptievelden zijn nog mock metadata
- strategieprofiel hoort in deze fase expliciet `mock_media_v1` te zijn
- bestanden landen lokaal onder `/tmp/pulse-e2ee-attachments`
- dit is bedoeld als tussenfase vóór echte encrypted media-opslag

## Historische Vervolgstap

Als deze flow stabiel is, is de volgende technische stap:

1. echte storage provider aansluiten
2. echte media-encryptie/decryptie toevoegen
3. downloadrechten en lifecycle aanscherpen
