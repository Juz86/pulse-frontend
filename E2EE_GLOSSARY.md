# Pulse E2EE Glossary

Deze begrippenlijst maakt de E2EE-documentatie consistenter en helpt nieuwe ontwikkelaars sneller landen in de codebase.

## E2EE

End-to-end encryptie.

In deze repo betekent dat:

- berichtinhoud wordt uiteindelijk lokaal versleuteld en ontsleuteld
- backend doet vooral policy, routing, opslag en realtime delivery

## Mock Crypto

De tijdelijke crypto-implementatie die nu gebruikt wordt om architectuur en backendintegratie te testen zonder al echte cryptografie af te dwingen.

Zie:

- [src/lib/e2ee/adapter/pulseCryptoMock.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/adapter/pulseCryptoMock.js)

## Crypto Adapter

De abstraheringslaag tussen de app en een concrete crypto-implementatie.

Doel:

- mock en echte crypto dezelfde interface geven
- UI en hooks library-onafhankelijk houden

Zie:

- [src/lib/e2ee/adapter/pulseCryptoAdapter.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/adapter/pulseCryptoAdapter.js)

## Device Bootstrap

De flow waarbij een ingelogd account een lokale device identity krijgt en zich registreert bij de backend.

Zie:

- [src/lib/e2ee/deviceBootstrap.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/deviceBootstrap.js)

## Identity

De lokale device-identiteit van een gebruiker.

In deze repo omvat dat onder andere:

- device-id
- identity keypair
- signed prekey
- one-time prekeys

## Session

Lokale cryptografische toestand per remote device.

In deze repo wordt die opgeslagen via:

- [src/lib/e2ee/sessionStore.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/sessionStore.js)

## Service Transport

De nieuwe beoogde primaire verzendflow waarbij berichten via backend-endpoints worden verstuurd in plaats van direct via de oude socket-sendflow.

Flag:

- `REACT_APP_E2EE_TRANSPORT=service`

## Socket Transport

De huidige veilige standaard waarbij de bestaande chatflow leidend blijft.

Flag:

- `REACT_APP_E2EE_TRANSPORT=socket`

## Wire Message

De backend- of socketpayload die het transportmodel representeert.

Kenmerken:

- kan ciphertext bevatten
- is nog niet bedoeld voor directe rendering in UI

## View Message

De genormaliseerde berichtvorm die componenten uiteindelijk renderen.

Doel:

- componenten hoeven niets te weten van ciphertext of sessielogica

Zie:

- [src/lib/e2ee/messageModel.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messageModel.js)

## Hydration

Het proces waarbij een wire message wordt omgezet naar een UI-bruikbaar bericht.

Dat kan omvatten:

- normalisatie
- decryptie
- fallback naar `Versleuteld bericht`

Zie:

- [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)

## `message:new`

Het toekomstige realtime socket-event voor wire payload delivery in het nieuwe model.

De frontend luistert hier al op naast legacy events.

## Legacy Plaintext

De oude berichtflow waarin berichten als gewone tekst door het systeem gaan.

In de frontend wordt dit nog ondersteund voor compatibiliteit tijdens de migratie.

## Parent Policy

De server-side regels die bepalen:

- met wie een kind mag praten
- of chat/call/video toegestaan is
- of key bundle lookup of message send toegestaan is

## Productscope

De expliciete functionele grens van deze E2EE-fase.

In deze repo betekent dat:

- chatten, bellen en videobellen horen binnen scope
- media of bestanden tussen gebruikers versturen horen buiten scope

## Metadata-Only Dashboard

Een ouderdashboard dat zicht heeft op contacten, gebruik en activiteit, maar niet standaard afhankelijk is van server-side inhoudsinzage.

## Lees Verder

- [E2EE_DOCS_INDEX.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_DOCS_INDEX.md)
- [E2EE_ARCHITECTURE_OVERVIEW.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ARCHITECTURE_OVERVIEW.md)
- [E2EE_DECISIONS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_DECISIONS.md)
