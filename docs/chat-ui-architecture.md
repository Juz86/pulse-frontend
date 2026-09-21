# Pulse Chat UI Architecture

Laatste update: 2026-06-23

Dit document beschrijft welke frontend-bestanden en CSS-blokken leidend zijn voor de
chat-UI in `pulse-frontend`.

Doel:

- sneller begrijpen hoe de chat-UI technisch is opgebouwd
- veilig UI-wijzigingen plannen zonder per ongeluk gedrag te breken
- duidelijk houden welke laag verantwoordelijk is voor layout, state en modalstromen

## 1. Hoofdstructuur

De chat-UI wordt functioneel georkestreerd vanuit:

- `src/screens/ChatScreen.js`

Belangrijkste UI-delen:

- `src/components/ChatSidebar.js`
- `src/components/ChatHeader.js`
- `src/components/MessageList.js`
- `src/components/ChatInput.js`
- `src/components/ChatModals.js`

Belangrijkste domeinhooks:

- `src/hooks/useConversations.js`
- `src/hooks/useChat.js`
- `src/hooks/useProfile.js`
- `src/hooks/useContacts.js`

Visuele uitwerking zit hoofdzakelijk in:

- `src/App.css`

Praktisch:

- interactie- of schermstate wijzigen: `ChatScreen.js`
- lijst-, header-, input- of modalrender wijzigen: componentbestand
- spacing, mobile layout, header/input/sidebar gedrag: `App.css`

## 2. Renderhiërarchie

De hoofdverdeling van de chat-UI is:

- sidebar / conversatielijst
- actieve chatkolom
- bovenliggende modals en contextmenu’s

Leidende screen:

- `ChatScreen.js`

Deze screen beheert onder andere:

- actief gesprek
- tabs zoals `chats` en contacten
- zoekstatus
- filterstatus
- reply/edit/selectie-states
- open/dichte modals
- call-modal en contact/profielpanelen

Belangrijk:

- `ChatScreen.js` is de waarheid voor chat-UI state
- onderliggende componenten zijn vooral presentatielaag en event-forwarders

## 3. Leidende visuele zones

### 3.1 Sidebar en conversatielijst

Doel:

- overzicht van gesprekken en contacten
- filters en tabs
- account/footer-acties

Leidende componenten:

- `ChatSidebar.js`
- `ConversationList.js`
- `ConversationItem.js`

Leidende CSS-blokken:

- `.sidebar`
- `.sidebar-header`
- `.sidebar-tabs`
- `.sidebar-tab`
- `.conv-list`
- `.sidebar-contact-card`
- `.sidebar-contact-row`
- `.sidebar-footer`

Belangrijk:

- op mobiel schuift de sidebar weg zodra een gesprek open is
- de mobiele wissel tussen sidebar en chat gebeurt in `App.css`, niet in extra React-routes

### 3.2 Chat header

Doel:

- context van het actieve gesprek
- status, naam en header-acties

Leidende component:

- `ChatHeader.js`

Leidende CSS-blokken:

- `.chat-header`
- `.chat-header-info`
- `.chat-header-name`
- `.chat-header-online`
- `.chat-header-actions`
- `.chat-header-menu`
- `.sidebar-item-actions-btn`

Belangrijk:

- mobile back-behavior hangt samen met het bestaan van een open chat en de layoutregels in `App.css`

### 3.3 Berichtgebied

Doel:

- scrollbare message timeline
- achtergrond/wallpaper-state
- replies, highlights en zoeksprongen

Leidende component:

- `MessageList.js`

Leidende CSS-blokken:

- `.messages-area-wrap`
- `.messages-area`
- `.msg-group`
- `.msg-bubble`
- `.msg-time`
- `.msg-reply-quote`

Belangrijk:

- `messages-area-wrap.has-chat-bg` is leidend voor wallpaper/chatachtergrond-gedrag
- visuele aanpassing aan bubbles gebeurt vooral hier, niet in `ChatScreen.js`

### 3.4 Composer en inputzone

Doel:

- typen, verzenden, replies, mentions en mobiele veilige inputruimte

Leidende component:

- `ChatInput.js`

Leidende CSS-blokken:

- `.chat-input-area`
- `.input-row`
- `.chat-textarea`
- `.send-btn`

Belangrijk:

- safe-area en mobile keyboard spacing worden vooral hier in CSS afgevangen

### 3.5 Modals en overlays

Doel:

- profiel-, groep-, delete-, call- en overige hulppanelen

Leidende componenten:

- `ChatModals.js`
- `MsgContextMenu.js`
- `BlockConfirmModal.js`

Belangrijk:

- `ChatScreen.js` bepaalt welke modal open staat
- modale inhoud leeft in losse componenten zodat hoofdschermstate niet versnipperd raakt

## 4. Responsive source of truth

De leidende mobiele layout voor chat zit in `src/App.css` rond:

- `@media (max-width: 767px)`

Belangrijke regels daarin:

- `.app-screen:has(.chat-header) .sidebar`
- `.app-screen:has(.chat-header) .chat-main`
- `.back-btn`
- `.messages-area`
- `.chat-header`
- `.chat-input-area`
- `.sidebar-footer`

Belangrijk:

- de mobile “screen switch” tussen sidebar en chat wordt dus via CSS-transforms opgelost
- dit is een gevoelig punt voor regressies als we namen of DOM-structuur aanpassen

## 5. Risicopunten

Deze delen zijn het gevoeligst:

- `.app-screen:has(.chat-header) ...`
  - bepaalt mobiele navigatie-illusie tussen lijst en chat
- `.messages-area-wrap` en `.messages-area`
  - raakt scroll, achtergrond en message zichtbaarheid
- `.chat-input-area`
  - raakt keyboard, safe areas en bereikbaarheid van verzenden
- header-actiemenu’s en contextmenu’s
  - gevoelig voor clipping en overlap op kleine schermen

## 6. Veilige wijzigingsstrategie

Als we de chat-UI aanpassen, is dit de veiligste volgorde:

1. Eerst bepalen of de wijziging state, componentrender of pure CSS raakt
2. Eerst de leidende component aanpassen als gedrag verandert
3. Pas daarna styling aanpassen in de leidende CSS-zone
4. Mobiele uitzonderingen toevoegen in bestaande responsive blokken
5. Oude parallelle overrides verwijderen als ze dezelfde selectorfamilie opnieuw proberen te sturen

## 7. Kort onderhoudsadvies

- Gebruik `ChatScreen.js` als waarheid voor schermstate
- Houd visuele verantwoordelijkheid in `ChatHeader`, `ChatSidebar`, `MessageList` en `ChatInput`
- Voeg geen nieuwe “losse” mobiele layoutlogica toe buiten de bestaande responsive chatblokken
- Als chat op mobiel anders moet werken, eerst kijken of de bestaande `@media (max-width: 767px)` structuur al het juiste aangrijpingspunt is
