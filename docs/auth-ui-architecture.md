# Pulse Auth UI Architecture

Laatste update: 2026-06-23

Dit document beschrijft welke frontend-bestanden en CSS-blokken leidend zijn voor de
auth-UI in `pulse-frontend`.

Doel:

- snel begrijpen hoe child auth en parent auth zijn opgebouwd
- veiliger layout- en responsive wijzigingen doen
- onderscheid scherp houden tussen child-login, parent-portaal en web-auth varianten

## 1. Hoofdstructuur

De auth-UI draait hoofdzakelijk om:

- `src/screens/AuthScreen.js`
- `src/screens/ParentAuthScreen.js`

Ondersteunende branding:

- `src/components/PulseLogo.js`

Visuele uitwerking zit hoofdzakelijk in:

- `src/App.css`

Praktisch:

- child auth state en flipgedrag: `AuthScreen.js`
- parent login/registratie/verificatie: `ParentAuthScreen.js`
- layout, responsive gedrag en thematische auth-stijlen: `App.css`

## 2. Hoofdvarianten

### 2.1 Child auth

Doel:

- kind in laten loggen met gebruikersnaam of e-mail
- rustige, begeleide login-flow

Leidende screen:

- `AuthScreen.js`

Belangrijke state:

- `username`
- `password`
- `error`
- `loading`
- `showPassword`
- `flipped`
- `nativeTab`
- `activeFeature`

Belangrijk:

- `AuthScreen.js` behandelt ook runtime-info en de flip naar parent auth
- child auth is dus niet alleen een formulier, maar ook de ingang naar de parent flow

### 2.2 Parent auth

Doel:

- ouder login
- ouderregistratie
- verificatiecode-flow

Leidende screen:

- `ParentAuthScreen.js`

Belangrijke state:

- `tab`
- `step`
- `verifyCode`
- `verifyError`
- `loading`
- `verifyLoading`
- `activeFeature`

Belangrijk:

- parent auth heeft meerdere sub-states binnen hetzelfde scherm
- wijzigingen hier raken dus vaak zowel formulierlayout als verificatiestap

## 3. Leidende visuele zones

### 3.1 Child auth shell

Leidende CSS-blokken:

- `.auth-screen`
- `.auth-flip-wrapper`
- `.auth-flip-inner`
- `.auth-card`
- `.auth-card-back`
- `.auth-card-front`

Belangrijk:

- deze laag bepaalt de hoofdkaart, de flip-illusie en de responsieve container
- recente responsive fixes voor kleine schermen leunen op deze structuur

### 3.2 Child auth formulier

Leidende CSS-blokken:

- `.auth-title`
- `.auth-sub`
- `.auth-input-shell`
- `.auth-input`
- `.auth-password-toggle`
- `.auth-error`
- `.auth-features`
- `.auth-feature`

Belangrijk:

- formuliergedrag zit in React
- visuele hiërarchie en bruikbaarheid zitten vooral in deze CSS-familie

### 3.3 Parent auth screen

Leidende CSS-blokken:

- `.parent-auth-screen`
- `.parent-auth-card`
- `.parent-auth-logo`
- `.parent-auth-title`
- `.parent-auth-sub`
- `.parent-auth-tabs`
- `.parent-auth-tab`
- `.parent-auth-field`
- `.parent-auth-input`
- `.parent-auth-btn`
- `.parent-auth-features`
- `.parent-auth-feature`

Belangrijk:

- parent auth gebruikt een eigen lichte visuele taal
- die moet je los zien van de child auth kaart en van marketing/web-auth varianten

### 3.4 Web-auth varianten

Leidende CSS-blokken:

- `.web-auth-card`
- `.web-auth-parent-panel`
- `.web-auth-parent-panel .parent-auth-*`

Belangrijk:

- deze laag is aanvullend voor web-specifieke authpresentatie
- pas hier alleen aan als je echt de web-auth variant wilt raken

## 4. Responsive source of truth

De leidende responsive auth-laag zit vooral in:

- `@media (max-width: 767px)` in `src/App.css`
- aanvullende auth/mediaregels lager in het bestand

Belangrijke mobiele regels:

- `.auth-screen`
- `.auth-card`
- `.auth-card-back`
- `.parent-auth-card`
- `.auth-card-front`
- `.auth-flip-wrapper--flipped ...`

Belangrijk:

- de responsive login-fix voor kleine schermen steunt op:
  - geen vaste card heights
  - scrollbaar scherm
  - bruikbaarheid met geopend toetsenbord
- nieuwe auth-wijzigingen moeten die principes behouden

## 5. Risicopunten

Deze delen zijn het gevoeligst:

- `.auth-screen` en `.auth-card`
  - raken verticale ruimte, keyboard-gedrag en clipping
- flip-structuur van child ↔ parent auth
  - gevoelig voor mobiele regressies
- `.parent-auth-*` verificatiestappen
  - gevoelig voor langere foutmeldingen en kleine schermhoogtes
- `.web-auth-*`
  - kan onverwacht afwijken van de app-auth stijl als je selectors te breed maakt

## 6. Veilige wijzigingsstrategie

Als we auth-UI wijzigen, is dit de veiligste volgorde:

1. Eerst bepalen welke auth-variant geraakt wordt:
   - child auth
   - parent auth
   - web-auth variant
2. Eerst de juiste screen aanpassen als gedrag verandert
3. Daarna alleen de leidende CSS-familie van die variant aanpassen
4. Mobiele fixes toevoegen in bestaande responsive authblokken
5. Geen nieuwe vaste heights of device-specifieke hacks toevoegen als dezelfde uitkomst met flex, scroll en insets kan

## 7. Kort onderhoudsadvies

- Gebruik `AuthScreen.js` en `ParentAuthScreen.js` als waarheid voor auth-flow state
- Houd child auth, parent auth en web-auth visueel gescheiden in je hoofd
- Pas bij responsive problemen eerst de bestaande auth-mediaregels aan
- Vermijd brede selectorwijzigingen op `.parent-auth-*` als het probleem alleen child auth raakt
