# Android Third-Party Terms Review

Status op 22 oktober 2026: technische controle voltooid; formele juridische
aanvaarding en de definitieve noticeverpakking blijven releasepoorten.

Dit document koppelt de daadwerkelijk opgeloste Android-runtimecomponenten van
Pulse `1.0.24` (`versionCode 80`) aan hun primaire licentie- en
servicevoorwaarden. Het is technisch releasebewijs en geen juridisch advies.

## WebRTC SDK Android

Pulse gebruikt `io.github.webrtc-sdk:android:144.7559.15`.

De exacte bron- en artifactcontrole gaf het volgende resultaat:

- wrappertag: `v144.7559.15`;
- wrappercommit: `0c62f604c97087664e412ec04e0ec79721a263b1`;
- upstream WebRTC-commit volgens de release: `30d5e63`;
- AAR SHA-256, zowel uit Maven-cache als van het officiële releaseartifact:
  `fc7c8d027eb33860ccbb7847988f7f942d44a92d1f575348bba6c0250cde4071`;
- wrapperlicentie: MIT, SHA-256
  `e6b282fe6c0fb353928923470457f31b44cbab203effd60c0cde4a5bb96c8aec`;
- samengestelde WebRTC-notice: 30 componentsecties, SHA-256
  `d1f9382c6878ac024155fd6d44a5977329108bb8b0a01cea40e4a2f1d7de252e`;
- de artifact-POM noemt BSD-3-Clause voor het gebundelde libwebrtc;
- de AAR bevat zelf geen `LICENSE`- of `NOTICE`-bestand.

De MIT-vermelding en BSD-3-Clause-vermelding zijn dus geen tegenstrijdige
licenties voor hetzelfde werk. MIT geldt voor de Android-wrapper en
publicatiecode; BSD-3-Clause en de overige vermeldingen in `Licenses/WEBRTC.md`
gelden voor libwebrtc en de erin opgenomen componenten.

Pulse levert daarom zowel de MIT-wrappertekst als de volledige, ongewijzigde
`Licenses/WEBRTC.md` van deze tag als versiegebonden publieke app-assets. De
releaseverificatie bewaakt beide hashes en het aantal componentsecties. Een
nieuwe AAB moet nog aantonen dat deze assets ook in de definitieve binary zitten.

Primaire bronnen:

- https://github.com/webrtc-sdk/android/releases/tag/v144.7559.15
- https://github.com/webrtc-sdk/android/tree/v144.7559.15
- https://github.com/webrtc-sdk/android/blob/v144.7559.15/LICENSE
- https://github.com/webrtc-sdk/android/blob/v144.7559.15/Licenses/WEBRTC.md
- https://github.com/webrtc-sdk/webrtc

## Google SDK's

De versiegebonden componentensnapshot bevat drie soorten Google-voorwaarden.

| Componentgroep | Opgeloste componenten | Primaire voorwaarden | Technische uitkomst |
| --- | --- | --- | --- |
| Google Play services en gesloten Firebase Auth-onderdelen | `play-services-*`, `googleid`, `firebase-auth`, auth/iid-interop en measurement-connector | Android SDK License Agreement | Gebruik voor compatibele Android-apps is toegestaan na aanvaarding; gesloten SDK-onderdelen blijven onder Googles voorwaarden en worden niet als Pulse-AGPL-bron aangeboden. |
| Play Core | `app-update`, `app-update-ktx`, `core-common` | Play Core SDK Terms plus Google APIs Terms | De voorwaarden staan distributie van ongewijzigde Redistributable Code als onderdeel van de API-client toe. Pulse wijzigt deze binaries niet. |
| Play Integrity | `integrity:1.3.0` | Play Integrity API Terms plus Google APIs Terms | Gebruik is beperkt tot integriteits- en fraudebescherming; fingerprinting of tracking is verboden. De Data Safety-opgave moet de beschreven verwerking meenemen. |
| reCAPTCHA | `recaptcha:18.6.1` | Android SDK- en toepasselijke Google API/Cloud-servicevoorwaarden | Alleen gebruiken voor de geïntegreerde Firebase-authenticatieflow; privacy-, account- en servicevoorwaarden blijven van toepassing. |
| Open Firebase- en transportcomponenten | componenten waarvan de POM Apache-2.0 vermeldt | Apache-2.0 plus toepasselijke Firebase-servicevoorwaarden | Open broncode blijft onder Apache-2.0; het gebruik van Firebase-diensten vereist daarnaast aanvaarding van de toepasselijke serviceterms. |

De technische controle vond geen voorwaarde die op zichzelf vereist dat de
gesloten Google-binaries onder AGPL worden hergelicentieerd. Pulse moet deze
onderdelen duidelijk als afzonderlijke third-party binaries onder hun eigen
voorwaarden behandelen. Dat is geen zelfstandig juridisch compatibiliteitsoordeel:
de eigenaar of een bevoegde reviewer moet de toepasselijke voorwaarden formeel
aanvaarden en de privacy- en Data Safety-vermeldingen controleren.

Primaire bronnen:

- https://developer.android.com/studio/terms
- https://developer.android.com/guide/playcore/license
- https://developer.android.com/google/play/integrity/terms
- https://developers.google.com/terms
- https://developers.google.com/mobile/terms
- https://firebase.google.com/terms

## Releasebesluit

Technisch voltooid:

- exacte WebRTC-tag, broncommit en artifacthash vastgesteld;
- Maven-AAR bytegelijk aan het officiële GitHub-releaseartifact;
- MIT-wrapper en BSD/third-party licentielagen uit elkaar gehouden;
- alle Google-runtimecomponenten aan de toepasselijke voorwaardencategorie
  gekoppeld;
- Play Integrity privacy- en Data Safety-verplichting vastgelegd.

Nog vereist:

- nieuwe release-AAB bouwen en controleren dat de versiegebonden WebRTC-assets
  in de definitieve binary zitten;
- volledige Android noticecatalogus op leesbaarheid en volledigheid beoordelen;
- formele aanvaarding van de Google SDK- en servicevoorwaarden vastleggen;
- Play Console Data Safety-invoer tegen het daadwerkelijke runtimegebruik
  controleren;
- onafhankelijk securityreviewbewijs en Play-uploadcertificaatvergelijking
  afronden.
