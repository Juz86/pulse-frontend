# Pulse Compliance-Checklist

Deze checklist is bedoeld als praktische werkversie voor de verdere juridische en operationele afwerking van Pulse. Het document is geen juridisch advies en vervangt geen beoordeling door een privacyjurist, DPO of compliance-adviseur. De checklist helpt om de huidige websitepagina's `Privacybeleid` en `AVG-beleid voor elektronische communicatie` om te zetten naar een juridisch beter onderbouwde, feitelijk correcte en publiceerbare versie.

## 1. Organisatie en verantwoordelijkheid

- [ ] Bevestig wie juridisch de verwerkingsverantwoordelijke is.
- [ ] Vul de officiële naam in van de entiteit achter Pulse.
- [ ] Vul het vestigingsadres in.
- [ ] Vul het KVK-nummer in.
- [ ] Bepaal welk e-mailadres als privacycontact wordt gebruikt.
- [ ] Beoordeel of een functionaris voor gegevensbescherming nodig of wenselijk is.
- [ ] Leg intern vast wie eigenaar is van privacy, security en incidentrespons.

## 2. Productscope en feitelijke werking

- [ ] Bevestig welke functies in productie beschikbaar zijn:
  - [ ] chatten
  - [ ] bellen
  - [ ] videobellen
- [ ] Bevestig welke functies expliciet niet worden aangeboden:
  - [ ] foto’s delen
  - [ ] GIFs
  - [ ] algoritmische aanbevelingen
  - [ ] eindeloos scrollen
  - [ ] entertainment-first features
- [ ] Bevestig of berichten daadwerkelijk automatisch verdwijnen.
- [ ] Bevestig of verwijderde berichten nog in back-ups of herstelprocessen kunnen voorkomen.
- [ ] Bevestig hoe gebruikersnamen worden uitgegeven en beheerd.
- [ ] Bevestig of kinderen zelfstandig instellingen kunnen wijzigen of alleen via ouders.

## 3. Rollenmodel en ouderlijke governance

- [ ] Bevestig dat ouders kinderaccounts aanmaken.
- [ ] Bevestig welke handelingen alleen ouders kunnen uitvoeren.
- [ ] Leg exact vast hoe trusted contacts worden toegevoegd, goedgekeurd en verwijderd.
- [ ] Bevestig of kinderen zelfstandig nieuwe contacten kunnen verzoeken of toevoegen.
- [ ] Bepaal welke zichtbaarheid ouders hebben in:
  - [ ] contactbeheer
  - [ ] accountinstellingen
  - [ ] metadata
  - [ ] communicatie-inhoud
- [ ] Leg vast of en wanneer ouders namens een kind privacyrechten uitoefenen.

## 4. Gegevensinventarisatie

- [ ] Maak een volledige verwerkingsinventaris per categorie betrokkene:
  - [ ] ouders
  - [ ] kinderen
  - [ ] vertrouwde contacten
  - [ ] websitebezoekers
- [ ] Breng per categorie in kaart welke persoonsgegevens worden verwerkt.
- [ ] Splits per verwerking duidelijk uit:
  - [ ] accountgegevens
  - [ ] profielgegevens
  - [ ] gebruikersnamen
  - [ ] berichtinhoud
  - [ ] oproepgegevens
  - [ ] videocommunicatiegegevens
  - [ ] technische metadata
  - [ ] security logs
  - [ ] support- en incidentgegevens
- [ ] Leg vast welke gegevens echt noodzakelijk zijn en welke optioneel zijn.
- [ ] Verwijder onnodige gegevenscategorieën uit ontwerp en documentatie.

## 5. Doeleinden en grondslagen

- [ ] Leg per verwerking het concrete doel vast.
- [ ] Leg per verwerking de juridische grondslag vast.
- [ ] Controleer of elke verwerking voldoet aan doelbinding.
- [ ] Controleer of elke verwerking voldoet aan dataminimalisatie.
- [ ] Controleer of voor eventuele toestemming een alternatief grondslagmodel nodig of beter passend is.
- [ ] Bevestig dat communicatiegegevens niet worden gebruikt voor:
  - [ ] advertenties
  - [ ] profiling
  - [ ] behavioural targeting
  - [ ] engagement optimisation

## 6. Transparantieverplichtingen AVG

- [ ] Controleer of alle verplichte informatie-elementen uit artikel 13 en waar relevant artikel 14 AVG aanwezig zijn.
- [ ] Controleer of de privacypagina begrijpelijk is voor ouders.
- [ ] Controleer of de teksten duidelijk genoeg uitleggen wat er met kindgegevens gebeurt.
- [ ] Controleer of de teksten feitelijk kloppen met de daadwerkelijke appwerking.
- [ ] Vervang alle placeholders zodra de feitelijke informatie vaststaat.

## 7. Elektronische communicatie en ePrivacy

- [ ] Beoordeel juridisch hoe Pulse kwalificeert binnen de regels voor elektronische communicatie.
- [ ] Laat toetsen of de uitleg over vertrouwelijkheid van communicatie aansluit op toepasselijke ePrivacy-regels en nationale implementatie.
- [ ] Leg vast welke communicatiegegevens nodig zijn voor aflevering, synchronisatie en beveiliging.
- [ ] Leg vast welke metadata strikt noodzakelijk is en welke niet.
- [ ] Leg vast wie toegang heeft tot communicatie-inhoud.
- [ ] Leg vast wie toegang heeft tot technische metadata.
- [ ] Bevestig dat toegang tot communicatiegegevens role-based en beperkt is.
- [ ] Bevestig dat communicatie niet wordt verwerkt voor commerciële optimalisatie of advertentiedoeleinden.

## 8. Bewaartermijnen

- [ ] Stel een concrete bewaartermijn vast voor accountgegevens van ouders.
- [ ] Stel een concrete bewaartermijn vast voor accountgegevens van kinderen.
- [ ] Stel een concrete bewaartermijn vast voor trusted contact data.
- [x] Stel een concrete bewaartermijn vast voor berichtinhoud: 30 dagen.
- [ ] Stel een concrete bewaartermijn vast voor call- en videocall-gerelateerde data.
- [ ] Stel een concrete bewaartermijn vast voor technische metadata.
- [ ] Stel een concrete bewaartermijn vast voor security logs.
- [ ] Stel een concrete bewaartermijn vast voor support- en incidentdossiers.
- [ ] Leg vast wanneer gegevens worden verwijderd, geanonimiseerd of alleen nog in back-upvorm bestaan.
- [ ] Controleer of bewaartermijnen proportioneel zijn voor een kindgerichte dienst.

## 9. Beveiliging en privacy by design

- [ ] Documenteer het toegangs- en autorisatiemodel.
- [ ] Documenteer authenticatiemaatregelen.
- [ ] Documenteer logging en monitoring.
- [ ] Documenteer de beveiliging van opslag en transport.
- [ ] Leg het encryptie- of beveiligingsmodel feitelijk vast.
- [ ] Verwijder iedere niet-bevestigde claim uit de juridische teksten.
- [ ] Bevestig dat kinderomgevingen beperkt en rolgebaseerd zijn ingericht.
- [ ] Controleer of privacy by design en privacy by default daadwerkelijk in het productontwerp zijn doorgevoerd.

## 10. Verwerkers en infrastructuur

- [ ] Maak een actuele lijst van alle verwerkers en subverwerkers.
- [ ] Bevestig welke partijen betrokken zijn bij:
  - [ ] hosting
  - [ ] database
  - [ ] authenticatie
  - [ ] logging
  - [ ] notificaties
  - [ ] chat-/call-/videoinfrastructuur
  - [ ] support tooling
- [ ] Sluit of controleer verwerkersovereenkomsten.
- [ ] Beoordeel per partij welke gegevenscategorieën zij ontvangen of kunnen benaderen.
- [ ] Bepaal welke partijen op de website publiek moeten worden genoemd.

## 11. Doorgifte buiten de EER

- [ ] Bevestig of persoonsgegevens buiten de EER worden verwerkt of toegankelijk zijn.
- [ ] Leg vast om welke landen het gaat.
- [ ] Leg vast op welke juridische basis doorgifte plaatsvindt.
- [ ] Controleer of aanvullende waarborgen nodig zijn.
- [ ] Werk de publieke privacyteksten bij zodra dit definitief vaststaat.

## 12. Rechten van betrokkenen

- [ ] Richt een proces in voor inzageverzoeken.
- [ ] Richt een proces in voor correctieverzoeken.
- [ ] Richt een proces in voor verwijderverzoeken.
- [ ] Richt een proces in voor bezwaar- en beperkingsverzoeken.
- [ ] Richt een proces in voor verzoeken van ouders namens hun kind.
- [ ] Beoordeel hoe vertrouwelijkheid van communicatie doorwerkt in rechtenverzoeken.
- [ ] Leg reactietermijnen en verantwoordelijken intern vast.

## 13. Kinderen en verhoogde bescherming

- [ ] Beoordeel of aanvullende kind-specifieke uitleg nodig is op de website of in onboarding.
- [ ] Controleer of het platform geen overmatige gegevens van kinderen verwerkt.
- [ ] Controleer of standaardinstellingen privacyvriendelijk zijn.
- [ ] Controleer of profielzichtbaarheid beperkt is.
- [ ] Controleer of contactmogelijkheden echt zijn afgeschermd tot vertrouwde contacten.
- [ ] Laat beoordelen of het productontwerp voldoende rekening houdt met de kwetsbaarheid van kinderen.

## 14. Incidenten, datalekken en support

- [ ] Richt een datalekprocedure in.
- [ ] Leg meldlijnen en verantwoordelijkheden vast.
- [ ] Leg vast hoe beveiligingsincidenten worden gedocumenteerd.
- [ ] Leg vast hoe support toegang krijgt tot gegevens en onder welke voorwaarden.
- [ ] Leg vast hoe abuse-, misuse- of safety-meldingen worden behandeld.

## 15. Website en cookies

- [ ] Bevestig welke cookies of vergelijkbare technieken de website gebruikt.
- [ ] Splits noodzakelijke cookies van optionele analyse- of marketingtechnieken.
- [ ] Controleer of een aparte cookiepagina of cookiebanner nodig is.
- [ ] Vul `[COOKIE-INFORMATIE]` concreet in.

## 16. Juridische review van de websitepagina's

- [ ] Laat het Privacybeleid toetsen door een privacyjurist of DPO.
- [ ] Laat het AVG-beleid voor elektronische communicatie apart toetsen.
- [ ] Controleer of beide documenten elkaar aanvullen en niet onbedoeld tegenspreken.
- [ ] Controleer of beide documenten geen technische claims doen die productmatig nog niet vaststaan.
- [ ] Vervang alle placeholders vóór publicatie.

## 17. Aanbevolen publicatievolgorde

1. Vul alle placeholders met feitelijke informatie.
2. Rond de gegevensinventarisatie en verwerkerslijst af.
3. Stel bewaartermijnen en beveiligingsmodel definitief vast.
4. Laat beide pagina’s juridisch reviewen.
5. Publiceer daarna pas de definitieve websiteversies.

## 18. Plaatsvervangers die nog ingevuld moeten worden

- [ ] [NAAM VERWERKINGSVERANTWOORDELIJKE]
- [ ] [E-MAILADRES PRIVACYCONTACT]
- [ ] [VESTIGINGSADRES]
- [ ] [KVK-NUMMER]
- [ ] [FUNCTIONARIS GEGEVENSBESCHERMING]
- [ ] [SUBPROCESSORS / VERWERKERS]
- [ ] [HOSTINGPARTIJ]
- [ ] [LANDEN BUITEN DE EER]
- [ ] [BEWAARTERMIJN]
- [x] [BEWAARTERMIJN BERICHTEN] = 30 dagen
- [ ] [BEWAARTERMIJN LOGBESTANDEN]
- [x] [LAATST BIJGEWERKT OP] = 30 maart 2026
- [ ] [TOEZICHTHOUDENDE AUTORITEIT]
- [ ] [ENCRYPTIEMODEL]
- [ ] [COOKIE-INFORMATIE]

## Slotopmerking

De huidige privacy- en communicatiepagina’s zijn een sterke eerste websiteversie, maar nog niet voldoende om zelfstandig te concluderen dat Pulse “voldoet aan Europese wetgeving”. Naleving hangt niet alleen af van de tekst op de website, maar ook van de feitelijke technische implementatie, interne processen, contracten met verwerkers, bewaartermijnen, toegangsbeveiliging en juridische toetsing.
