# Pulse E2EE Attachment Remote Mock Runbook

Dit document beschrijft de lokale testflow voor attachments via de nieuwe `remote_mock` route.

## Doel

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

## Verwachte Flow

1. gebruiker kiest een bestand in de composer
2. frontend toont `Bijlage voorbereiden...`
3. attachment gaat naar `POST /api/attachments/upload`
4. backend zet mock-storage metadata terug met:
   - `downloadUrl`
   - `storageKey`
   - `transfer: remote`
   - `encryption`
5. bericht wordt als attachment via de serviceflow verstuurd
6. ontvanger ziet een attachmentkaart met `Beveiligde opslaglink`
7. conversatielijst toont `opslaglink`

## Handmatige Test

- [ ] frontend opnieuw gestart na env-wijziging
- [ ] backend draait op `localhost:3001`
- [ ] twee testaccounts ingelogd
- [ ] kleine afbeelding of tekstbestand verzonden
- [ ] composer toont `Bijlage voorbereiden...`
- [ ] composer toont daarna `Bijlage geupload`
- [ ] ontvanger ziet attachmentkaart
- [ ] attachmentkaart toont `Beveiligde opslaglink`
- [ ] conversatielijst toont `opslaglink`
- [ ] `Openen` werkt
- [ ] `Downloaden` werkt
- [ ] attachment blijft werken na refresh
- [ ] attachment blijft werken na backend-herstart

## Snelle Backend Checks

- health:
  `curl -s http://127.0.0.1:3001/health`
- attachment smoke:
  `npm run smoke:attachments`
- attachment cleanup:
  `npm run wipe:attachments`

## Bekende Grenzen

- dit is nog geen echte productie-storage
- encryptievelden zijn nog mock metadata
- bestanden landen lokaal onder `/tmp/pulse-e2ee-attachments`
- dit is bedoeld als tussenfase vóór echte encrypted media-opslag

## Daarna

Als deze flow stabiel is, is de volgende technische stap:

1. echte storage provider aansluiten
2. echte media-encryptie/decryptie toevoegen
3. downloadrechten en lifecycle aanscherpen
