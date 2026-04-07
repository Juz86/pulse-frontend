# Pulse E2EE Activation Runbook

Dit document beschrijft de praktische stappen om de frontend van de huidige veilige standaard naar de eerste service-based E2EE-testfase te brengen.

## Doel

De eerste activatiefase is niet meteen "echte crypto in productie", maar:

- backend-endpoints live
- frontend op `service` transport
- mock crypto nog actief
- 1-op-1 chats end-to-end door de nieuwe flow laten lopen
- bel- en videoflows in dezelfde appcontext stabiel houden
- geen chatmedia of attachments toevoegen

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

Dit betekent:

- frontend gebruikt de nieuwe serviceflow
- crypto blijft nog mock, zodat de integratie eerst technisch stabiel kan worden gemaakt
- de focus blijft op chatten, bellen en videobellen
- chatmedia blijft bewust buiten scope

## Voorwaarden Vooraf

Voordat je deze switch doet, moeten minimaal klaar zijn:

- `POST /devices/register`
- `GET /users/:userId/key-bundle`
- `POST /messages/send`
- `POST /messages/receipt`
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
11. start een spraakoproep
12. controleer dat een gemiste oproep logisch zichtbaar blijft
13. start een videogesprek
14. controleer dat call cards en chatweergave consistent blijven
15. controleer dat de composer geen media- of attachmentsendflow toont

## Verwachte Frontendsignalen

Bij een gezonde eerste activatie:

- de app blijft opstarten zonder harde fouten
- `useConversations` gebruikt service transport voor direct chats
- binnenkomende berichten worden gehydrateerd
- preview toont plaintext of `Versleuteld bericht`
- retries blijven werken
- call cards blijven logisch
- de composer blijft attachment-vrij

## Niet Meteen Doen

Doe in deze fase nog niet:

- `REACT_APP_E2EE_MODE=signal`
- group encryption buiten de huidige mock/serviceflow
- encrypted edits
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
- call/video-basics blijven werken
- de composer blijft vrij van chatmedia
- build, tests en lint blijven groen

## Daarna

Pas als fase 1 stabiel is:

1. echte crypto-adapter voorbereiden
2. sessie-opbouw per device aanscherpen
3. group model ontwerpen
4. encrypted edit-model uitwerken

## Lees Verder

- [E2EE_ROLLOUT.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ROLLOUT.md)
- [E2EE_TROUBLESHOOTING.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_TROUBLESHOOTING.md)
- [E2EE_IMPLEMENTATION_STATUS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_IMPLEMENTATION_STATUS.md)
