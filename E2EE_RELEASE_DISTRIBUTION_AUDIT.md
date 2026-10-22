# Pulse E2EE Release- en Distributie-audit

Status op 22 oktober 2026: de release-AAB en een apparaatgerichte
Play-download zijn gemeten. Dit is technisch releasebewijs, geen toestemming
voor publicatie en geen vervanging voor de onafhankelijke securityreview of de
resterende licentiecontrole.

## Buildsubject

- frontendcommit: `a8ec4956e28c464ce5b0058cd0bbbe4848e494c9`;
- package: `com.pulsemessenger.chat`;
- versie: `1.0.24`;
- versionCode: `80`;
- minSdk: `24`;
- targetSdk: `36`;
- JDK: `17.0.20.1`;
- Gradle: `9.4.1`;
- Bundletool: `1.18.3`;
- Bundletool SHA-256:
  `a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29`.

De build is uitgevoerd met:

```bash
cd android
GRADLE_USER_HOME=../.gradle-android ./gradlew :app:bundleRelease --console=plain
```

De taak bouwde de productie-webapp opnieuw, controleerde de productie-API,
draaide Android Lint Vital, valideerde signing en eindigde met
`BUILD SUCCESSFUL`.

Een releasebuild vanaf de publieke frontendcommit
`a8ec4956e28c464ce5b0058cd0bbbe4848e494c9` leverde de hieronder vastgelegde
AAB op, inclusief de versiegebonden WebRTC-assets en Android-licentiebundel.

## Bundlemeting

- bestand: `android/app/build/outputs/bundle/release/app-release.aab`;
- AAB-grootte: `136790418` bytes (`130.5 MiB`);
- AAB SHA-256:
  `650b2b86eee05faf691d2bdf80dcbff489900e87be97d538ba20423e17dba676`;
- ondertekening: aanwezig; `jarsigner -verify` meldt `jar verified`, maar de
  strikte controle eindigt met exitcode `4`;
- certificaatvervaldatum: `2051-04-22`;
- ongecomprimeerde native libraries in de AAB: `519769544` bytes;
- ongecomprimeerde Android-assets in de AAB: `8063443` bytes.

Ter vergelijking is de bewaarde `pulse-versionCode-71.aab` `37321570` bytes.
De huidige meet-AAB is daarmee `99468848` bytes (`94.9 MiB`) groter, oftewel
`3.67x` de oude bundlegrootte. Omdat tussen versionCode 71 en 80 ook andere
functionaliteit is toegevoegd, mag dit verschil niet volledig aan E2EE of
libsignal worden toegeschreven. De native libraries zijn wel de grootste
zichtbare ongecomprimeerde categorie en verdienen vóór een brede uitrol een
aparte ABI- en stripanalyse.

De strikte signingcontrole meldt een zelfondertekende certificaatketen, geen
timestamp en interne JarFile/JarInputStream-waarschuwingen. Een zelfondertekend
Play-uploadcertificaat kan verwacht zijn, maar de gebruikte uploadkey en deze
waarschuwingen moeten vóór upload tegen de Play Console-configuratie worden
geverifieerd. Deze meetbuild krijgt daarom geen definitief signing-`GO`.

De bewaarde versionCode-71-AAB geeft dezelfde strikte exitcode en dezelfde
waarschuwingscategorieën. Beide bundles gebruiken bovendien exact dezelfde
publieke certificaatfingerprint:

`70:24:15:2E:B1:99:D7:B3:59:F3:8F:A3:85:07:84:14:32:C2:74:7D:AD:88:DC:F0:35:B3:12:44:43:A8:88:52`

Daarmee is lokale signingcontinuïteit bewezen. Alleen de vergelijking met de
uploadcertificaatfingerprint in Play Console blijft extern open.

Gradle kon `libandroidx.graphics.path.so`, `libdatastore_shared_counter.so`,
`libjingle_peerconnection_so.so` en `libsignal_jni.so` niet strippen. Dit
blokkeert de meetbuild niet, maar blijft een concrete optimalisatie- en
symbolencontrole voor een publiceerbare release.

## Apparaatgerichte Play-meting

Bundletool heeft splits berekend voor een aangesloten Samsung `SM-A166B` met:

- Android SDK `36`;
- primaire ABI `arm64-v8a`;
- schermdichtheid `450`;
- locale `nl-NL`.

Resultaat van `bundletool get-size total`:

- minimale download: `46187385` bytes;
- maximale download: `46187385` bytes;
- afgerond: `44.0 MiB`.

Dit is een echte apparaatgerichte schatting, geen universele APK-grootte.
Andere apparaten, ABI's, talen en toekomstige Play-compressie kunnen een ander
resultaat geven.

## Distributiecontroles

Geslaagd:

- `npm run verify:open-source` controleerde 426 tracked bestanden;
- de release-runtime dependencygraph is succesvol opgelost met
  `:app:dependencies --configuration releaseRuntimeClasspath`;
- libsignal is vastgepind op `0.105.1`;
- het AAB-manifest bevat de verwachte package-, versie- en SDK-waarden;
- de productie-API-controle in Gradle slaagt.
- `PULSE_E2EE_QA_ENABLED` is in de release-BuildConfig `false`.
- de machineleesbare versie-inventaris in
  `security/android-release-notices/release-1.0.24-v80.json` komt overeen met
  de huidige npm- en Android-pins;
- `npm run generate:android-release-notices` heeft 174 van 174 opgeloste
  release-runtimecomponenten vastgelegd; alle artifact-POM's zijn beschikbaar
  en ieder component heeft directe of overgeërfde licentiemetadata;
- de volledige snapshot staat in
  `security/android-release-notices/release-1.0.24-v80-resolved-components.json`
  met SHA-256
  `67aa84e3dafa99dba18dc012a00ad5cc5a0ad39e21a9b39d3d74638a4c092040`;
- de leesbare catalogus met 174 notice-regels staat naast de JSON-snapshot en
  heeft SHA-256
  `2737ac416f91d4ab873c3703da64e7320692b294df6dbde07adfe05271bf6cff`;
- `npm run verify:android-release-notices` slaagt;
- de publieke Android-licentiebundel bevat tien gehashte bestanden voor de 174
  componenten, waaronder alle negen in runtime-artifacts aangetroffen
  licentie-exemplaren teruggebracht tot hun relevante versiegebonden teksten;
- alle tien licentiebundelbestanden zijn uit de release-AAB gelezen en hun
  hashes komen overeen met het versiegebonden bundelmanifest;
- de technische Data Safety-conceptmatrix is aan het releasebewijs gebonden;
  Play Console-bevestiging blijft een expliciete blocker;
- `npm run verify:android-release-distribution` faalt bewust zolang de status
  `blocked` is of een blocker resteert.

Anonieme `git ls-remote`-controles bevestigden op de auditdatum publieke toegang
tot `https://github.com/Juz86/pulse-frontend` op commit
`f18561af91bd76ec1c1d643d833bc19fae93f65c` en tot
`https://github.com/Juz86/pulse-backend` op commit
`38665cb986de58717c0d7364bf666e9c29bd5413`. Beide repositories bevatten de
officiële AGPLv3-tekst en gebruiken `AGPL-3.0-only` als package-licentie.

### Voorlopige licentieclassificatie

De daadwerkelijk opgeloste release-runtime bevat onder andere onderstaande
families. Dit is een technische classificatie op basis van de officiële
projectlicenties en geen juridisch oordeel over de gecombineerde app:

| Componentfamilie | Opgeloste versie | Vastgestelde basis | Status |
| --- | --- | --- | --- |
| Signal libsignal | `0.105.1` | AGPLv3 | notice en Corresponding Source verplicht; gecombineerde distributie nog beoordelen |
| Capacitor Android | lockfile/build | MIT | licentietekst opnemen |
| Firebase Android SDK | BoM `34.17.0` | Apache-2.0 repositorylicentie | meegeleverde artifacts en Google-servicevoorwaarden nog afzonderlijk controleren |
| Socket.IO Java | `2.1.2` | MIT | licentietekst opnemen |
| Apache Cordova Android | `10.1.1` | Apache-2.0 | LICENSE/NOTICE opnemen |
| WebRTC SDK Android | `144.7559.15` | MIT-wrapper; BSD-3-Clause libwebrtc plus third-party notices | exacte release-AAR en licentielagen geverifieerd; notices als gehashte app-assets opgenomen |
| AndroidX en Kotlin | meerdere vastgepinde versies | POM-inventaris: Apache-2.0 | alle opgeloste versies en licentiebronnen vastgelegd; tekst-/NOTICE-verpakking nog controleren |
| Google Play, Integrity en reCAPTCHA | meerdere versies | aanvullende Google SDK/servicevoorwaarden | technische controle voltooid; formele aanvaarding en Data Safety-controle vereist |

Geraadpleegde primaire bronnen:

- `https://github.com/signalapp/libsignal`;
- `https://github.com/ionic-team/capacitor/blob/main/core/LICENSE`;
- `https://github.com/firebase/firebase-android-sdk/blob/main/LICENSE`;
- `https://github.com/socketio/socket.io-client-java`;
- `https://github.com/apache/cordova-android/blob/master/LICENSE`;
- `https://github.com/webrtc-sdk/android/blob/main/LICENSE`;
- `https://github.com/webrtc-sdk/android/releases/tag/v144.7559.15`;
- `https://github.com/webrtc-sdk/android/blob/v144.7559.15/Licenses/WEBRTC.md`;
- `https://developer.android.com/guide/playcore/license`;
- `https://developer.android.com/google/play/integrity/terms`;
- `https://developers.google.com/terms`;
- `https://firebase.google.com/terms`;
- `https://developer.android.com/studio/terms`.

De exacte WebRTC-AAR in de Gradle-cache is bytegelijk aan het officiële
releaseartifact: beide hebben SHA-256
`fc7c8d027eb33860ccbb7847988f7f942d44a92d1f575348bba6c0250cde4071`.
De getagde wrapper is MIT-gelicentieerd; de POM beschrijft de gebundelde
libwebrtc-laag terecht als BSD-3-Clause. De tag bevat daarnaast een samengestelde
notice met 30 componentsecties. Het eerdere vermoeden van een licentieconflict
is daarmee vervallen. Omdat de AAR die teksten niet zelf bevat, zijn de exacte
MIT-wrappertekst en volledige samengestelde notice als versiegebonden publieke
app-assets opgenomen. De releaseverificatie bewaakt hun hashes en de 30
componentsecties. De nieuwe AAB bevat beide bestanden onder
`base/assets/public/legal/third-party/webrtc-sdk-android-144.7559.15/`; hun
uit de AAB gelezen hashes zijn gelijk aan de vastgelegde bronhashes.

De Google-controle stelde vast dat Play Core ongewijzigde Redistributable Code
als onderdeel van de API-client laat distribueren. De overige gesloten SDK's
blijven onder de Android SDK- en toepasselijke servicevoorwaarden. Play
Integrity verbiedt fingerprinting/tracking en vereist een juiste Data
Safety-beoordeling. Een bevoegde eigenaar of reviewer moet de voorwaarden nog
formeel aanvaarden; dit technische onderzoek doet dat niet namens die partij.
De volledige onderbouwing staat in `ANDROID_THIRD_PARTY_TERMS_REVIEW.md`.

Nog vereist voor publicatie:

1. laat een bevoegde reviewer de vastgelegde Android runtime-inventaris en
   Google-voorwaarden formeel accepteren voor de gekozen distributie;
2. controleer en verpak de vereiste volledige licentieteksten en eventuele
   NOTICE-bestanden op basis van de versiegebonden componentensnapshot;
3. commit en publiceer de huidige releasekandidaat en maak daarvan een exacte
   Corresponding Source-tag;
4. voeg een bereikbare versiegebonden broncodelink toe aan de app en
   distributiepagina;
5. leg het onafhankelijke securityreviewbewijs vast;
6. leg vast of het aparte native web-updatekanaal uit blijft of herbouw met de
   bestaande, gecontroleerde `PULSE_NATIVE_UPDATE_PUBLIC_KEY`;
7. verifieer uploadcertificaat en signingwaarschuwingen tegen Play Console;
8. herhaal hashes en Bundletool-metingen op exact die definitieve commit.

## Belangrijke Begrenzing

Tijdens deze lokale meting was `PULSE_NATIVE_UPDATE_PUBLIC_KEY` niet gezet.
Ook de bewaarde versionCode-71-AAB bevat een lege waarde. In de runtime
betekent dit dat het aparte ondertekende native web-updatekanaal uitstaat;
Google Play-updates blijven daarvan onafhankelijk. Dit is dus geen zelfstandige
Play-blokkade, maar moet vóór iedere release bewust worden bevestigd. Deze AAB
blijft een meetbuild en geen E2EE-productiekandidaat, omdat review-, notice- en
pilotgates nog openstaan. Productie-E2EE en de productiepilot blijven
uitgeschakeld.
