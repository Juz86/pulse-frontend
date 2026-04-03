# Pulse E2EE Manual QA Checklist

Deze checklist is bedoeld voor de eerste handmatige validatie van de E2EE-rollout zodra backend-endpoints beschikbaar zijn.

## Testdoel

Valideren dat de frontend correct overschakelt van de huidige socketflow naar de nieuwe serviceflow, eerst met mock crypto.

## Testconfiguratie

Gebruik in deze fase:

- `REACT_APP_E2EE_MODE=mock`
- `REACT_APP_E2EE_TRANSPORT=service`

## Voorwaarden

- backend basisroutes zijn live
- twee testaccounts bestaan
- beide accounts mogen volgens parent policy met elkaar chatten
- frontend start zonder build- of runtimefouten

## Scenario 1: Login En Bootstrap

- [ ] login werkt voor account A
- [ ] login werkt voor account B
- [ ] device bootstrap faalt niet zichtbaar
- [ ] app blijft bruikbaar na login

## Scenario 2: Direct Chat Versturen

- [ ] open een 1-op-1 gesprek
- [ ] verstuur een bericht vanaf account A
- [ ] optimistic message verschijnt direct
- [ ] status gaat van `sending` naar `sent`
- [ ] account B ontvangt het bericht

## Scenario 3: Direct Chat Ontvangen

- [ ] account B ziet het bericht zonder lege bubble
- [ ] preview in gesprekslijst is niet leeg
- [ ] fallbacktekst werkt als decryptie niet beschikbaar is

## Scenario 4: Retry Flow

- [ ] forceer of simuleer een mislukte send
- [ ] bericht komt in failed-status
- [ ] retry werkt
- [ ] bericht eindigt alsnog in `sent`

## Scenario 5: Realtime Flow

- [ ] binnenkomend bericht verschijnt zonder pagina-refresh
- [ ] frontend accepteert `message:new` of legacy realtime-event
- [ ] statusupdates blijven zichtbaar

## Scenario 6: Edit Policy

- [ ] legacy/plaintext berichten kunnen nog via bestaande flow bewerkt worden als die flow actief is
- [ ] `signal_v1` berichten tonen geen editoptie
- [ ] encrypted berichten worden niet overschreven door plaintext edit-events

## Scenario 7: Parent Policy

- [ ] toegestaan contact kan berichten uitwisselen
- [ ] geblokkeerd of niet-goedgekeurd contact kan niet succesvol versturen
- [ ] frontend crasht niet als backend een policy-deny teruggeeft

## Scenario 8: UI Consistentie

- [ ] conversation previews tonen tekst of `Versleuteld bericht`
- [ ] message bubbles tonen tekst of `Versleuteld bericht`
- [ ] contextmenu blijft logisch
- [ ] chat blijft scrollbaar en bruikbaar

## Scenario 9: Regression Basics

- [ ] marketingpagina's laden nog normaal
- [ ] ParentDashboard blijft openen
- [ ] bestaande socketmodus kan indien nodig nog teruggezet worden

## Afronding

Na succesvolle handmatige QA:

- [ ] build blijft groen
- [ ] tests blijven groen
- [ ] lint blijft groen
- [ ] rollbackpad naar `socket` is bevestigd

## Lees Verder

- [E2EE_ACTIVATION_RUNBOOK.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ACTIVATION_RUNBOOK.md)
- [E2EE_TROUBLESHOOTING.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_TROUBLESHOOTING.md)
- [E2EE_BACKEND_HANDOFF_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKEND_HANDOFF_CHECKLIST.md)
