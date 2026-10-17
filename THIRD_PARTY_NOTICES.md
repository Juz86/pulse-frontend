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

De exacte Android dependencygraph kan worden gegenereerd met:

```bash
cd android
./gradlew :app:dependencies --configuration releaseRuntimeClasspath
```

Daaronder vallen AndroidX, Kotlin, Capacitor, Firebase, Google Play SDK's,
Socket.IO, OkHttp en de WebRTC-SDK. Hun eigen licenties en gebruiksvoorwaarden
blijven van toepassing.

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
