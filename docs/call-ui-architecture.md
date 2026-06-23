# Pulse Call UI Architecture

Laatste update: 2026-06-23

Dit document beschrijft welke frontend-bestanden en CSS-blokken leidend zijn voor de
bel- en videobel-UI in `pulse-frontend`.

Doel:

- sneller begrijpen waar call-UI gedrag vandaan komt
- veiliger wijzigingen plannen
- voorkomen dat oude of overlappende CSS-regels opnieuw het layoutgedrag breken

## 1. Hoofdstructuur

De call-UI wordt functioneel aangestuurd vanuit:

- `src/components/CallOverlay.js`

De visuele uitwerking zit hoofdzakelijk in:

- `src/App.css`

Praktisch:

- gedragswijziging of knoplogica: `CallOverlay.js`
- layout, spacing, responsiviteit en visuele states: `App.css`

## 2. Leidende states

De component werkt in de praktijk met deze hoofd-layouts:

### 2.1 Incoming call

Doel:

- compacte topmodal
- slide-down gevoel
- snel accepteren of weigeren

Leidende JSX:

- `callState === 'incoming'` branch in `src/components/CallOverlay.js`

Leidende CSS-blokken:

- `.call-overlay.call-overlay--incoming`
- `.call-incoming-sheet`
- `.call-incoming-sheet__meta`
- `.call-incoming-sheet__actions`
- `@keyframes call-incoming-sheet-drop`

Belangrijk:

- incoming gebruikt bewust niet dezelfde full-screen card als actieve gesprekken
- avatar-badge gebruikt het Pulse-logo, niet een generieke call-badge

### 2.2 Active voice call

Doel:

- rustige full-screen belervaring
- naam/status bovenin
- avatar centraal
- ronde bedieningsknoppen onderin

Leidende JSX:

- standaard renderpad wanneer `isVoiceActiveLayout === true`

Leidende CSS-blokken:

- `.call-card.voice-active`
- `.call-card.voice-active .call-name`
- `.call-card.voice-active .call-timer`
- `.call-card.voice-active .call-status`
- `.call-card.voice-active .call-avatar-big`
- `.call-card.voice-active .call-controls.active-layout`

Belangrijk:

- voice-call controls zijn de referentie voor de hiërarchie van actieve gesprekken
- video-call is later hier visueel op terug uitgelijnd

### 2.3 Active video call

Doel:

- dezelfde hiërarchie als voice call
- remote/local video zonder overlap met controls
- compactere mobiele knopset

Leidende JSX:

- standaard renderpad wanneer `isVideoActiveLayout === true`
- extra floating actions voor mobiel:
  - `call-side-quick-actions`

Leidende CSS-blokken:

- `.call-card.transparent`
- `.call-card.transparent .call-name`
- `.call-card.transparent .call-timer`
- `.call-card.transparent .call-status`
- `.call-card.transparent.call-video-pending .call-avatar-big`
- `.call-card.transparent .call-controls.video-layout`
- `.video-local`
- `.call-side-quick-actions`

Belangrijk:

- dit is nu de source of truth voor actieve video-calls
- oudere, overlappende responsive overrides zijn verwijderd in cleanup-commit `c8c8632de`

## 3. Mobiele vereenvoudiging

Voor mobiel is de actieve video-call bewust versimpeld:

- primaire acties blijven in de onderste control-card
- secundaire acties staan apart in een floating stack

Primair:

- camera
- camera draaien
- mute
- ophangen

Secundair:

- chat
- persoon toevoegen

Leidende plekken:

- `src/components/CallOverlay.js`
  - `call-side-quick-actions`
  - `call-ctrl-secondary`
- `src/App.css`
  - `@media (max-width: 760px)`

## 4. Responsive source of truth

De actuele leidende responsive laag voor actieve video-calls zit onderaan in `src/App.css`
in deze blokken:

- `/* Final video-call control overrides: source of truth for active video calls */`
- `/* Final alignment pass: keep video call hierarchy consistent with voice call */`
- compacte Android portrait overrides
- mobiele `max-width: 760px` vereenvoudiging

Voor actieve voice-calls is de leidende responsive laag:

- `/* Audio call responsive fine-tune by target formats */`

## 5. Veilige wijzigingsstrategie

Als we call-UI opnieuw wijzigen, is dit de veiligste volgorde:

1. Eerst bepalen welke state geraakt wordt:
   - incoming
   - voice active
   - video active
2. Eerst de leidende onderliggende blokken aanpassen
3. Pas daarna een device-specifieke media query toevoegen als het echt nodig is
4. Nieuwe overrides zo laag mogelijk in het bestand plaatsen als ze bewust de source of truth zijn
5. Oude conflicterende regels verwijderen in plaats van er nog een override bovenop te zetten

## 6. Risicopunten

Deze delen zijn gevoelig voor regressies:

- `.call-card.transparent .call-controls.video-layout`
  - beïnvloedt direct knoppositie, grid en overlap
- `.video-local`
  - beïnvloedt preview-overlap met controls en safe areas
- `.call-card.transparent .call-name` en statusblokken
  - beïnvloeden visuele hiërarchie en clipping op kleine schermen
- mobiele media queries rond `max-width: 392px`, `max-height: 760px` en landscape
  - hier ontstaan het snelst toestel-specifieke bugs

## 7. Kort onderhoudsadvies

- Gebruik `CallOverlay.js` als waarheid voor state en interactie
- Gebruik de onderste finale call-CSS-blokken als waarheid voor actieve video-layout
- Vermijd nieuwe dubbele mediaregels hoger in `App.css`
- Als iets “alleen op één toestel” kapot is, eerst bestaande finale responsive blokken uitbreiden
  in plaats van opnieuw een parallelle oudere selectorstructuur te introduceren
