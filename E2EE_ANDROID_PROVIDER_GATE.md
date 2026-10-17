# Pulse E2EE Android Provider Gate

Status op 17 oktober 2026: veilige native opslagbasis, libsignal-sessie-engine,
persistente `SignalProtocolStore`-adapter, smalle Capacitor-bridge en geisoleerde
send/receive-orchestrator gebouwd; echte-devicevalidatie en productiekoppeling
staan nog open.

## Gebouwde opslagbasis

De Android-app bevat nu een geisoleerde `PulseE2eeV2` Capacitor-plugin en een
app-private secure store:

- AES-256-GCM via een niet-exporteerbare sleutel in `AndroidKeyStore`;
- unieke IV per record en AAD-binding aan user, recordtype en record-id;
- gehashte SharedPreferences-recordnamen zonder ruwe user/device-id;
- gescheiden recordtypes voor identity, signed prekey, one-time prekey, session
  en device metadata;
- limiet van 1 MiB per serialized record;
- hardware-backed en StrongBox-status worden uit `KeyInfo` gelezen en nooit
  aangenomen;
- E2EE-records zijn uitgesloten van cloudbackup en device-transfer;
- de JavaScript-bridge kan geen private records lezen of schrijven.

De statusplugin rapporteert nog `providerAvailable: false` en
`provider: libsignal_android_pending_device_validation`. Bootstrap, encryptie en
decryptie zijn lokaal beschikbaar en getest, maar worden pas vrijgegeven nadat
de echte-devicegate slaagt. Frontend en backend blijven standaard uitgeschakeld
en de bestaande chatflow gebruikt deze adapter nog niet.

De bridge exporteert uitsluitend publieke registratiedata, ciphertext-envelopes
en na decryptie de tekst die de interface moet tonen. Er bestaat geen
bridgemethode voor private identity keys, private prekeys of sessierecords. Het
numerieke Signal-device-ID wordt versleuteld aan de lokale identity gebonden;
een afwijkend ID na herstart wordt geweigerd.
Remote Signal-adressen worden daarnaast versleuteld aan opaque backend-device-
ID's gekoppeld. Een veranderde of dubbel gebruikte mapping wordt fail-closed
geweigerd.

## Libsignal gate

De gekozen kandidaat is `org.signal:libsignal-client` plus
`org.signal:libsignal-android`. Signal documenteert dat beide packages nodig
zijn voor Android en publiceert ze via de eigen Maven-repository. Beide
artifacts zijn vastgepind op versie `0.105.1`:

- https://github.com/signalapp/libsignal/blob/main/README.md
- https://github.com/signalapp/libsignal/blob/main/java/android/build.gradle

De huidige broncode is `AGPL-3.0-only`. Extern gebruik wordt door Signal niet als
stabiele, ondersteunde publieke API aangeboden. De dependency mag pas in een
publieke Pulse-release nadat alle volgende punten schriftelijk zijn afgevinkt:

1. juridische goedkeuring voor Pulse-broncode, distributie en Google Play;
2. exacte artifactversie en checksums vastpinnen (afgerond voor `0.105.1`);
3. Signal Maven-repository en dependency verification configureren (afgerond);
4. ondersteunde JDK/AGP/NDK-combinatie in CI bewijzen;
5. upgrade- en rollbackprocedure vastleggen;
6. bekende protocolvectors en Android-naar-Android interoperabiliteit laten
   slagen.

Dit document is een technische gate en geen juridisch advies.

De uitgevoerde controle staat in `E2EE_LIBSIGNAL_LICENSE_DECISION.md`. Libsignal
mag in lokale builds worden gebundeld voor implementatie en verificatie. Een
publieke release blijft `NO-GO` totdat de volledige Android-dependency- en
distributiecontrole is afgerond.

## Teststatus

Geslaagd:

- 129 Android JVM-tests, waaronder vijf record-key tests en expliciete
  remote-device-mappingconflicten;
- Java- en Kotlin-debugcompilatie;
- drie Android Keystore-instrumentatietests geslaagd op een fysieke Samsung
  SM-A266B met Android 16/API 36 en beveiligingspatch 2026-08-05;
- versleutelde write/read/remove, scheiding van private records en herstel van
  dezelfde libsignal-identity uit Android Keystore-opslag fysiek bewezen;
- Keystore-capability op dit toestel: secure storage en hardware-backed zijn
  beschikbaar; StrongBox is niet beschikbaar;
- dezelfde publieke identity en registration-ID zijn na een volledige
  toestelreboot uit de versleutelde store hersteld;
- alle persistente libsignal-recordtypen zijn expliciet fail-closed toegestaan
  en met een regressietest afgedekt;
- debug-APK-build met libsignal `0.105.1` voor vier Android-ABI's;
- strikte Gradle SHA-256 dependency verification;
- echte Android-naar-Android libsignal-roundtrip: prekeybericht heen en regulier
  Double Ratchet-sessiebericht terug;
- heropening na een gesimuleerde apprestart met behoud van identity,
  registration-id, prekeys en ratchet-sessies;
- providerbootstrap vult one-time prekeys aan zonder lokale identity te roteren;
- eerste tekstbericht via de bridgeprovider gebruikt een prekey-envelope en het
  ratchet-antwoord blijft na een gesimuleerde providerrestart decryptable;
- een remote identity-rotatie wist de oude sessie en trusted identity, bouwt
  een nieuwe prekey-sessie en weigert daarna stale versies en revocation;
- JavaScript-adapter weigert fail-closed buiten de native Android-runtime;
- atomaire, versleutelde opslag van lokale identity plus registration-id;
- de geisoleerde testvariant kan naast de Play Store-app worden geinstalleerd
  via `-PpulseE2eeInstrumentedTest=true`, zonder productie-Firebaseconfiguratie
  of appdata te wijzigen;
- Android Lint zonder fouten.

De universele debug-APK is door de vier native ABI-varianten circa 559 MB. Voor
een distributiebesluit moeten de release-AAB, de per-device Play-split en de
downloadgrootte afzonderlijk worden gemeten.

Nog op een fysiek device of emulator uitvoeren:

- capabilityrapportage op een tweede hardwareprofiel en indien beschikbaar een
  StrongBox-toestel;
- gedrag tijdens schermvergrendeling en na een OS-update;
- bevestigen dat backup/restore geen encrypted records terugplaatst.

Herhaalbare fysieke opslagtest:

```bash
cd android
./gradlew :app:connectedDebugAndroidTest \
  -PpulseE2eeInstrumentedTest=true --console=plain
```

De Gradle-taak weigert bewust zonder deze property te starten. Daarmee kan de
testtooling nooit de anders ondertekende Play Store-package als testtarget
gebruiken.

De tweefasige reboottest wordt bewust handmatig uitgevoerd: eerst
`preparePersistentIdentityBeforeDeviceRestart`, daarna een volledige
toestelreboot en vervolgens `restoresPersistentIdentityAfterDeviceRestart`.
Alleen de publieke identity en registration-ID worden buiten de secure store als
verwachte testwaarden bewaard; private identitymaterialen verlaten de Keystore
niet.

Nog vereist voordat de provider aan de chatruntime gekoppeld mag worden:

- lifecycle-, lockscreen- en restarttests op twee echte Android-apparaten;
- de bestaande, standaard uitgeschakelde clientorchestrator aansluiten op een
  interne chatflow nadat de echte-devicegate slaagt;
- de voorbereide socketcoordinator uitsluitend in die interne proef activeren;
- multi-device synchronisatie en lifecycle-UX op twee echte apparaten bewijzen.
