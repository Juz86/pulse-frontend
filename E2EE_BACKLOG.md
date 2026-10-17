# Pulse E2EE Backlog

Deze backlog zet de volgende E2EE-stappen in een praktische uitvoervolgorde.

## Nu Eerst

Deze items zijn nu de eerstvolgende noodzakelijke bouwstappen voor echte E2EE.

- test de native provider en orchestrator op twee echte Android-apparaten
- activeer de geteste socketcoordinator uitsluitend in de interne v2-proef en
  valideer de herstel-/registratie-UX
- meet de release-AAB en per-device Play-downloadgrootte
- configureer Firestore TTL voor tijdelijke `e2eePreKeyClaims`
- rond de resterende open-sourcereleasecontroles af
- houd productieflags op `mock + socket` totdat alle gates slagen

## Afgerond In Stap 3

- `pulse_e2ee_v2`-constanten en strikte schemas vastgelegd
- contractvalidatie toegevoegd voor device-registratie, key-bundle claim,
  message-send en device-specifieke delivery
- 49 positieve en negatieve frontendcontracttests toegevoegd
- backend device registratie, rotatie, refill en intrekken toegevoegd
- identity-change/security events toegevoegd
- policygebonden, transactionele en retry-veilige prekey-claim toegevoegd
- sibling-device prekey-claim voor synchronisatie met eigen overige devices
- per-device message-opslag en exacte active-device fan-out toegevoegd
- ciphertext per opaque device-envelope van berichtmetadata gescheiden
- geverifieerde device-room binding en inhoudsloos realtime-event toegevoegd
- eigen-envelope-fetch en idempotente send-retries toegevoegd
- 48 gerichte v2-backendtests en 185 backendtests in totaal geslaagd
- downgradeblokkade voor legacy service- en socket-send bij `v2_required`
- Android Keystore secure store, backupuitsluiting en fail-closed pluginbasis
- 129 Android JVM-tests en drie instrumentatietests op een fysieke Android
  16-Samsung geslaagd
- hardware-backed Keystore en identityherstel na volledige toestelreboot op het
  fysieke testdevice bevestigd
- persistente libsignal-recordtypen gelijkgetrokken met de fail-closed
  secure-store-allowlist
- geisoleerde E2EE-testvariant toegevoegd die de Play Store-app niet vervangt
- libsignal Android-artifacts vastgepind op `0.105.1`
- numerieke Signal-device-ID en ondertekende Kyber-prekey in frontend- en
  backendcontract verplicht gemaakt
- Signal-repository beperkt en SHA-256 dependency verification vastgelegd
- Android-tests, testcompilatie, debugbuild en lint met libsignal geslaagd
- native libsignal prekey- en Double Ratchet-roundtrip tussen twee devices
  geslaagd
- persistente `SignalProtocolStore` met atomaire identity-opslag en
  restartbestendige prekey- en sessierecords gebouwd
- opaque backend-device-ID's persistent en versleuteld aan Signal-device-ID's
  gekoppeld, met conflict- en hergebruikdetectie
- fail-closed send/receive-orchestrator gebouwd die bestaande sessies
  hergebruikt en alleen bij ontbrekende of gewijzigde devices prekeys claimt
- backend delivery uitgebreid met het geverifieerde Signal-device-ID van de
  afzender en device-ID-uniqueness per account
- identity-versies persistent aan remote devices en delivery-envelopes gebonden
- oude ratchetsessies en trusted identities bij een hogere identity-versie
  verwijderd, waarna een nieuwe prekey-sessie wordt opgebouwd
- remote en lokale device-revoke fail-closed afgehandeld achter de providergate
- seriele socketcoordinator met deduplicatie en retry voor lifecycle- en
  message-available-events toegevoegd
- Socket.IO-authenticatie kan fail-closed aan het opaque v2-device worden
  gebonden en reconnect gecontroleerd bij een gewijzigde binding
- 216 frontendtests geslaagd
- runtime, featureflags en productieflow ongewijzigd gelaten

## Daarna

Deze items volgen na bewezen Android-naar-Android v2-interoperabiliteit.

- selecteer en bewijs een onderhouden browserprovider
- valideer multi-device fan-out en eigen-device synchronisatie
- bouw veiligheidsnummers en identity-change UX
- voer een beperkte interne `v2_pending` pilot uit
- laat een onafhankelijke beveiligingsreview uitvoeren
- operationaliseer rolloutmonitoring en rollback zonder plaintextfallback

## Later

Deze items horen niet bij de eerste activatie, maar wel bij een volwassen E2EE-model.

- groepsencryptie ontwerpen
- encrypted edit-model ontwerpen
- cryptografische identity-binding voor WebRTC-oproepen ontwerpen
- chatbijlagen alleen na een afzonderlijk encrypted-media-ontwerp overwegen

## Niet In Fase 1 Proberen Op Te Lossen

Deze onderwerpen zijn belangrijk, maar maken de eerste rollout onnodig groot als je ze te vroeg oppakt.

- volledige group E2EE
- encrypted edit support
- productbrede claimaanpassingen zonder backendvalidatie

## Aanbevolen Werkvolgorde

1. ~~Native sessie-engine en persistente store via de smalle Capacitor-bridge
   aansluiten zonder private key- of sessie-export.~~ Afgerond.
2. ~~Strikte v2-netwerkclient en fail-closed Android-device-registratie
   bouwen.~~ Afgerond.
3. ~~Native sessies aan opaque backend-device-ID's koppelen en de
   send/receive-orchestrator bouwen zonder herhaald prekeys te claimen.~~
   Afgerond, nog niet aan de productiechatflow gekoppeld.
4. Android-interoperabiliteit, activatie van de voorbereide socketcoordinator
   en multi-device tests op twee echte apparaten.
5. Releasegrootte en resterende distributievoorwaarden controleren.
6. Firestore TTL configureren en werkelijk verwijderen verifiëren.
7. Interne `v2_pending` pilot.
8. Browser-provider-gate.
9. Onafhankelijke review.
10. Pas daarna geselecteerde gesprekken naar `v2_required`.

## Lees Verder

- [E2EE_BACKEND_HANDOFF_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKEND_HANDOFF_CHECKLIST.md)
- [E2EE_ACTIVATION_RUNBOOK.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_ACTIVATION_RUNBOOK.md)
- [E2EE_MANUAL_QA_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_MANUAL_QA_CHECKLIST.md)
- [E2EE_OPEN_QUESTIONS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_OPEN_QUESTIONS.md)
- [E2EE_PROTOCOL_V2_DECISION.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_PROTOCOL_V2_DECISION.md)
