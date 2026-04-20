# Contributing

Deze repo heeft bewust twee verschillende frontend-targets. Kies altijd eerst het juiste target voordat je bouwt of deployt.

## Kies Het Juiste Target

Gebruik `landing` voor:

- `pulse-messenger.com`
- publieke marketingpagina's
- pagina's zoals homepage, functies, privacy-first en download
- alles zonder login, chat, Firebase, FCM of E2EE-bootstrap

Gebruik `webapp` voor:

- `web.pulse-messenger.com`
- ouder- en kindlogin
- chat, bellen, videobellen
- ouderdashboard
- Firebase, backend API, FCM en E2EE-gerelateerde flows

## Veilige Commando's

Voor landing:

```bash
npm run verify:landing
npm run deploy:landing
```

Voor webapp:

```bash
npm run verify:webapp
npm run deploy:webapp
```

Gebruik niet zomaar een generieke deployflow als je niet zeker weet welk Pages-project geraakt wordt.

## VS Code

In VS Code zijn er expliciete taken beschikbaar:

- `Pulse: Deploy Landing`
- `Pulse: Deploy Webapp`

Gebruik die in plaats van een algemene “deploy current project” actie.

## Praktische Regels

- `npm run build` is landing-safe en hoort dus bij `pulse-messenger.com`
- voor de webapp gebruik je altijd expliciet `npm run build:webapp`
- deploy naar `pulse-landing` alleen voor de publieke site
- deploy naar `pulse-frontend` alleen voor de ingelogde webapp
- run bij twijfel eerst `npm run verify:deployed-targets`

## Voor Een PR Of Push

Controleer bij wijzigingen aan marketingpagina's:

- werkt dit op `landing`?
- blijft het zonder webapp-only code?

Controleer bij wijzigingen aan chat/login/dashboard:

- werkt dit op `webapp`?
- gebruikt het geen landing-build of landing-headers?

## Handige Links

- [README.md](/home/yushuaabdulkadir/pulse-frontend/README.md)
- [DEPLOYMENT_TARGETS.md](/home/yushuaabdulkadir/pulse-frontend/DEPLOYMENT_TARGETS.md)
