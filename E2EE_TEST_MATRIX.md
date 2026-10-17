# Pulse E2EE Test Matrix

Deze matrix helpt om E2EE-gerelateerd gedrag gericht te testen zonder steeds opnieuw te bedenken welke paden geraakt worden.

## 1. V2 Contractgrenzen

Scenario:

- een device registreert publieke keymaterialen
- een client ontvangt een geclaimde key bundle
- een afzender verstuurt exact een envelope per doelapparaat
- een ontvanger accepteert alleen de eigen delivery-envelope

Belangrijke bestanden:

- [src/lib/e2ee/v2/protocolV2Contract.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/protocolV2Contract.js)
- [src/lib/e2ee/v2/protocolV2Contract.test.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/protocolV2Contract.test.js)

Verwachte uitkomst:

- alleen `pulse_e2ee_v2` versie 2 wordt geaccepteerd
- plaintext-, preview-, private-key- en message-keyvelden worden geweigerd
- ontbrekende, dubbele en onverwachte devices worden geweigerd
- recipient user en device moeten met de geauthenticeerde ontvanger overeenkomen

Backenddekking:

- berichtmetadata bevat geen ciphertext of volledige envelopelijst
- ieder actief doeldevice krijgt exact één eigen envelope-document
- afzenders andere actieve devices worden meegenomen in de fan-out
- ontbrekende, extra, dubbele en legacy doeldevices worden geweigerd
- dezelfde UUID met dezelfde payload is idempotent
- dezelfde UUID met gewijzigde ciphertext wordt geweigerd
- Socket.IO ontvangt alleen een inhoudsloos event in de geverifieerde device-room
- een device kan via HTTPS alleen de eigen envelope ophalen
- 256 KiB wordt na base64-decoding server-side afgedwongen
- legacy service- en socket-send worden bij `v2_required` geweigerd

Android-opslagdekking:

- recordnamen lekken geen ruwe user- of device-id
- recordtype en ids zijn fail-closed gevalideerd
- user, recordtype en record-id zijn aan AES-GCM AAD gebonden
- private records zijn uitgesloten van backup en device-transfer
- de bridge exporteert geen key- of sessierecords
- encrypted write/read/remove, private-recordscheiding, secure-storage-
  capability en identityherstel zijn geslaagd op een fysieke Android 16-Samsung
- hardware-backed Keystore is bevestigd; StrongBox is op dit toestel niet
  beschikbaar
- dezelfde identity en registration-ID zijn na een volledige toestelreboot
  hersteld
- lockscreen, een tweede hardwareprofiel en backup/restore blijven afzonderlijke
  fysieke gates

Android-providerdekking:

- bootstrap retourneert alleen publieke registratie- en capabilityvelden
- het Signal-device-ID blijft aan dezelfde lokale identity gebonden
- een eerste tekstbericht gebruikt een prekey-envelope
- het ratchet-antwoord gebruikt een reguliere message-envelope
- identity, prekeys en sessies blijven na een gesimuleerde appherstart bruikbaar
- opaque backend-device-ID's blijven na herstart aan hetzelfde Signal-device-ID
  gekoppeld en conflicterende koppelingen worden geweigerd
- een hogere remote identity-versie verwijdert de oude sessie en trusted
  identity en start opnieuw met een prekey-envelope
- stale identity-versies en ingetrokken remote devices worden geweigerd
- de JavaScript-adapter weigert buiten native Android fail-closed

Belangrijke bestanden:

- `android/app/src/main/java/com/pulsemessenger/chat/e2ee/v2/PulseE2eeV2Provider.java`
- `android/app/src/main/java/com/pulsemessenger/chat/e2ee/v2/PulseE2eeV2Plugin.java`
- `android/app/src/test/java/com/pulsemessenger/chat/e2ee/v2/PulseE2eeV2ProviderTest.java`
- [src/lib/e2ee/v2/nativeAndroidProvider.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/nativeAndroidProvider.js)
- [src/lib/e2ee/v2/nativeAndroidProvider.test.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/nativeAndroidProvider.test.js)

V2-clientnetwerkdekking:

- ongeldige publieke registratie wordt vóór de netwerkaanroep geweigerd
- backendfoutcodes zoals `v2_not_enabled` blijven stabiel beschikbaar
- recipient- en own-deviceclaims worden vóór cryptografisch gebruik gevalideerd
- een envelope wordt alleen geaccepteerd voor de ingelogde user en het eigen device
- registratiebootstrap stopt zolang de native providergate gesloten is
- bestaande sessies versturen zonder opnieuw prekeys te claimen
- een gewijzigde backend-recipientset veroorzaakt maximaal een claimrefresh en
  hergebruikt ciphertext voor ongewijzigde devices
- een nieuw recipient- of sibling-device krijgt een eigen prekey-envelope
- decryptie gebruikt het servergeverifieerde `senderSignalDeviceId`
- decryptie gebruikt ook de servergeverifieerde `senderIdentityVersion`, zodat
  gemiste realtime lifecycle-events bij delivery worden hersteld
- intrekking van het huidige device wist alle lokale native E2EE-records
- lifecycle- en message-available-socketevents worden serieel verwerkt
- gespiegeld of herhaald aangeboden events worden gededupliceerd
- mislukte messageverwerking kan bij een volgend event opnieuw worden gestart
- afmelden verwijdert alleen de E2EE v2-listeners van deze coordinator
- een geldige opaque devicebinding wordt in Socket.IO-auth geplaatst en een
  actieve socket herverbindt precies eenmaal

Belangrijke bestanden:

- [src/lib/e2ee/v2/v2ApiClient.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/v2ApiClient.js)
- [src/lib/e2ee/v2/v2ApiClient.test.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/v2ApiClient.test.js)
- [src/lib/e2ee/v2/androidDeviceRegistration.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/androidDeviceRegistration.js)
- [src/lib/e2ee/v2/androidMessageOrchestrator.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/androidMessageOrchestrator.js)
- [src/lib/e2ee/v2/androidMessageOrchestrator.test.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/androidMessageOrchestrator.test.js)
- [src/lib/e2ee/v2/androidSessionLifecycle.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/androidSessionLifecycle.js)
- [src/lib/e2ee/v2/androidSessionLifecycle.test.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/androidSessionLifecycle.test.js)
- [src/lib/e2ee/v2/androidSocketLifecycle.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/androidSocketLifecycle.js)
- [src/lib/e2ee/v2/androidSocketLifecycle.test.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/v2/androidSocketLifecycle.test.js)
- [src/services/socketE2ee.test.js](/home/yushuaabdulkadir/pulse-frontend/src/services/socketE2ee.test.js)

## 2. Login En Device Bootstrap

Scenario:

- gebruiker logt in
- device bootstrap draait alleen wanneer dat volgens config logisch is

Belangrijke bestanden:

- [src/App.js](/home/yushuaabdulkadir/pulse-frontend/src/App.js)
- [src/lib/e2ee/config.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/config.js)
- [src/lib/e2ee/deviceBootstrap.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/deviceBootstrap.js)

Verwachte uitkomst:

- in `mock + socket` geen onnodige bootstrapflow
- in `mock + service` wel bootstrappoging

## 3. Legacy Bericht Laden

Scenario:

- oud plaintext bericht wordt opgehaald uit gesprekshistorie

Belangrijke bestanden:

- [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)
- [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)
- [src/lib/e2ee/messageModel.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messageModel.js)

Verwachte uitkomst:

- bericht wordt genormaliseerd
- `protocol` valt terug op `legacy_plaintext`
- UI toont gewone tekst

## 4. Mock Wire Bericht Laden

Scenario:

- legacy/mock `signal_v1` bericht wordt opgehaald

Belangrijke bestanden:

- [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)
- [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)
- [src/components/MessageBubble.js](/home/yushuaabdulkadir/pulse-frontend/src/components/MessageBubble.js)

Verwachte uitkomst:

- hydrateert naar plaintext als mogelijk
- of toont `Versleuteld bericht`

## 5. Direct Chat Versturen Via Socket

Scenario:

- `REACT_APP_E2EE_TRANSPORT=socket`

Belangrijke bestanden:

- [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)

Verwachte uitkomst:

- bestaande socketflow blijft werken
- optimistic message verschijnt

## 6. Mock Direct Chat Versturen Via Service

Scenario:

- `REACT_APP_E2EE_TRANSPORT=service`

Belangrijke bestanden:

- [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)
- [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)
- [src/lib/e2ee/sessionStore.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/sessionStore.js)

Verwachte uitkomst:

- optimistic message gaat van `sending` naar `sent`
- backend response levert `messageId`

## 7. Retry Flow

Scenario:

- versturen mislukt
- gebruiker kiest retry

Belangrijke bestanden:

- [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)
- [src/lib/e2ee/messageModel.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messageModel.js)

Verwachte uitkomst:

- bericht krijgt `failed`
- retry zet bericht weer naar `sending`

## 8. Live Ontvangst

Scenario:

- nieuw bericht komt realtime binnen via socket

Belangrijke bestanden:

- [src/hooks/useChat.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useChat.js)
- [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)

Verwachte uitkomst:

- frontend accepteert `message:received` en `message:new`
- bericht wordt eerst gehydrateerd

## 9. Conversation Preview

Scenario:

- gespreksoverzicht moet laatste bericht tonen

Belangrijke bestanden:

- [src/components/ConversationItem.js](/home/yushuaabdulkadir/pulse-frontend/src/components/ConversationItem.js)
- [src/lib/e2ee/messageModel.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messageModel.js)

Verwachte uitkomst:

- preview toont tekst
- of `Versleuteld bericht`
- maar geen lege string bij relevante input

## 10. Bel En Videobel Kaarten

Scenario:

- gebruiker start of mist een spraak- of videogesprek

Belangrijke bestanden:

- [src/components/CallMessageCard.js](/home/yushuaabdulkadir/pulse-frontend/src/components/CallMessageCard.js)
- [src/components/callMessageHelpers.js](/home/yushuaabdulkadir/pulse-frontend/src/components/callMessageHelpers.js)
- [src/components/MessageBubble.js](/home/yushuaabdulkadir/pulse-frontend/src/components/MessageBubble.js)

Verwachte uitkomst:

- call card toont logische labels en status
- gemiste oproepen blijven klikbaar waar bedoeld
- spraak en video gebruiken dezelfde stabiele renderflow

## 11. Geen Chatmedia Of Attachments

Scenario:

- gebruiker probeert media of bestanden te delen in een gesprek

Belangrijke bestanden:

- [src/components/ChatInput.js](/home/yushuaabdulkadir/pulse-frontend/src/components/ChatInput.js)
- [src/screens/ChatScreen.js](/home/yushuaabdulkadir/pulse-frontend/src/screens/ChatScreen.js)
- [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)

Verwachte uitkomst:

- er is geen gebruikersflow om chatmedia te versturen
- de composer blijft tekstgericht
- E2EE-scope blijft beperkt tot chat, bel en video

## 12. Edit Policy

Scenario:

- gebruiker opent contextmenu van een encrypted bericht

Belangrijke bestanden:

- [src/lib/e2ee/policy.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/policy.js)
- [src/components/MsgContextMenu.js](/home/yushuaabdulkadir/pulse-frontend/src/components/MsgContextMenu.js)
- [src/screens/ChatScreen.js](/home/yushuaabdulkadir/pulse-frontend/src/screens/ChatScreen.js)
- [src/hooks/useChat.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useChat.js)

Verwachte uitkomst:

- editoptie ontbreekt voor `signal_v1`
- plaintext edit-event overschrijft encrypted bericht niet

## 13. Parent Policy Deny

Scenario:

- backend weigert key bundle of send

Belangrijke bestanden:

- [src/lib/e2ee/messagingService.js](/home/yushuaabdulkadir/pulse-frontend/src/lib/e2ee/messagingService.js)
- [src/hooks/useConversations.js](/home/yushuaabdulkadir/pulse-frontend/src/hooks/useConversations.js)

Verwachte uitkomst:

- send eindigt in `failed`
- UI blijft bruikbaar

## Gebruik

Deze matrix werkt goed samen met:

- [E2EE_MANUAL_QA_CHECKLIST.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_MANUAL_QA_CHECKLIST.md)
- [E2EE_TROUBLESHOOTING.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_TROUBLESHOOTING.md)
- [E2EE_BACKLOG.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_BACKLOG.md)
