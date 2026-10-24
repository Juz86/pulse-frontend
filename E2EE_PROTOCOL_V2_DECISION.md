# Pulse E2EE Protocol v2 Decision

Status: architectuur vastgesteld, crypto-provider nog niet vrijgegeven voor productie.

Dit document is het leidende ontwerp voor echte end-to-end encryptie in Pulse.
Het bestaande `signal_v1`-pad is een mock-integratie en mag niet als echte E2EE
worden geactiveerd of gepresenteerd.

## Doel en scope

De eerste echte E2EE-release ondersteunt uitsluitend een-op-een tekstberichten
op geregistreerde apparaten.

Niet onderdeel van de eerste release:

- groepsgesprekken;
- berichtbewerking;
- chatbijlagen;
- migratie of her-versleuteling van bestaande plaintextgeschiedenis;
- een E2EE-claim voor audio- of videobellen.

Oude gesprekken blijven leesbaar als legacygeschiedenis, maar krijgen geen
E2EE-indicator. Nieuwe v2-berichten mogen nooit stil terugvallen op plaintext.

## Protocolidentiteit

Het nieuwe wireprotocol heet `pulse_e2ee_v2`.

`signal_v1` blijft gereserveerd voor de bestaande mockfase. Dit voorkomt dat
Base64-payloads of oude testberichten later ten onrechte als cryptografisch
beschermd worden behandeld.

Voor iedere combinatie van verzendend en ontvangend apparaat bestaat een eigen
ratcheting sessie. Een bericht bevat daarom geen gedeelde `ciphertext` met losse
mock message keys, maar een afzonderlijke protocol-envelope per doelapparaat.

Conceptueel berichtcontract:

```json
{
  "protocol": "pulse_e2ee_v2",
  "protocolVersion": 2,
  "conversationId": "conv_123",
  "clientMessageId": "uuid",
  "senderDeviceId": "device_a1",
  "messageType": "text",
  "recipientEnvelopes": [
    {
      "recipientUserId": "uid_b",
      "recipientDeviceId": "device_b1",
      "envelopeType": "prekey|message",
      "ciphertext": "base64"
    }
  ]
}
```

De versleutelde body bevat de tekst en alle inhoudelijke velden, waaronder
mentions, geciteerde tekst en gedeelde contactgegevens. De backend bewaart geen
plaintextpreview.

## Device fan-out

De afzender maakt een envelope voor:

- ieder actief apparaat van iedere ontvanger;
- ieder ander actief apparaat van de afzender, zodat eigen apparaten dezelfde
  geschiedenis kunnen ontsleutelen.

De backend controleert voor iedere envelope dat:

- de gebruiker lid is van het gesprek;
- het doelaccount lid is van het gesprek;
- het doelapparaat actief is en bij dat account hoort;
- de afzender alleen namens een eigen actief apparaat verstuurt;
- ieder vereist doelapparaat precies eenmaal aanwezig is.

## Sleutel- en devicecontract

Ieder apparaat heeft een afzonderlijke identity key, signed prekey en voorraad
one-time prekeys. Een key-bundle wordt alleen verstrekt aan een gebruiker die
volgens gesprek-, contact- en ouderbeleid met de ontvanger mag communiceren.

One-time prekeys worden via een transactie gereserveerd en verwijderd. Hetzelfde
key-id mag nooit tweemaal worden uitgegeven.

Benodigde v2-operaties:

- device registreren met capability en protocolversie;
- signed prekey roteren;
- one-time prekeys aanvullen;
- key bundles atomisch claimen;
- apparaten benoemen, bekijken en intrekken;
- identity changes als beveiligingsevent verspreiden;
- alle sessies met een ingetrokken of gewijzigd apparaat ongeldig maken.

## Opslag op Android

Android wordt de eerste bewijsclient. De crypto-engine draait in native code en
wordt via een smalle Capacitor-plugin aan de React-laag aangeboden. Plaintext
private keys of sessierecords mogen niet door de JavaScript-bridge reizen.

Een niet-exporteerbare Android Keystore-sleutel beschermt een lokale database-
encryptiesleutel. Geserialiseerde identity-, prekey- en sessierecords worden
versleuteld opgeslagen in app-private opslag. Hardware-backed bescherming wordt
gebruikt waar het apparaat dit ondersteunt; ontbreken daarvan wordt als
capability geregistreerd en niet stil als hardware-backed gepresenteerd.

De officiële `org.signal:libsignal-client` en `org.signal:libsignal-android`
packages zijn de voorkeurskandidaat voor de Android-proef. Integratie mag pas na:

- juridische goedkeuring van AGPLv3-verplichtingen;
- een vastgepinde versie en dependency-verificatie;
- een upgrade- en rollbackplan;
- acceptatie dat Signal extern gebruik niet ondersteunt en API's kan wijzigen;
- interoperabiliteitstests tegen opgeslagen protocolvectors.

Libsignal `0.105.1` vereist voor sessieopbouw twee velden die niet in het
oorspronkelijke v2-ontwerp stonden. Het definitieve prekeycontract bevat daarom:

- een stabiele numerieke `signalDeviceId` van 1 t/m 127 naast Pulse' opaque
  string-`deviceId`;
- een ondertekende `kyberPreKey` naast `signedPreKey` en `oneTimePreKey`.

Deze velden zijn verplicht bij registratie, keyrotatie en key-bundle claims. De
backend genereert of vervangt ze nooit en ziet uitsluitend publiek materiaal.

## Browser-gate

De browser wordt niet als echte E2EE-client vrijgegeven totdat een onderhouden,
controleerbare browser-engine dezelfde protocolvectors verwerkt. De officiële
TypeScript-uitgave van libsignal is een native Node-module en is niet direct
geschikt voor een browserbundle.

Web Crypto en IndexedDB mogen een browser-keystore beschermen, maar vormen op
zichzelf geen Signal/Double Ratchet-implementatie. Pulse bouwt deze protocollen
niet zelf uit losse cryptografische primitives.

Tot deze gate slaagt:

- kan de browser legacygesprekken blijven gebruiken zonder E2EE-claim;
- kan een `v2_required` gesprek niet vanuit de browser worden gelezen of
  beantwoord;
- mag de backend nooit voor de browser ontsleutelen;
- mag ontbrekende browserondersteuning geen plaintextdowngrade veroorzaken.

Providerselectie op 20 oktober 2026:

- de officiele Node-binding en oude JavaScript-forks zijn afgewezen als
  browserprovider;
- `@getmaapp/signal-wasm@0.6.6` is alleen een mogelijke geisoleerde
  QA-kandidaat en geen goedgekeurde dependency;
- de kandidaat is gebaseerd op libsignal `0.101.0`, terwijl Android op
  `0.105.1` staat, en heeft nog geen onafhankelijke review van de actuele
  wrapper;
- een tijdelijke bronprobe tegen `0.105.1` bouwde succesvol, doorstond 51
  headless Chromium-tests en leverde na een schone rebuild dezelfde WASM-hash;
- integratie blijft desondanks `NO-GO` tot de paritybron onafhankelijk is
  beoordeeld en veilige browseropslag, CSP-impact en de volledige
  Android-browser-testmatrix zijn gevalideerd.

De bindende acceptatievoorwaarden staan in
[E2EE_BROWSER_PROVIDER_GATE.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_PROVIDER_GATE.md).
Het technische paritybewijs staat in
[E2EE_BROWSER_PROVIDER_PARITY_PROBE.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_PROVIDER_PARITY_PROBE.md).
De formele reconstructie-inputs staan in
[security/e2ee/browser-provider-review](/home/yushuaabdulkadir/pulse-frontend/security/e2ee/browser-provider-review/README.md)
en het bindende opslag-, CSP- en panic-herstelontwerp in
[E2EE_BROWSER_SECURITY_DESIGN.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BROWSER_SECURITY_DESIGN.md).

## Backend en realtime

De backend bewaart uitsluitend protocol-enveloppen en noodzakelijke metadata.
Het realtime kanaal is device-aware: een socket authenticeert zowel de gebruiker
als het geregistreerde apparaat en ontvangt alleen de eigen envelope. Een veilig
alternatief is een inhoudsloos `message:available` event waarna het apparaat de
eigen envelope via HTTPS ophaalt.

Pushmeldingen bevatten alleen generieke tekst zoals `Nieuw bericht`, plus een
opaque message- en conversation-id. Berichttekst, mentions, contactnamen en
cryptografische sleutels mogen niet in FCM-payloads staan.

Toegestane servermetadata voor fase 1:

- conversation-, message-, sender- en recipient-device-id;
- protocolversie en envelope-type;
- serverontvangsttijd, afleverstatus en beperkte berichtgrootte;
- generiek berichttype indien dit productmatig noodzakelijk blijkt.

## Gespreksstatus en downgradebescherming

Een gesprek heeft een expliciete serverstatus:

- `legacy`: bestaande plaintextflow;
- `v2_pending`: pilotvoorbereiding, nog niet als E2EE presenteren;
- `v2_required`: uitsluitend geldige `pulse_e2ee_v2`-enveloppen toegestaan.

Na overgang naar `v2_required` weigeren frontend en backend iedere plaintext- of
mock-send. Een storing geeft een zichtbare verzendfout; er bestaat geen
automatische socketfallback.

## Historie en verwijdering

Bestaande plaintextberichten worden niet opnieuw verpakt of als versleuteld
gelabeld. De UI scheidt legacygeschiedenis zichtbaar van het moment waarop echte
E2EE is geactiveerd. Verwijdering en retention blijven server-side metadata-
operaties; cryptografische verwijdering wordt niet beloofd voor reeds ontvangen
apparaten.

## Groepen

Groepen blijven buiten fase 1. Het huidige per-user fan-outmodel wordt niet
opgeschaald als geïmproviseerde groepsencryptie. Voor de vervolgfase is op 24
oktober 2026 een geisoleerde Android Sender Keys-kern toegevoegd. Distributies
worden uitsluitend via bestaande pairwise Signal-sessies ontworpen, iedere
sender key is gebonden aan groep, epoch, afzender en Signal-device, en replay of
een verwisselde groep/epoch wordt fail-closed geweigerd. Het wirecontract eist
precies één versleutelde distributie per actief doeldevice. Deze kern is nog
niet aan backendroutes of de chatinterface gekoppeld en is dus geen actieve
groeps-E2EE. De geisoleerde backendpolicy valideert inmiddels de autoritatieve
membership-hash, actuele epoch, senderdevicebinding en exacte device-fan-out.
Iedere lidmaatschapswijziging blokkeert distributie totdat een nieuwe epoch en
nieuwe distributies zijn vastgelegd. De backend slaat distributie-enveloppen nu
transactioneel per doeldevice op en markeert ze pas gereed nadat alle devices
ontvangst hebben bevestigd. Deze routes staan standaard uit. Nieuwe groepen
beginnen op epoch 1 en iedere effectieve lidmaatschapsmutatie roteert epoch en
membership-hash atomisch. Ook groepsberichtopslag, een inhoudsloze pending-feed,
devicegebonden ciphertext-ophalen en idempotente acknowledgement zijn
transactioneel gebouwd. Verzenden vereist een volledig bevestigde distributie
voor exact de actuele actieve doeldevices. De geisoleerde Android-
clientorchestrator bouwt en verwerkt distributies en groepsberichten inmiddels
met acknowledgement pas na lokale libsignal-commit. Chatruntime- en UI-
koppeling en live apparaatproeven blijven vereist voordat runtimeactivatie is
toegestaan.

## Audio en video

WebRTC gebruikt DTLS-SRTP voor mediatransport, maar Pulse bindt de DTLS-
fingerprint nog niet cryptografisch aan de geverifieerde chatidentiteit. Daarom
blijft de E2EE-claim voor oproepen uit totdat beide clients de sessie en
fingerprint ondertekenen en de peer deze tegen de bekende identity key
controleert. TURN mag alleen versleutelde media relayeren.

Op 24 oktober 2026 is hiervoor een geisoleerde Android-primitief toegevoegd die
een canonieke call-binding met sessie, deelnemers, Pulse- en Signal-device,
identityversie, media- en SDP-type, SHA-256-DTLS-fingerprint, revisie en nonce
ondertekent met de bestaande libsignal-identity key. Een antwoord bindt
daarnaast de ondertekende offer. Verificatie vereist vooraf bestaand Signal-
vertrouwen en weigert fingerprint-, sessie-, device- en identitywisselingen.
De native en JavaScript SDP-parsers accepteren alleen een eenduidige SHA-256-
fingerprint. De lokale Railway-kandidaat controleert het envelope tegen sessie,
actor, fingerprint en actieve v2-devicebinding. De Android media-controller
verifieert de Signal-handtekening voordat remote SDP wordt toegepast en laat
vroege ICE-candidates pas na die verificatie door. Herhaling van dezelfde
ondertekende binding wordt vóór een tweede SDP-apply geweigerd. Beide kanten blijven achter
standaard-uitgeschakelde gates en zijn nog niet live op twee apparaten getest;
audio- en videogesprekken hebben daarom nog geen Pulse-E2EE-claim.

## Gefaseerde uitvoering

1. Definieer v2-schema's en negatieve contracttests zonder runtimeactivatie.
2. Bouw device lifecycle, policycontrole en atomische prekey-claim in de backend.
3. Bouw de geïsoleerde native Android-provider en beveiligde opslag.
4. Bewijs Android-naar-Android interoperabiliteit met twee accounts en meerdere
   apparaten.
5. Bouw of selecteer een browserprovider en laat dezelfde vectors slagen.
6. Activeer een expliciete interne `v2_pending` pilot.
7. Laat een onafhankelijke beveiligingsreview uitvoeren.
8. Zet geselecteerde gesprekken om naar `v2_required`.
9. Toon pas daarna een E2EE-indicator voor die specifieke gesprekken.

De productiepilot gebruikt daarnaast een server-side cohortgate. Een globale
buildflag alleen is onvoldoende: user en gesprek moeten beide expliciet zijn
toegestaan en de deployment moet het review-attestation en de beoordeelde
frontend- en backendcommits vastpinnen. Nieuwe sends hebben een afzonderlijke
kill-switch; die mag feed-, decryptie-, acknowledgement- en revokeherstel niet
uitschakelen. Rollback van `v2_required` naar plaintext is verboden.

De client activeert de productieprovider niet uitsluitend op basis van een
buildflag. Eerst moet de geauthenticeerde pilotstatus bevestigen dat de server
correct is geconfigureerd en het account tot de cohort behoort. Deze controle
vindt plaats vóór workerstart, Keystore-bootstrap en deviceregistratie. QA- en
productiebindings zijn strikt gescheiden.

Uitvoeringsstatus op 24 oktober 2026:

- stappen 1 tot en met 4 zijn gebouwd en op twee fysieke Android-apparaten
  gevalideerd, inclusief offline herstel, multi-device, revoke en
  identity-change;
- voor stap 5 zijn providerselectie, technische libsignal-versiepariteit, een
  reproduceerbare reviewbundle, browserbeveiligingsontwerp en geisoleerde
  browser-QA-integratie gereed. Live browser-Android-verkeer is in beide
  richtingen geslaagd, inclusief per-device fan-out naar twee actieve
  Androidbindings en acknowledgement na decryptie. Volledige Android-appstop,
  browserworkerstop, pending delivery en sessiehydratie zijn daarna eveneens
  in beide richtingen geslaagd. Cross-platform identity-change van een
  browserbinding van identityversie `1` naar `2` is ook in beide richtingen met
  een fysiek Androidtoestel gevalideerd. De browserprovider weigert in echt
  Chromium ook gemanipuleerde ciphertext zonder ratchetcommit en replay van
  reeds verwerkte ciphertext. Cross-platform device-revoke blokkeerde daarna
  de oude devicefeed met `403`; een vervangende binding met een nieuw
  Signal-device-ID werkte opnieuw in beide richtingen met het fysieke
  Androidtoestel. Alleen het controleerbare onafhankelijke reviewbewijs blijft
  open;
- voor stap 6 is een strikt afgescheiden Android-only QA-pilot met een
  `v2_pending`-gesprek geslaagd. Dit is geen productiepilot en verandert de
  browsergate of productievoorwaarden niet. Daarnaast is versionCode 82 via
  de interne Play-testtrack op twee fysieke Androidtoestellen tegen een exact
  allowlisted productiebackendcohort getest. Versleutelde tekstberichten
  slaagden in beide richtingen, inclusief per-device opslag, lokale decryptie
  en acknowledgement. De serveropslag bevat geen plaintextveld. Deze
  `internal_play_test` blijft expliciet onbeoordeeld en is geen toestemming
  voor een openbare release;
- stap 8 is uitsluitend voor het ene bestaande `internal_play_test`-gesprek
  uitgevoerd: op 24 oktober 2026 is de status transactioneel naar
  `v2_required` gezet en teruggelezen. Beide pilotaccounts hadden daarbij een
  actieve Android-v2-binding en de 41 gerichte delivery- en
  downgradeblokkadetests slaagden. De live proef na de statuswijziging slaagde
  daarna op twee fysieke Androidtoestellen in beide richtingen, met lokale
  decryptie en acknowledgement. De serveraudit bevestigde per nieuw bericht
  protocol v2, een generieke servertekst, geen plaintextveld en afzonderlijke
  ciphertextenveloppen. Overige offline Yushua-bindings hielden hun eigen
  envelope terecht pending;
- stap 7, stap 9 en iedere bredere of openbare productie-uitrol blijven
  geblokkeerd totdat het controleerbare onafhankelijke securityreviewbewijs is
  toegevoegd;
- groepschat en oproepen zijn afzonderlijke vervolgfases. De Android Sender
  Keys-kern, het strikte groepswirecontract en de backendpolicy voor
  membership, epochs en exact device-fan-out zijn lokaal gebouwd en negatief
  getest. Transactionele sender-key-distributie, offline-feed en per-device-
  acknowledgement zijn eveneens lokaal gebouwd achter een standaard-uit-gate.
  Groepscreatie en effectieve lidmutaties initialiseren of roteren de epoch nu
  atomisch; ook ciphertextopslag, pending-feed en message-acknowledgement zijn
  gebouwd. De geisoleerde Android-clientorchestrator is eveneens getest;
  chatruntime- en UI-koppeling en live apparaatproeven blijven open. Voor
  een-op-een calls zijn backendautorisatie en native
  signalingkoppeling lokaal fail-closed gebouwd, maar live interoperabiliteit,
  review en een nieuwe AAB blijven open. VersionCode 82 bevat deze wijzigingen
  niet.

Stap 1 is uitgevoerd in:

- [src/lib/e2ee/v2/protocolV2Contract.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/protocolV2Contract.js)
- [src/lib/e2ee/v2/protocolV2Contract.test.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/protocolV2Contract.test.js)

Deze modules zijn bewust nog niet aan runtime, backendroutes of featureflags
gekoppeld.

Stap 2 is als geisoleerde backendlaag uitgevoerd in:

- `/home/yushuaabdulkadir/pulse-backend/src/e2ee/v2/contracts.js`
- `/home/yushuaabdulkadir/pulse-backend/src/e2ee/v2/deviceLifecycle.js`

Stap 3 is lokaal uitgevoerd. De Android Keystore-opslag, backupuitsluiting,
persistente libsignal-store, sessie-engine en smalle Capacitor-bridge bestaan.
Bootstrap, encryptie en decryptie zijn via een fail-closed Android-adapter
beschikbaar zonder private sleutel- of sessie-export. De libsignal
Android-artifacts zijn vastgepind op `0.105.1` en met SHA-256 dependency
verification toegevoegd. Opaque backend-device-ID's zijn persistent aan native
Signal-adressen gekoppeld en een geisoleerde send/receive-orchestrator
hergebruikt sessies zonder per bericht nieuwe prekeys te claimen. Identity-
versies zijn aan mappings en delivery-envelopes gebonden; hogere versies en
device-revokes verwijderen oude sessies fail-closed, ook wanneer het realtime
security-event werd gemist. De Android-provider en lifecycle zijn op twee echte
devices gevalideerd; productiekoppeling blijft bewust gesloten. Zie
[E2EE_ANDROID_PROVIDER_GATE.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ANDROID_PROVIDER_GATE.md).
- `/home/yushuaabdulkadir/pulse-backend/src/e2ee/v2/routes.js`

De legacyroutes zijn daarbij niet vervangen. De v2-clientkoppeling en
productieactivatie blijven uitgeschakeld.

## Harde acceptatiecriteria

Een productiepilot is geblokkeerd totdat tests aantonen dat:

- backend, database, Redis, logging en push geen plaintext ontvangen;
- iedere doeldevice een eigen geldige envelope krijgt;
- ontbrekende, dubbele en vreemde recipient devices worden geweigerd;
- een one-time prekey maximaal eenmaal wordt uitgegeven;
- identity changes sessies blokkeren totdat de gebruiker opnieuw vertrouwt;
- ingetrokken apparaten geen nieuwe berichten of key bundles ontvangen;
- gewijzigde, herhaalde of verwisselde ciphertext wordt geweigerd;
- offline delivery, reinstallatie en multi-device herstel voorspelbaar werken;
- een storing nooit naar mock of plaintext terugvalt;
- Android- en browserproviders dezelfde vastgelegde vectors verwerken.

## Referenties

- Signal libsignal: https://github.com/signalapp/libsignal
- Signal Double Ratchet: https://signal.org/docs/specifications/doubleratchet/
- Signal PQXDH: https://signal.org/docs/specifications/pqxdh/
- Signal Sesame: https://signal.org/docs/specifications/sesame/sesame.pdf
- Android Keystore: https://developer.android.com/privacy-and-security/keystore
- Web Cryptography API: https://www.w3.org/TR/webcrypto/
