# Pulse Source Distribution

De oorspronkelijke code in deze repository valt onder `AGPL-3.0-only`. Dit
document beschrijft hoe de Corresponding Source bij een uitgegeven Pulse-build
wordt vastgelegd.

De publieke bronlocatie is:

`https://github.com/Juz86/pulse-frontend`

Op 22 oktober 2026 is anonieme HTTPS-leestoegang geverifieerd. De publieke
`HEAD` was toen commit `f18561af91bd76ec1c1d643d833bc19fae93f65c`. De
backend is eveneens publiek bereikbaar op
`https://github.com/Juz86/pulse-backend`, met publieke `HEAD`
`38665cb986de58717c0d7364bf666e9c29bd5413`.

Publieke zichtbaarheid alleen is niet voldoende: iedere uitgegeven binary moet
blijven verwijzen naar zijn exacte, openbare releasecommit of tag. Frontend en
backend bevatten beide de officiële AGPLv3-tekst en gebruiken
`AGPL-3.0-only` als package-licentie.

## Per Release

Voor iedere web- of Android-release:

1. commit alle broncode en buildconfiguratie die voor de release is gebruikt;
2. maak een onveranderlijke Git-tag die overeenkomt met de appversie en Android
   `versionCode`;
3. publiceer de tag in de openbare Pulse-repository;
4. publiceer de broncode tegelijk met of eerder dan de binaire release;
5. vermeld in de app en distributiepagina waar de bijbehorende broncode staat;
6. voeg de geldende `LICENSE` en volledige third-party notices toe;
7. bewaar geen signing keys, tokens, wachtwoorden of andere geheimen in de
   gepubliceerde broncode.

Voer vóór publicatie ook uit:

```bash
npm run verify:open-source
npm run generate:android-release-notices
npm run verify:android-release-distribution
```

Deze controle bewaakt de projectlicentie, vereiste distributiedocumenten,
verboden sleutelbestanden en bekende private-keypatronen. Het is een technische
vangrail en vervangt geen handmatige of juridische dependencycontrole.
De noticegenerator legt de daadwerkelijk opgeloste Android release-runtime en
de hashes van de gebruikte POM-metadata vast. De distributiecontrole blijft
fail-closed zolang review-, notice-, bronpublicatie- of signingblokkades bestaan.

## Reproduceerbare Buildinformatie

De releasebron moet minimaal bevatten:

- `package.json` en `package-lock.json`;
- Gradle wrapper, Android buildbestanden en dependencyversies;
- broncode en assets die in de bundle terechtkomen;
- niet-geheime voorbeeldconfiguratie;
- buildcommando's en vereiste Node-, JDK-, SDK- en NDK-versies;
- patches of wijzigingen aan third-party componenten.

De huidige hoofdcommando's zijn:

```bash
npm ci
npm run build:webapp:android
npm run android:sync
cd android
./gradlew bundleRelease
```

De release is niet compliance-gereed zolang de exacte releasecommit en -tag
niet publiek zijn, de broncodelocatie niet vanuit product/distributie wordt
aangeboden of de third-party controle niet is afgerond.
