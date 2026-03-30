# Pulse Legal Codebase Baseline

Dit document vult de compliance-checklist gedeeltelijk in op basis van wat **wel** direct uit deze frontendrepo kan worden afgeleid. Het is nadrukkelijk geen definitieve juridische waarheid over Pulse als geheel. Alles wat afhankelijk is van backendlogica, infrastructuur, contracten of operationele processen blijft gemarkeerd als **onbevestigd**.

## Gebruik van dit document

Gebruik dit bestand als tussenstap tussen:
- [LEGAL_COMPLIANCE_CHECKLIST.md](./LEGAL_COMPLIANCE_CHECKLIST.md)
- [LEGAL_PRIORITIES.md](./LEGAL_PRIORITIES.md)

De bedoeling is:
1. vastleggen wat al aantoonbaar uit de code blijkt;
2. scheiden wat nog onzeker is;
3. sneller placeholders kunnen vervangen zodra product- of juridische bevestiging beschikbaar is.

## 1. Wat we hard kunnen afleiden uit deze codebase

### Productscope

**Bevestigd in frontendcode:**
- Pulse ondersteunt chatten.
- Pulse ondersteunt bellen.
- Pulse ondersteunt videobellen.
- Pulse bevat ouderlijk toezicht.
- Pulse gebruikt een trusted-contact / besloten contactenmodel.
- Ouders maken kinderaccounts aan via een aparte ouderflow.
- Kinderen loggen in met gebruikersnaam en wachtwoord.
- Gebruikersnamen zijn uniek genoeg om lookup via backend te ondersteunen.

**Bronnen in code:**
- `src/screens/FunctiePagina.js`
- `src/screens/HoeWerktHetPagina.js`
- `src/screens/OuderlijkToezichtPagina.js`
- `src/screens/ParentAuthScreen.js`
- `src/screens/AuthScreen.js`
- `src/screens/ParentDashboard.js`

### Wat Pulse expliciet niet lijkt te ondersteunen

**Bevestigd of sterk ondersteund door marketing + UI-structuur:**
- geen foto’s delen als algemene communicatiefunctie;
- geen GIFs;
- geen socialmediafeed;
- geen open netwerkmodel;
- geen entertainment-first opzet.

**Belangrijke nuance:**
Deze punten blijken vooral uit marketingcopy en productopzet, niet uit een volledige backend- of feature-audit. Juridisch moet dit nog worden bevestigd als productclaim.

### Rollenmodel

**Bevestigd in frontend en rules:**
- ouder en kind zijn afzonderlijke rollen;
- ouderregistratie verloopt via een aparte flow met e-mailverificatiecode;
- ouders kunnen kinderen beheren via een ouderdashboard;
- contactbeheer en functiepauzering bestaan aan ouderzijde;
- Firestore rules beschermen velden als `role`, `parentId`, `paused`, `pausedFeatures`, `online`, `inactive`, `lastSeen` tegen directe client-updates.

**Bronnen in code:**
- `src/screens/ParentAuthScreen.js`
- `src/screens/ParentDashboard.js`
- `firestore.rules`

### Gegevenscategorieën die duidelijk zichtbaar zijn in de frontend

**Oudergegevens**
- naam;
- e-mailadres;
- wachtwoord / logingegevens;
- verificatiecodeflow;
- beheeracties rond kinderaccounts;
- contactbeheer, pauzeren en hervatten;
- activiteiten- en analyticsweergave in dashboard.

**Kindgegevens**
- gebruikersnaam;
- wachtwoord;
- display name;
- profiel- of avatarinformatie;
- contactrelaties;
- online/inactive status;
- sessie-/activiteiteninformatie;
- communicatiegerelateerde gegevens.

**Vertrouwde contacten**
- naam / displayName;
- e-mailadres of identifier;
- contactstatus;
- relatie binnen een besloten communicatieomgeving.

### Communicatiegegevens die zichtbaar of aannemelijk zijn

**Bevestigd in frontendstructuur:**
- berichtinhoud;
- oproepgegevens;
- videocommunicatiegerelateerde gegevens;
- afleverstatus;
- technische call-setup via Socket.IO + WebRTC;
- TURN-credentials via backend;
- call logs in localStorage voor gemiste oproepen;
- metadata rond online/offline/inactive status.

**Bronnen in code:**
- `src/services/socket.js`
- `src/App.js`
- `src/screens/ChatScreen.js`
- `src/components/CallOverlay.js`
- `src/components/MessageBubble.js`

### Datastromen en infrastructuur die zichtbaar zijn

**Firebase wordt gebruikt voor:**
- authentication;
- Firestore;
- Storage;
- Messaging / push notifications.

**Bron:**
- `src/firebase.js`

**Backend wordt gebruikt voor onder meer:**
- gebruikersaanmaak / sync;
- ouderverificatiecodes;
- TURN-credentials;
- FCM token registratie;
- parent dashboard endpoints;
- username lookup;
- conversations / contacts / friend requests;
- account delete endpoint.

**Bron:**
- `src/App.js`
- `src/services/socket.js`
- `src/screens/ParentAuthScreen.js`
- `src/screens/ParentDashboard.js`
- `src/hooks/useContacts.js`
- `src/hooks/useConversations.js`
- `src/hooks/useProfile.js`

### Storage- en toegangsstructuur die zichtbaar is

**Bevestigd in Storage rules:**
- profielfoto’s: `users/{uid}/profilePhoto`
- chatachtergrond: `users/{uid}/chatBackground`
- groepsfoto’s: `groups/{convId}/photo`
- groepsfoto’s zijn lees- en schrijfbaar voor gespreksleden

**Bron:**
- `storage.rules`

### Firestore-toegangsmodel

**Bevestigd in Firestore rules:**
- gebruikersdocumenten zijn leesbaar voor ingelogde gebruikers;
- eigen gebruikersdocument mag beperkt worden aangemaakt of bijgewerkt;
- role/parentId/paused-gerelateerde velden zijn beschermd tegen clientmutaties;
- contacten en nicknames zijn alleen voor de eigenaar toegankelijk;
- gesprekken en berichten zijn alleen leesbaar voor leden;
- schrijven aan gesprekken/berichten gebeurt niet direct vanaf de client;
- sessies zijn leesbaar voor kind en ouder;
- ouderactiviteiten zijn leesbaar voor de betreffende ouder.

**Bron:**
- `firestore.rules`

## 2. Wat we nog niet hard kunnen bevestigen vanuit deze repo

### Verwerkingsverantwoordelijke

**Nog onbekend / placeholder blijft nodig:**
- [NAAM VERWERKINGSVERANTWOORDELIJKE]
- [VESTIGINGSADRES]
- [KVK-NUMMER]
- [E-MAILADRES PRIVACYCONTACT]
- [FUNCTIONARIS GEGEVENSBESCHERMING]

### Definitieve bewaartermijnen

**Nog niet hard bevestigd in code:**
- [BEWAARTERMIJN]
- [BEWAARTERMIJN LOGBESTANDEN]

**Belangrijke nuance:**
De codebase en productteksten wijzen er consistent op dat berichten na 30 dagen verdwijnen. Dat maakt `30 dagen` op dit moment een verdedigbare product- en websiteclaim voor berichtretentie. De definitieve retentionlogica, back-ups en eventuele uitzonderingen moeten nog wel juridisch en technisch worden bevestigd.

### Doorgifte buiten de EER

**Nog onbevestigd:**
- [LANDEN BUITEN DE EER]

Waarom onbevestigd:
- de frontend toont Firebase en backendgebruik, maar daarmee is nog niet juridisch vastgesteld in welke landen alle data precies worden verwerkt of toegankelijk zijn.

### Verwerkers en subverwerkers

**Deels zichtbaar, maar juridisch nog niet compleet:**
- Firebase lijkt gebruikt te worden;
- een aparte backend/API wordt gebruikt;
- Socket.IO + TURN-infrastructuur wordt gebruikt;
- push messaging wordt gebruikt.

**Nog niet definitief publiceerbaar zonder bevestiging:**
- [SUBPROCESSORS / VERWERKERS]
- [HOSTINGPARTIJ]

### Encryptie- of beveiligingsmodel

**Nog onbevestigd:**
- [ENCRYPTIEMODEL]

Wat wél zichtbaar is:
- ICE/TURN credentials worden dynamisch via backend opgehaald;
- toegang is token-based;
- role-based beperking zit deels in rules;
- technische beveiligingsmaatregelen bestaan waarschijnlijk.

Wat níet bevestigd is:
- end-to-end encryptie;
- exacte encryptie van berichtinhoud;
- exacte opslag- en sleutelarchitectuur;
- formeel incidentproces.

## 3. Wat juridisch extra voorzichtig moet blijven

De volgende claims moeten in de juridische pagina’s voorzichtig geformuleerd blijven totdat ze feitelijk en juridisch bevestigd zijn:

- dat Pulse volledig AVG-compliant is;
- dat communicatie vertrouwelijk is ingericht volgens specifieke technische garanties;
- dat berichten na een vaste termijn definitief verdwijnen in alle lagen van het systeem;
- dat er geen doorgifte buiten de EER plaatsvindt;
- dat bepaalde verwerkers géén toegang hebben, tenzij dat contractueel en technisch bevestigd is;
- dat ouders wel of geen toegang hebben tot communicatie-inhoud, zolang de backend- en productlogica niet definitief is vastgelegd.

## 4. Wat al vrij sterk in de juridische teksten mag terugkomen

Deze punten zijn al goed verdedigbaar als beschrijving van productopzet, mits niet te absoluut geformuleerd:

- Pulse is ontworpen voor kinderen en families;
- ouders hebben een centrale rol in het aanmaken en beheren van kinderaccounts;
- het contactmodel is beperkt en trusted-contact-gebaseerd;
- de dienst is gericht op chatten, bellen en videobellen;
- Pulse is niet opgezet als socialmediaplatform;
- de dienst probeert dataminimalisatie en een rustige productervaring te ondersteunen;
- role-based toegang en ouderlijke governance zijn kernonderdelen van het ontwerp.

## 5. Praktische invulling van de checklist: huidige status

### Organisatie en verantwoordelijkheid
- [ ] Nog niet ingevuld vanuit codebase

### Productscope
- [x] Chatten
- [x] Bellen
- [x] Videobellen
- [x] Ouderlijk toezicht
- [x] Trusted contacts model
- [ ] Volledige productclaims juridisch bevestigd

### Rollenmodel en ouderlijke governance
- [x] Ouders maken kinderaccounts aan
- [x] Ouders beheren contacten en kindinstellingen
- [x] Kindomgeving is rolgebaseerd en beperkt
- [ ] Exacte reikwijdte van ouderinzage juridisch bevestigd

### Gegevensinventarisatie
- [~] Grotendeels zichtbaar in frontend
- [ ] Nog volledig uitwerken in formele verwerkingsinventaris

### Grondslagen en doeleinden
- [~] Tekstueel goed voorstelbaar
- [ ] Nog formeel per verwerking vastleggen

### Bewaartermijnen
- [~] Deels bevestigd
  - Berichtinhoud: 30 dagen

### Verwerkers en hosting
- [~] Firebase + backendgebruik zichtbaar
- [ ] Publiceerbare lijst nog niet bevestigd

### Doorgifte buiten EER
- [ ] Nog niet bevestigd

### Security- en encryptiemodel
- [~] Er zijn duidelijke technische beveiligingssignalen
- [ ] Exact model nog niet bevestigd

### Website en cookies
- [ ] Cookie-informatie nog niet ingevuld

## 6. Kortste samenvatting

Wat je nu al uit deze codebase mag meenemen:
- Pulse heeft een duidelijke kind/ouder/trusted-contact structuur.
- Firebase, backend-API’s, push, storage en role-based rules zijn zichtbaar.
- Ouderlijk beheer is geen losse marketingclaim maar echt onderdeel van de productopzet.

Wat je nog **niet** mag presenteren als definitief zonder aanvullende bevestiging:
- exacte bewaartermijnen;
- exacte internationale datastromen;
- definitieve lijst van verwerkers;
- exact encryptie- of vertrouwelijkheidsmodel;
- volledige juridische naleving.

## 7. Beste volgende stap

De meest logische vervolgstap is nu:

1. deze baseline samenvoegen met feitelijke informatie van product/ops/backend;  
2. daarna placeholders in de twee juridische pagina’s vervangen;  
3. daarna een privacyjurist of DPO laten reviewen.
