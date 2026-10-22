# Android Data Safety Draft

Status op 22 oktober 2026: technische broncode-inventaris voltooid; nog niet
vergeleken met of ingediend in Google Play Console.

Dit document is een conservatieve invulbasis voor Pulse `1.0.24`
(`versionCode 80`). Het is geen juridisch advies en geen bewijs dat de huidige
Play Console-verklaring overeenkomt. Google Play behandelt ook gegevens die
vanuit een door de app bestuurde WebView of een SDK worden verstuurd als
verzameld. De uiteindelijke verklaring moet bovendien alle nog actieve
appversies omvatten.

## Technische scope

Beoordeeld zijn:

- de release-runtime met 174 opgeloste Android-componenten;
- het gemergde release-manifest;
- de React/Capacitor-WebView en native Android-bruggen;
- Firebase Authentication, Cloud Messaging en Installations;
- Sentry-fout- en prestatietelemetrie;
- de productie-API-, Firestore-, Storage-, chat-, bel- en locatiestromen.

De huidige release bevat geen Firebase Analytics- of Crashlytics-SDK. Play
Integrity en reCAPTCHA zijn transitieve onderdelen van Firebase Auth; Pulse
roept hun API niet rechtstreeks aan. Firebase Auth kan deze bescherming wel
zelf gebruiken afhankelijk van de authenticatiestroom en configuratie.

## Concept voor de Play-verklaring

Onderstaande regels zijn de minimale conservatieve kandidaat. `Delen: nee`
veronderstelt dat Firebase, Sentry, Railway en Cloudflare uitsluitend als
dienstverlener/verwerker namens Pulse handelen. De eigenaar moet dat vóór
indiening tegen de actuele overeenkomsten en configuratie bevestigen.

| Play-gegevenstype | Verzameld | Vereist of optioneel | Doel | Technisch bewijs |
| --- | --- | --- | --- | --- |
| Naam | ja | vereist voor accounts; profielwijziging optioneel | appfunctionaliteit, accountbeheer | Firebase-profiel en `/api/users` |
| E-mailadres | ja | vereist voor ouderaccounts en authenticatie | accountbeheer, beveiliging, communicatie | Firebase e-mail/wachtwoord en verificatiecode |
| Gebruikers-ID's | ja | vereist | appfunctionaliteit, accountbeheer, beveiliging | Firebase UID, backend-ID en Sentry user-ID |
| Overige persoonlijke informatie | ja | vereist/rolafhankelijk | accountbeheer, ouderlijk toezicht | rol, gebruikersnaam, ouder-kindrelaties en instellingen |
| Andere berichten in de app | ja | vereist voor chat | appfunctionaliteit | legacychat is nog niet overal echte E2EE; alleen echte `pulse_e2ee_v2`-inhoud kan onder de E2EE-uitzondering vallen |
| Foto's | ja | optioneel | appfunctionaliteit, accountbeheer | profiel/avatar-upload naar Firebase Storage |
| Contacten | ja | vereist voor de besloten communicatiefunctie | appfunctionaliteit, beveiliging | Pulse-contactgrafiek, verzoeken, blokkades en belgeschiedenis; geen adresboektoegang vastgesteld |
| App-interacties en overige acties | ja | vereist | appfunctionaliteit, beveiliging | aanwezigheid, leesstatus, beheerhandelingen en synchronisatie-events |
| Crashlogs | ja | vereist zolang Sentry standaard actief is | analyse, appfunctionaliteit | productie-Sentry vangt exceptions en gekoppelde Firebase UID op |
| Diagnostische gegevens | ja | vereist zolang Sentry standaard actief is | analyse, appfunctionaliteit | foutdetails, componentstack, domein en timing |
| Apparaat- of andere ID's | ja | vereist voor push en beveiligde sessies | appfunctionaliteit, beveiliging | FCM-token, Firebase Installation ID en Pulse installation-ID |

Er is geen codebewijs gevonden voor financiële gegevens, gezondheid en
fitness, agenda, geïnstalleerde apps, sms/mms, webbrowsegeschiedenis,
advertentie-ID's of advertentieprofilering.

## Beslispunten vóór indiening

### Locatie

`src/App.js` start voor niet-ouderaccounts `navigator.geolocation.watchPosition`
en schrijft latitude, longitude, nauwkeurigheid, richting en snelheid naar
Firestore. Dat is inhoudelijk `Precieze locatie`. Het gemergde manifest van de
gemeten v80-AAB bevat echter geen `ACCESS_FINE_LOCATION` of
`ACCESS_COARSE_LOCATION`, waardoor de huidige Android-app daarvoor geen
Android-runtimepermissie kan krijgen.

Voor de Play-verklaring geldt daarom:

- declareer `Precieze locatie` als verzameld wanneer een nog actieve Play-build
  deze stroom kan uitvoeren;
- anders eerst aantoonbaar bevestigen dat geen actieve Android-build locatie
  verstuurt en beslissen of de onbereikbare Android-code wordt verwijderd of
  als echte, optionele functie met passende toestemming wordt voltooid;
- niet indienen met een onbewezen `nee`.

### Audio en video

Pulse verstuurt microfoon- en cameramedia tijdens door de gebruiker gestarte
WebRTC-oproepen. Er is geen opname- of media-uploadpad vastgesteld. De eigenaar
moet in het formulier bevestigen dat deze realtime media uitsluitend tijdelijk
in geheugen wordt verwerkt en de optie voor efemere verwerking correct
beantwoorden. Dit staat los van een E2EE-claim voor bellen; die claim is nog
niet toegestaan.

### E2EE-uitzondering

Google Play sluit inhoud alleen van verzameling uit wanneer die voor iedere
tussenpartij, inclusief de ontwikkelaar, onleesbaar is en alleen afzender en
ontvanger de sleutels hebben. Die uitzondering mag daarom uitsluitend worden
gebruikt voor gevalideerde `pulse_e2ee_v2`-inhoud. De huidige legacyberichten en
gespreksmetadata blijven in de conceptverklaring opgenomen.

### Dienstverleners en delen

Google Play kan verwerking door een echte dienstverlener buiten `delen` laten.
Bevestig vóór `Delen: nee` minimaal:

- actuele verwerkersvoorwaarden/DPA voor Firebase, Sentry, Railway en
  Cloudflare;
- dat Sentry-events geen berichttekst, contactgegevens of authenticatietokens
  bevatten;
- dat FCM-payloads alleen generieke tekst en opaque identifiers bevatten;
- dat geen gekoppelde Firebase- of Sentry-integratie data voor advertenties of
  eigen doeleinden hergebruikt.

## Play Console-checklist

1. Exporteer de huidige Data Safety-CSV uit Play Console en bewaar die als
   gedateerd releasebewijs buiten publieke broncode wanneer zij accountdetails
   bevat.
2. Vergelijk iedere geselecteerde categorie met bovenstaande matrix en met alle
   actieve artifacts, niet alleen versionCode 80.
3. Bevestig `versleuteld tijdens transport` pas nadat alle productie-endpoints
   en mediatransporten zijn gecontroleerd.
4. Bevestig de verwijdermogelijkheid tegen de werkende accountverwijderflow en
   de openbare verwijderinstructies.
5. Controleer `vereist` versus `optioneel` voor profielbeeld, meldingen,
   microfoon, camera en eventuele locatie.
6. Laat de eigenaar de dienstverlenerstatus en doeleinden formeel bevestigen.
7. Sla de definitieve geëxporteerde CSV, datum, Play-account en verantwoordelijke
   op in het private releasearchief.

Het machineleesbare conceptantwoord staat in
`security/android-data-safety/release-1.0.24-v80-response-plan.json`. Het is
gebaseerd op het officiële Google-sjabloon dat op 22 oktober 2026 is gedownload
met SHA-256
`5eea7d426509e97523de02d31d2e94d574f096c111a6857f78929e735cf99e13`.
Het plan blijft geblokkeerd zolang `ownerDecisions` niet met Console- en
contractbewijs zijn afgehandeld; het is dus bewust nog geen importbestand.

De lokale vergelijking draait zonder de private export aan Git toe te voegen:

```bash
npm run verify:play-console-release-evidence -- \
  --csv /pad/naar/play-console-export.csv \
  --upload-cert-sha256 'SHA-256-UIT-PLAY-CONSOLE'
```

Met `--validate-template` kan eerst alleen de CSV-structuur tegen het
versiegebonden antwoordplan worden gecontroleerd. De volledige controle
verifieert daarnaast de AAB-hash en leest met `keytool` het certificaat uit het
ondertekende release-AAB voordat dit met de Play Console-fingerprint wordt
vergeleken.

## Openbare primaire bronnen

- https://support.google.com/googleplay/android-developer/answer/10787469
- https://firebase.google.com/docs/android/play-data-disclosure
- https://firebase.google.com/support/privacy/

Google Play houdt de ontwikkelaar verantwoordelijk voor een volledige en
actuele verklaring. Deze conceptmatrix mag daarom niet automatisch naar
`goedgekeurd` worden omgezet.
