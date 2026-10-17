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
2. maak de repository daadwerkelijk openbaar;
3. voeg een bereikbare broncodelink aan app en distributiepagina toe;
4. genereer en controleer volledige versiegebonden third-party notices;
5. publiceer exact de Corresponding Source die bij iedere uitgebrachte AAB
   hoort;
6. geef andere Pulse-repositories afzonderlijk een expliciete licentie;
7. meet de release-AAB en controleer de uiteindelijke libsignal-distributie.

## Reeds Afgerond

- beide Git-auteursidentiteiten zijn door de eigenaar als dezelfde
  rechthebbende bevestigd;
- de officiële, ongewijzigde AGPLv3-tekst is als `LICENSE` toegevoegd;
- `package.json` en `package-lock.json` gebruiken `AGPL-3.0-only`;
- DiceBear Adventurer-attributie is vastgelegd in `THIRD_PARTY_NOTICES.md`;
- de Corresponding Source-procedure staat in `SOURCE_DISTRIBUTION.md`;
- `npm run verify:open-source` controleert basale release- en geheimengates.
- libsignal `0.105.1` is vastgepind met SHA-256 dependency verification;
- de Signal Maven-repository is beperkt tot de dependencygroep `org.signal`;
- Android-tests, debugbuild en lint slagen met de vastgepinde artifacts.

Tot de resterende distributiecontrole is afgerond blijft de publieke releasegate
op `NO-GO`. De native provider is lokaal gebouwd, maar rapporteert tot de
echte-devicevalidatie `providerAvailable: false` en is niet aan de
productiechatflow gekoppeld.
