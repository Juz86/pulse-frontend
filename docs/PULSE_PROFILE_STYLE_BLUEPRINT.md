# Pulse Profile Style Blueprint

## Doel

Dit document legt de nieuwe visuele standaard van Pulse vast op basis van de profielpagina.
Deze pagina is vanaf nu de leidende referentie voor het omzetten van andere pagina's.

Hoofddoel:

- minder dashboard-achtig
- meer menselijk en rustig
- premium dark messenger uitstraling
- duidelijke content-hiërarchie
- zachte afgeronde kaarten als hoofdsysteem

## Kernprincipes

### 1. Donkere canvas, lichte focus

De app gebruikt een diepe paarse achtergrond als vaste basis.
Interactieve inhoud zweeft daarboven in lichtere kaarten, pills en action tiles.

Richtlijn:

- achtergrond is stabiel en rustig
- contentvlakken dragen de nadruk
- geen zware full-width blokken als kaartstructuur beter werkt

### 2. Content-first hiërarchie

Elke pagina volgt dezelfde globale volgorde:

1. topbar
2. hero of identity zone
3. primaire acties
4. hoofdkaart met inhoud
5. secundaire of gevaarlijke acties onderaan

Gebruiker moet binnen 1 seconde begrijpen:

- waar ben ik
- over wie of wat gaat dit scherm
- wat zijn de 2-3 belangrijkste acties
- waar staan details of instellingen

### 3. Zachte fysieke lagen

De stijl gebruikt soft physical design:

- grote border-radius
- subtiele borders
- lichte binnen- en buitenschaduwen
- afgeronde actiekaarten
- beperkte glans of glass-effecten

Niet doen:

- harde rechthoekige panelen
- zware paarse vlakken als primaire contentcontainer
- teveel losse zwevende elementen zonder hiërarchie

### 4. Rustige actieblokken

Primaire acties horen in gelijke, goed uitgelijnde kaarten of pills te staan.
Acties zijn altijd duidelijk gegroepeerd en niet verspreid over het scherm.

## Referentie-opbouw van de profielpagina

De profielpagina werkt goed omdat hij uit 5 duidelijke zones bestaat.

### A. Topbar

Bestand/structuur:

- terugknop links
- titel gecentreerd
- secundaire actie rechts, zoals `Bewerk`

Eigenschappen:

- compacte hoogte
- symmetrische spacing links en rechts
- afgeronde knoppen
- topbar blijft visueel licht ten opzichte van de achtergrond

### B. Hero / identity zone

Bestanddelen:

- grote avatar
- naam
- e-mailadres of identificerende subtekst
- status pill

Eigenschappen:

- gecentreerd
- duidelijke verticale stacking
- veel rust rondom de avatar
- status is klein en secundair

### C. Quick action row

Bestanddelen:

- Audio
- Video
- Zoek

Eigenschappen:

- 3 gelijke kaarten
- gelijke breedte
- icon boven, label onder
- duidelijke hover/tap state

### D. Detailkaart

Bestanddelen:

- sectielabels
- inputvelden of informatieregels
- optionele edit-iconen

Eigenschappen:

- 1 hoofdkaart
- grote radius
- compacte interne spacing
- labels in uppercase micro-style
- velden voelen als onderdeel van dezelfde kaartfamilie

### E. Danger / secondary zone

Voor acties als verwijderen of uitloggen:

- altijd lager in de hiërarchie
- nooit visueel concurreren met primaire profielacties
- duidelijke kleurafwijking alleen waar nodig

## Layoutregels

### Pagina-shell

Elke nieuwe pagina in deze stijl gebruikt:

- een donkere paarse page background
- een centrale verticale stack
- vaste max breedte waar nodig
- consistente horizontale padding

Richtlijn:

- outer page padding: `16px` tot `20px`
- vertical spacing tussen hoofdsecties: `20px` tot `24px`

### Topbar-regels

- titel altijd optisch gecentreerd
- linker en rechter actie visueel in balans
- knoppen altijd afgerond
- geen ruwe tekstlinks in de header

### Hero-regels

- avatar centraal
- naam direct onder avatar
- secundaire tekst daaronder
- status pill los van hoofdtekst

### Kaart-regels

- kaarten hebben altijd duidelijke radius
- binnen dezelfde pagina gebruiken kaarten maximaal 1-2 radiusmaten
- geen mix van scherpe en zachte vormen

### Actierij-regels

- actiekaarten altijd in vaste grid of vaste flex-verdeling
- icon-uitlijning consistent
- labels op gelijke baseline

## Spacingregels

Gebruik deze spacing-schaal als standaard:

- `4px` micro spacing
- `8px` kleine interne spacing
- `12px` standaard interne spacing
- `16px` compacte sectie spacing
- `20px` hoofdsectie spacing
- `24px` royale sectie spacing
- `28px` kaart-padding of hero-padding

Praktische richtlijnen:

- tussen titel en subtitel: `6px` tot `8px`
- tussen hero-elementen: `10px` tot `14px`
- tussen action row en detailkaart: `20px` tot `24px`
- tussen form groups: `10px` tot `12px`

## Radiusregels

Gebruik zo min mogelijk verschillende afrondingen.

Aanbevolen set:

- `18px` voor inputvelden en kleine pills
- `20px` voor headerknoppen
- `24px` voor action tiles
- `28px` voor hoofdkaarten
- `30px` voor hero cards of grote zachte containers
- `999px` voor status pills

## Schaduw- en borderregels

### Borders

- altijd zacht en subtiel
- meestal `1px solid rgba(140, 122, 214, 0.12 - 0.16)`

### Schaduw

- lage opacity
- geen harde zwarte drop shadow
- vaak combinatie van buiten- en inset-shadow

Richtlijn:

- kleine knoppen: lichte inset + zachte outer shadow
- grote kaarten: zachte diffuse shadow

## Kleurregels

### Basis

- donkere violet achtergrond
- contentkaarten wit/lavendel-tint
- primaire tekst donker violet
- secundaire tekst gedempt violet-grijs

### Accent

- paars voor actieve of merkgebonden elementen
- groen alleen voor presence of call-context
- rood alleen voor destructive acties

### Niet doen

- te veel felle accentkleuren in één scherm
- paarse vlakken gebruiken als invulling van elk component

## Typografieregels

### Titel

- bold
- duidelijk gecentreerd of links uitgelijnd volgens schermtype
- letter spacing licht negatief waar passend

### Naam / primaire identity tekst

- zwaarder dan gewone titels
- kort, krachtig, goed leesbaar

### Secundaire copy

- lichter van kleur
- kleiner formaat
- altijd ondersteunend, niet concurrerend

### Labels

- uppercase
- kleine grootte
- verhoogde letter-spacing
- gedempt van kleur

## Componentlijst

Onderstaande componenten moeten we als herbruikbare bouwstenen gaan behandelen.

### 1. `PulsePageShell`

Verantwoordelijkheid:

- donkere achtergrond
- page padding
- verticale flow
- algemene layout-begrenzing

### 2. `PulseTopBar`

Verantwoordelijkheid:

- terugknop links
- titel midden
- actie rechts

Varianten:

- profiel
- instellingen
- subpagina

### 3. `PulseHeroProfile`

Verantwoordelijkheid:

- avatar
- naam
- secundaire tekst
- status pill

### 4. `PulseStatusPill`

Verantwoordelijkheid:

- online/offline status
- andere kleine contextlabels

### 5. `PulseActionCardRow`

Verantwoordelijkheid:

- gelijke verdeling van primaire acties

### 6. `PulseActionCard`

Verantwoordelijkheid:

- icon
- label
- compacte kaartstijl

### 7. `PulseDetailCard`

Verantwoordelijkheid:

- grote hoofdkaart voor profieldata, instellingen of formulieren

### 8. `PulseFieldGroup`

Verantwoordelijkheid:

- label
- input of statische waarde
- helper text waar nodig

### 9. `PulseDangerSection`

Verantwoordelijkheid:

- destructive actie visueel scheiden van gewone acties

## Tokenlijst

Deze tokens moeten we later centraal trekken waar mogelijk.

### Ruimte

- `--pulse-space-1: 4px`
- `--pulse-space-2: 8px`
- `--pulse-space-3: 12px`
- `--pulse-space-4: 16px`
- `--pulse-space-5: 20px`
- `--pulse-space-6: 24px`
- `--pulse-space-7: 28px`

### Radius

- `--pulse-radius-field: 18px`
- `--pulse-radius-button: 20px`
- `--pulse-radius-tile: 24px`
- `--pulse-radius-card: 28px`
- `--pulse-radius-hero: 30px`
- `--pulse-radius-pill: 999px`

### Kleur

- `--pulse-bg-app: deep violet background`
- `--pulse-surface-1: main light card`
- `--pulse-surface-2: lighter interactive fill`
- `--pulse-text-1: primary dark violet text`
- `--pulse-text-2: secondary muted text`
- `--pulse-accent: pulse purple`
- `--pulse-success: online green`
- `--pulse-danger: soft danger red`

### Schaduw

- `--pulse-shadow-soft: zachte standaard kaartschaduw`
- `--pulse-shadow-float: iets sterkere floating shadow`
- `--pulse-shadow-inset: lichte inner highlight`

## Omzetregels voor andere pagina's

Bij het omzetten van andere pagina's gelden deze regels:

1. Eerst layout-hiërarchie gelijk trekken.
2. Daarna componentvormen gelijk trekken.
3. Daarna spacing en typografie.
4. Pas als laatste micro-polish doen.

Nooit andersom.

Als de hiërarchie niet klopt, helpt kleur of schaduw niet.

## Omzetvolgorde per pagina

Aanbevolen volgorde:

### Fase 1. Hoge prioriteit

1. Instellingen
2. Mijn account
3. Geschiedenis
4. Styling
5. Geblokkeerd

### Fase 2. Parent flows

1. Ouderportaal overzicht
2. Kind toevoegen
3. Mijn kinderen
4. Contacten
5. Locatie
6. Activiteiten

### Fase 3. Contact- en profielstromen

1. Contactprofiel
2. Chat-header profiel
3. Shared profile sheet

### Fase 4. Communicatie-sheets

1. Nieuwe chat
2. Nieuw contact
3. Nieuwe groep
4. Verzoeken
5. Meer opties

### Fase 5. Hoofdschermen

1. Chatlijst
2. Chatdetail

## QA-checklist voor elke omzetting

Bij elke pagina controleren:

- klopt de topbar-structuur
- klopt de hero-structuur
- zijn de primaire acties gelijkmatig verdeeld
- gebruikt de pagina dezelfde radii
- gebruikt de pagina dezelfde kaarttaal
- klopt de verticale spacing tussen secties
- is de typografiehiërarchie consistent
- is destructive UI duidelijk maar niet dominant
- werkt het op kleine schermen
- blijft de footer of navigatie logisch gepositioneerd

## Wat we expliciet niet willen

- losse stijlexcepties per pagina
- andere radius per scherm zonder reden
- mix van oude dashboardblokken en nieuwe soft cards
- willekeurige inline stijlen voor layout
- zware paarse inputvelden naast lichte soft cards

## Implementatiestrategie

We bouwen vanaf nu nieuwe of omgezette pagina's in 2 stappen:

### Stap 1. Structureel

- layout herschikken
- hero vastzetten
- action row structureren
- contentkaart maken

### Stap 2. Visueel

- spacing fine-tunen
- radius gelijk trekken
- shadows, borders en typografie afstemmen

## Besluit

De profielpagina is vanaf nu de designbron voor Pulse-schermen die draaien om:

- identiteit
- instellingen
- profieldata
- accountbeheer
- primaire useracties

Als een nieuwe pagina hiervan afwijkt, moet daar een bewuste reden voor zijn.
