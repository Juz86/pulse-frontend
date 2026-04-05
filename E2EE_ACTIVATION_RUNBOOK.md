# Pulse E2EE Activation Runbook

Dit document beschrijft de praktische stappen om de frontend van de huidige veilige standaard naar de eerste service-based E2EE-testfase te brengen.

## Doel

De eerste activatiefase is niet meteen "echte crypto in productie", maar:

- backend-endpoints live
- frontend op `service` transport
- mock crypto nog actief
- 1-op-1 chats end-to-end door de nieuwe flow laten lopen
- attachments eerst via `remote_mock`

## Huidige Veilige Standaard

- `REACT_APP_E2EE_MODE=mock`
- `REACT_APP_E2EE_TRANSPORT=socket`

Dit betekent:

- bestaande chatflow blijft leidend
- E2EE-voorbereiding is aanwezig maar nog niet actief als primaire transportlaag

## Activatiedoel Voor Fase 1

Zet naar:

- `REACT_APP_E2EE_MODE=mock`
- `REACT_APP_E2EE_TRANSPORT=service`
- `REACT_APP_E2EE_ATTACHMENT_TRANSPORT=remote_mock`

Dit betekent:

- frontend gebruikt de nieuwe serviceflow
- crypto blijft nog mock, zodat de integratie eerst technisch stabiel kan worden gemaakt
- attachments lopen via de nieuwe mock-storage route in plaats van alleen inline data-urls
- het expliciete encrypted media-profiel is in deze fase `mock_media_v1`

## Voorwaarden Vooraf

Voordat je deze switch doet, moeten minimaal klaar zijn:

- `POST /devices/register`
- `GET /users/:userId/key-bundle`
- `POST /messages/send`
- `POST /messages/receipt`
- `POST /api/attachments/upload`
- `GET /attachments/:attachmentId`
- mixed `GET /api/messages/:convId`
- parent policy checks op key bundle en send

Zie ook:

- [BACKEND_E2EE_API_SPEC.md](/home/yushuaabdulkadir/pulse-frontend/BACKEND_E2EE_API_SPEC.md)
- [E2EE_BACKEND_HANDOFF_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKEND_HANDOFF_CHECKLIST.md)

## Stappenplan

1. bevestig dat backend basisroutes live zijn
2. zet lokaal `REACT_APP_E2EE_TRANSPORT=service`
3. laat `REACT_APP_E2EE_MODE=mock` ongemoeid
4. start de frontend opnieuw
5. log in met twee accounts die een toegestaan 1-op-1 contact vormen
6. controleer dat device bootstrap succesvol kan lopen
7. verstuur een direct chatbericht
8. controleer dat optimistic message van `sending` naar `sent` gaat
9. controleer dat de ontvanger het bericht ziet
10. controleer dat conversation previews niet leeg zijn
11. stuur een kleine attachment
12. controleer dat de composer `Bijlage voorbereiden...` en daarna `Bijlage geupload` toont
13. controleer dat de attachmentkaart `Beveiligde opslaglink` toont
14. controleer dat de attachmentkaart na openen/downloaden ook `Media-strategie: mock_media_v1` toont
15. controleer dat de conversatielijst `versleuteld` toont en hetzelfde `mock_media_v1` profiel blijft volgen
16. controleer dat openen/downloaden na refresh nog werkt

## Verwachte Frontendsignalen

Bij een gezonde eerste activatie:

- de app blijft opstarten zonder harde fouten
- `useConversations` gebruikt service transport voor direct chats
- binnenkomende berichten worden gehydrateerd
- preview toont plaintext of `Versleuteld bericht`
- retries blijven werken
- remote attachments krijgen een echte backend-downloadlink
- metadata- en downloadheaders vertellen hetzelfde `mock_media_v1` profiel
- `npm run smoke:attachments` blijft groen

## Niet Meteen Doen

Doe in deze fase nog niet:

- `REACT_APP_E2EE_MODE=signal`
- group encryption buiten de huidige mock/serviceflow
- encrypted edits
- echte production media-encryptie met storage provider
- call/video meenemen in de E2EE-migratie

## Rollback

Als de eerste service-integratie onstabiel blijkt:

1. zet `REACT_APP_E2EE_TRANSPORT=socket`
2. laat `REACT_APP_E2EE_MODE=mock`
3. herstart de frontend

Dan valt de app terug op de bestaande socketflow.

## Acceptatiecriteria Voor Fase 1

- login blijft werken
- direct chat send werkt
- direct chat receive werkt
- retries werken
- previews zijn niet leeg
- attachments openen na refresh nog steeds
- `mock_media_v1` blijft zichtbaar in attachment access-signalen
- `smoke:attachments` is groen
- build, tests en lint blijven groen

## Daarna

Pas als fase 1 stabiel is:

1. echte crypto-adapter voorbereiden
2. sessie-opbouw per device aanscherpen
3. echte encrypted media/storage ontwerpen
4. group model ontwerpen

## Lees Verder

- [E2EE_ROLLOUT.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ROLLOUT.md)
- [E2EE_TROUBLESHOOTING.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_TROUBLESHOOTING.md)
- [E2EE_IMPLEMENTATION_STATUS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_IMPLEMENTATION_STATUS.md)
