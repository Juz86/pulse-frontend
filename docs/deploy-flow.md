# Pulse Deploy Flow

Laatste update: 2026-06-21

Dit document beschrijft de standaard werkwijze voor commits en deploys van de actieve repos:

- `pulse-frontend`
- `pulse-backend`

## 1. Repo-mapping

### Frontend

- repo: `pulse-frontend`
- branch: `main`
- remote: `origin -> git@github.com:Juz86/pulse-frontend.git`

### Backend

- repo: `pulse-backend`
- branch: `main`
- remote: `origin -> git@github.com:Juz86/pulse-backend.git`
- extra remote: `erlang-origin -> git@github.com:Juz86/pulse-backend-erlang.git`

Belangrijk:

- Voor normaal backendwerk gebruiken we alleen `origin`.
- We pushen niet naar `pulse-backend-erlang` voor dit traject.

## 2. Standaard werkwijze

Bij elke inhoudelijke wijziging:

1. wijziging maken
2. lokaal verifiëren waar zinvol
3. commit maken
4. pushen naar `main`
5. deploystatus controleren

## 3. Backend deployflow

Standaard:

1. commit in `pulse-backend`
2. push naar `origin/main`
3. Railway pakt de wijziging op via de gekoppelde GitHub-repo

Praktisch commando:

```bash
git -C /home/yushuaabdulkadir/pulse-backend push origin main
```

Na push controleren:

- Railway deployment start
- backend logs bevatten geen startup errors
- kritieke routes reageren normaal

## 4. Frontend web deployflow

Standaard GitHub-pad:

1. commit in `pulse-frontend`
2. push naar `origin/main`

Praktisch commando:

```bash
git -C /home/yushuaabdulkadir/pulse-frontend push origin main
```

Directe Cloudflare Pages deploy is ook mogelijk als een geauthenticeerde Wrangler-omgeving beschikbaar is:

```bash
npm run deploy:webapp
```

Opmerking:

- In deze omgeving is geen vaste Cloudflare-auth zichtbaar, dus push naar GitHub is de veilige standaard.
- Als Cloudflare Pages op Git-integratie staat, volgt webdeploy automatisch op push.

## 5. Android releaseflow

Voor Play Console builds:

```bash
npm run android:build:play
```

Verwachte output:

- `.aab` op `android/app/build/outputs/bundle/release/app-release.aab`
- Gradle bouwt en kopieert de actuele React-webapp zelf voordat de release wordt verpakt
- een rechtstreekse `bundleRelease` gebruikt daardoor nooit stilzwijgend verouderde web-assets

Na release-build:

- gewijzigde `versionCode` committen
- vervolgens `pulse-frontend` pushen

## 6. Verificatie na deploy

Backend:

- login werkt
- gesprekkenlijst laadt
- gesprek openen werkt
- geen Firebase- of Firestore-fouten in Railway

Frontend web:

- juiste target laadt
- login werkt
- chatlijst en chatdetail laden
- console bevat geen nieuwe runtime errors

Android:

- app installeert of uploadt succesvol
- login werkt
- gesprekken laden werkt

## 7. Huidige praktijkafspraak

Vanaf nu geldt:

- elke inhoudelijke wijziging committen
- daarna meteen pushen
- backend push behandelen als deploy-trigger
- frontend push behandelen als standaard release-stap
- Android `.aab` apart bouwen wanneer Play-test of store-upload nodig is
