# Pulse E2EE Product Impact

Dit document beschrijft kort welke product- en communicatienuances belangrijk worden zodra Pulse de service-based E2EE-flow echt activeert.

## Kernpunt

Met een volwassen E2EE-model verschuift Pulse van:

- mogelijk impliciete inhoudsinzage

naar:

- harde controle op contacten, functies, tijden en metadata
- zonder dat berichtinhoud standaard server-side leesbaar hoeft te zijn

## Wat Dit Betekent Voor Producttaal

Vermijd te absolute formuleringen zoals:

- ouders zien alles
- volledig toezicht op alle berichten
- volledige inhoudsinzage

Gebruik liever formuleringen zoals:

- ouders beheren met wie een kind kan praten
- ouders beheren chat-, bel- en videotoegang
- ouders zien activiteit, contacten en gebruikspatronen
- gesprekken zijn ontworpen met sterke privacy van inhoud
- Pulse is gericht op rustig contact, niet op media delen tussen gebruikers

## ParentDashboard Richting

De bestaande dashboardrichting past goed bij E2EE als het dashboard vooral toont:

- toegestane contacten
- geblokkeerde contacten
- hoeveel berichten of sessies er zijn geweest
- actieve tijden
- call/video gebruik
- nieuwe apparaten of veiligheidsgebeurtenissen

Minder passend bij E2EE:

- berichtsnippets
- inhoudssamenvattingen
- automatische inhoudsanalyse

## Marketingimpact

Zodra echte E2EE actief is, moeten marketingpagina's en featurecopy waarschijnlijk scherper worden op:

- privacy van inhoud
- ouderlijke regie op contact en functies
- veiligheid via policy in plaats van standaard meelezen

Dat raakt waarschijnlijk pagina's zoals:

- [Homepage.js](/home/yushuaabdulkadir/pulse-frontend/src/screens/Homepage.js)
- [FunctiePagina.js](/home/yushuaabdulkadir/pulse-frontend/src/screens/FunctiePagina.js)
- [HoeWerktHetPagina.js](/home/yushuaabdulkadir/pulse-frontend/src/screens/HoeWerktHetPagina.js)
- [OverPulsePagina.js](/home/yushuaabdulkadir/pulse-frontend/src/screens/OverPulsePagina.js)

## Supportimpact

Support en interne documentatie moeten voorbereid zijn op vragen zoals:

- waarom kan een ouder niet standaard berichtinhoud lezen?
- waarom kan een kind een contact niet bereiken?
- waarom is bewerken van encrypted berichten nog niet beschikbaar?
- waarom kunnen gebruikers geen media of bestanden naar elkaar sturen?

Daarom is het handig om rollout, policy en troubleshootingdocs ook buiten engineering zichtbaar te maken.

## Aanbevolen Moment

Deze productcopy hoeft niet meteen aangepast te worden zolang:

- echte crypto nog niet actief is
- de frontend nog op `mock + socket` of `mock + service` zit

Belangrijke nuance voor de huidige fase:

- de scope is bewust beperkt tot chat, bel en video
- chatmedia hoort daar niet bij
- productcopy moet die begrenzing expliciet respecteren

## Praktisch Advies

Voor fase 1 is dit genoeg:

- hou productclaims voorzichtig
- laat ParentDashboard metadata-only blijven
- communiceer intern duidelijk dat mock crypto nog geen eindstaat is
- benadruk dat media delen tussen gebruikers geen onderdeel van deze productscope is

## Lees Verder

- [E2EE_DECISIONS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_DECISIONS.md)
- [E2EE_OPEN_QUESTIONS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_OPEN_QUESTIONS.md)
- [E2EE_RISKS.md](/home/yushuaabdulkadir/pulse-frontend/E2EE_RISKS.md)
