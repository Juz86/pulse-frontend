## Wat is gewijzigd?

- 

## Deploy Safety Checklist

- [ ] Ik heb `npm run verify:cloudflare` lokaal gedraaid of bewust gecheckt waarom dat nog niet kan.
- [ ] Ik heb geen nieuwe lint warnings geïntroduceerd.
- [ ] Ik heb geen echte secrets, sleutels of service-account data toegevoegd.
- [ ] Ik heb geen Cloudflare Pages buildinstellingen impliciet veranderd zonder dat te documenteren.
- [ ] Ik heb gecontroleerd dat Node 20 nog de verwachte versie is voor deze wijziging.

## Extra Context

- Cloudflare Pages draait Create React App met `CI=true`.
- Daardoor tellen warnings mee als build errors.
- Gebruik lokaal:
  `npm run verify:cloudflare`

## Opmerkingen

- 
