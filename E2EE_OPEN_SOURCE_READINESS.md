# Pulse Open Source Readiness

Status op 17 oktober 2026: de oorspronkelijke Pulse-code in deze repository is
gelicentieerd als `AGPL-3.0-only`. Publicatie en binaire release blijven
geblokkeerd totdat de resterende distributiecontroles hieronder zijn afgerond.

Dit document is een technische compliance-inventarisatie en geen juridisch
advies.

## Auteursrechten

Een licentie toevoegen is een juridische publicatiehandeling. De huidige
historie bevat twee auteursidentiteiten:

- `yushuaabdulkadir <yushuaabdulkadir@users.noreply.github.com>`;
- `Juz86 <yousef.abdulkadir@gmail.com>`.

De eigenaar heeft bevestigd dat beide identiteiten van hem zijn en toestemming
gegeven om de broncode open source uit te brengen. Deze licentiehandeling geldt
voor deze frontendrepository. Andere Pulse-repositories moeten afzonderlijk een
expliciete licentie krijgen.

## Dependency-inventarisatie

De npm-lockfile is gescand. Het grootste deel gebruikt permissieve licenties,
waaronder MIT, ISC, Apache-2.0 en BSD. Aandachtspunten:

- meerdere DiceBear-stijlen combineren MIT-code met CC-BY-4.0-assets en vragen
  om correcte attributie;
- Sharp/libvips bevat LGPL-3.0-or-later componenten, maar Sharp is momenteel een
  builddependency en geen Android runtime-library;
- enkele transitieve packages missen betrouwbare licentiemetadata in de
  lockfile en moeten tegen hun meegeleverde licentiebestand worden geverifieerd;
- de Android release-runtime bevat onder andere Firebase, Google Play services,
  Play Update, Play Integrity, reCAPTCHA en een WebRTC-SDK;
- voordat de gecombineerde Android-app onder AGPLv3 wordt verspreid, moet worden
  bevestigd dat de voorwaarden van alle meegeleverde binaries daarmee
  verenigbaar zijn.

## Vereiste afronding

1. laat de Android runtime-dependencies op AGPL-compatibiliteit beoordelen;
2. commit en publiceer iedere definitieve releasekandidaat met een
   onveranderlijke versie-tag;
3. voeg een bereikbare versiegebonden broncodelink aan app en distributiepagina
   toe;
4. genereer en controleer volledige versiegebonden third-party notices;
5. publiceer exact de Corresponding Source die bij iedere uitgebrachte AAB
   hoort;
6. geef andere Pulse-repositories afzonderlijk een expliciete licentie;
7. rond de uiteindelijke libsignal- en gecombineerde Android-distributiecontrole
   af.

## Reeds Afgerond

- beide Git-auteursidentiteiten zijn door de eigenaar als dezelfde
  rechthebbende bevestigd;
- frontend en backend zijn anoniem via HTTPS publiek leesbaar; de geverifieerde
  publieke commits zijn respectievelijk `36bf715205dbcc4cddaa7ed44a1126d4e5e72a87`
  en `38665cb986de58717c0d7364bf666e9c29bd5413`;
- beide repositories bevatten de officiële AGPLv3-tekst en gebruiken
  `AGPL-3.0-only` als package-licentie;
- de officiële, ongewijzigde AGPLv3-tekst is als `LICENSE` toegevoegd;
- `package.json` en `package-lock.json` gebruiken `AGPL-3.0-only`;
- DiceBear Adventurer-attributie is vastgelegd in `THIRD_PARTY_NOTICES.md`;
- de Corresponding Source-procedure staat in `SOURCE_DISTRIBUTION.md`;
- `npm run verify:open-source` controleert basale release- en geheimengates.
- libsignal `0.105.1` is vastgepind met SHA-256 dependency verification;
- de Signal Maven-repository is beperkt tot de dependencygroep `org.signal`;
- Android-tests, debugbuild en lint slagen met de vastgepinde artifacts.
- de meet-AAB voor versie `1.0.24` (`versionCode 80`) is succesvol gebouwd en
  meet `136405181` bytes; Bundletool schat voor het geteste Samsung-profiel een
  download van `45818771` bytes. Zie `E2EE_RELEASE_DISTRIBUTION_AUDIT.md`.
- de versiegebonden release-inventaris en fail-closed distributiecontrole staan
  in `security/android-release-notices`; de inventarischeck slaagt en de
  publicatiecheck blijft terecht geblokkeerd op de open reviewpunten.
- de volledige opgeloste Android release-runtime is als 174-componentensnapshot
  vastgelegd, inclusief POM-hashes en overgeërfde licentiebronnen; geen
  component mist technische POM-licentiemetadata.

Tot de resterende distributiecontrole is afgerond blijft de publieke releasegate
op `NO-GO`. De native provider is lokaal gebouwd, maar rapporteert tot de
echte-devicevalidatie `providerAvailable: false` en is niet aan de
productiechatflow gekoppeld.
