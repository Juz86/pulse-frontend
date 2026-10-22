# Pulse Third-Party Notices

Pulse bevat software en assets van derden. Deze onderdelen blijven onder hun
eigen licentie beschikbaar en worden niet opnieuw gelicentieerd onder de
Pulse-licentie.

## DiceBear Adventurer

Pulse gebruikt de `adventurer`-avatarstijl uit DiceBear.

- ontwerp: Adventurer
- ontwerper: Lisa Wischofsky
- bron: https://www.figma.com/community/file/1184595184137881796
- designlicentie: Creative Commons Attribution 4.0
- code: Copyright (c) 2024 Florian Korner, MIT License
- project: https://www.dicebear.com/

## JavaScript Dependencies

De exacte dependencyversies staan in `package-lock.json`. De meegeleverde
licentieteksten zijn na installatie beschikbaar in de betreffende directories
onder `node_modules`. De directe dependencies omvatten onder andere React,
Capacitor, Firebase, Sentry, Lucide, React Icons en Socket.IO.

`sharp` en de bijbehorende libvips-pakketten worden uitsluitend tijdens het
buildproces gebruikt. Hun eigen Apache-, MIT- en LGPL-voorwaarden blijven van
toepassing.

## Android Dependencies

De exacte Android dependencygraph en versiegebonden POM-licentiemetadata kunnen
worden gegenereerd met:

```bash
npm run generate:android-release-notices
```

Daaronder vallen AndroidX, Kotlin, Capacitor, Firebase, Google Play SDK's,
Socket.IO, OkHttp en de WebRTC-SDK. Hun eigen licenties en gebruiksvoorwaarden
blijven van toepassing.

Voor de op 22 oktober 2026 gemeten `1.0.24`-AAB zijn onder meer deze directe
runtimeversies opgelost:

- Capacitor Android volgens de vastgepinde npm-lockfile, MIT;
- Firebase BoM `34.17.0`, Firebase Auth `24.2.0` en Messaging `25.1.1`;
- Google Play App Update `2.1.0`, Integrity `1.3.0` en reCAPTCHA `18.6.1`;
- Socket.IO Java `2.1.2`, MIT;
- Apache Cordova Android `10.1.1`, Apache-2.0;
- WebRTC SDK Android `144.7559.15`; MIT geldt voor de wrapper en
  BSD-3-Clause plus de getagde samengestelde notice voor libwebrtc en zijn
  ingebedde componenten; de exacte AAR bevat zelf geen LICENSE/NOTICE;
- Signal libsignal `0.105.1`, AGPLv3.

De gegenereerde snapshot bevat alle 174 opgeloste release-runtimecomponenten.
Voor ieder component zijn versie, artifact-POM-hash, eventueel overgeërfde
licentiebron, licentiebron-POM-hash en licentiemetadata vastgelegd; geen POM of
licentievermelding ontbreekt. Daarmee is de technische AndroidX/Kotlin-
inventaris compleet. Dit is nog geen juridisch akkoord en bevat niet vanzelf
alle teksten of notices uit gebundelde native binaries. Met name de formele
aanvaarding van de Google SDK/servicevoorwaarden en de in de WebRTC-AAR
gebundelde libwebrtc- en third-party notices moeten vóór publicatie worden
afgerond. De WebRTC-teksten zijn inmiddels als versiegebonden publieke
app-assets opgenomen; een definitieve rebuild en controle blijven nodig. De
technische voorwaardencontrole staat in
`ANDROID_THIRD_PARTY_TERMS_REVIEW.md`; zie ook
`E2EE_RELEASE_DISTRIBUTION_AUDIT.md`.

De machineleesbare versie-inventaris staat in
`security/android-release-notices/release-1.0.24-v80.json`. Controleer de pins
met `npm run verify:android-release-notices`; de strengere
`npm run verify:android-release-distribution` moet vóór publicatie slagen.
De volledige opgeloste graph staat in
`security/android-release-notices/release-1.0.24-v80-resolved-components.json`.
De bijbehorende leesbare catalogus staat in
`security/android-release-notices/release-1.0.24-v80-resolved-components.md`.

### Signal libsignal

De Android-build pint `org.signal:libsignal-client` en
`org.signal:libsignal-android` op versie `0.105.1`.

- copyright: Signal Messenger, LLC
- licentie: GNU Affero General Public License v3.0
- broncode: https://github.com/signalapp/libsignal
- artifacts: https://build-artifacts.signal.org/libraries/maven/

De provider blijft fail-closed totdat de integratie- en interoperabiliteitstests
slagen. Signal vermeldt dat extern gebruik niet officieel wordt ondersteund.

## Releasegate

Voor iedere publieke Android-release moet een versiegebonden, volledige
third-party-notice worden gegenereerd en gecontroleerd. Een dependency zonder
vastgestelde licentie of met een incompatibele voorwaarde blokkeert de release.
