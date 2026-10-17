# Pulse libsignal License Decision

Status op 17 oktober 2026: de frontendrepository is onder `AGPL-3.0-only`
gelicentieerd. Libsignal `0.105.1` is toegevoegd aan lokale Android-builds. Een
publieke release blijft `NO-GO` totdat de compatibiliteit van alle meegeleverde
Android-dependencies en de volledige releaseprocedure zijn bevestigd.

Dit is een technische releasegate en geen juridisch advies.

## Vastgestelde feiten

- deze repository bevat de officiele AGPLv3-tekst in `LICENSE`;
- `package.json` bevat `private: true`; dit voorkomt alleen npm-publicatie en
  verandert de vastgelegde `AGPL-3.0-only`-licentie niet;
- libsignal is door Signal gepubliceerd onder GNU AGPLv3;
- voor Android zijn zowel `org.signal:libsignal-client` als
  `org.signal:libsignal-android` nodig en worden native libraries in de app
  gebundeld;
- Signal vermeldt dat gebruik buiten de eigen producten niet wordt ondersteund
  en dat API's zonder voorafgaande waarschuwing kunnen wijzigen.

Bronnen:

- https://github.com/signalapp/libsignal/blob/main/README.md
- https://github.com/signalapp/libsignal/blob/main/LICENSE
- https://github.com/signalapp/libsignal/blob/main/java/android/build.gradle
- https://www.gnu.org/licenses/agpl-3.0.html
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository

## Besluit

De libsignal Maven-repository en beide Android-artifacts zijn voor lokale
implementatie vastgepind op `0.105.1`. Gradle verifieert hun SHA-256-checksums.
Dit is geen goedkeuring voor publieke distributie: die blijft geblokkeerd totdat
de gecombineerde Android-dependencies, notices, Corresponding Source en
releaseprocedure zijn gecontroleerd.

## Goedgekeurde vervolgpaden

De gebruiker heeft route 1 als richting gekozen. De overige routes blijven een
fallback wanneer de compliancecontrole van route 1 niet slaagt:

1. Pulse bewust onder een AGPLv3-compatibele licentie uitbrengen en alle
   bijbehorende bron-, notice- en distributieverplichtingen uitvoeren;
2. schriftelijke afzonderlijke toestemming of een andere licentie van Signal
   verkrijgen die het beoogde Pulse-distributiemodel toestaat;
3. een onderhouden provider met een aantoonbaar compatibele licentie selecteren
   en opnieuw op protocolveiligheid en interoperabiliteit beoordelen.

## Vereiste schriftelijke goedkeuring

Voor route 1 of 2 moeten minimaal worden vastgelegd:

- juridische entiteit en rechthebbenden van alle Pulse-broncode;
- gekozen Pulse-licentie en scope van de Corresponding Source;
- plaats en bewaartermijn van broncode, buildinstructies en licentieteksten;
- gevolgen voor Google Play, andere distributiekanalen en backendsoftware;
- verantwoordelijke voor notices, updates en toekomstige libsignal-upgrades;
- ondertekende juridische goedkeuring.

## Werk dat zonder libsignal mag doorgaan

- providerinterfaces en fail-closed adapters;
- Android Keystore-opslag en lifecycle-tests;
- protocolvectors en interoperabiliteitsharnassen met niet-productiedata;
- backend envelope-, device- en prekeycontracten;
- Firestore TTL configureren en controleren.

Productieclaims, `E2EE_V2_ENABLED=true` en `v2_required` blijven geblokkeerd.

De resterende controle voor de gekozen route staat in
`E2EE_OPEN_SOURCE_READINESS.md`.
