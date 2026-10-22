# Productiedienstverleners: DPA-bewijs voor Android 1.0.24 (80)

Status: accountbewijs ontbreekt; niet gebruiken als goedkeuring.

Dit werkblad koppelt het private contractbewijs aan de concrete Pulse-
productieomgeving. Screenshots, contract-PDF's, accountnamen, factuurgegevens,
tokens en andere private accountgegevens worden **niet** in deze openbare
repository opgeslagen.

## Bewijsprocedure

Voer deze stappen voor iedere dienstverlener uit:

1. Open het productieaccount en controleer dat het hieronder genoemde Pulse-
   productiemiddel onder het account valt.
2. Exporteer of maak een screenshot van de geldende DPA/verwerkersvoorwaarden,
   de contractpartij, ingangsdatum en acceptatiestatus.
3. Leg de naam en bevoegdheidsgrond van de accepterende vertegenwoordiger vast.
4. Bewaar het bestand in de afgeschermde juridische administratie.
5. Bereken lokaal de SHA-256-hash; commit het private bestand niet.
6. Neem alleen datum, documentversie, hash en een interne bewijsreferentie op in
   het uiteindelijke release-attestation.

Een publieke voorwaardenpagina of een login alleen bewijst niet dat de
voorwaarden voor het concrete productieaccount gelden.

## Firebase / Google Cloud

- Productiemiddel: Firebase-project `pulse-messenger-3cb9d`.
- Controleer dat Authentication, Firestore, Storage en Cloud Messaging van dit
  project onder de actuele Firebase/Google Cloud-verwerkersvoorwaarden vallen.
- Leg contractpartij, voorwaardenversie, ingangsdatum, acceptatiestatus en
  projectkoppeling vast.
- Vereist privébewijs: account- of contractexport waarin project-ID en geldende
  voorwaarden samen controleerbaar zijn.
- Openbare bronnen:
  - https://firebase.google.com/support/privacy/
  - https://firebase.google.com/terms/data-processing-terms/

## Sentry

- Productiemiddel: organisatie-ID `4511088630366208`, project-ID
  `4511088656908368`.
- Controleer de DPA-status, juridische contractpartij en ingest/dataregio.
- Controleer afzonderlijk of AI-functies of integraties gegevens naar andere
  partijen sturen; zo ja, moet de Data Safety-beoordeling opnieuw worden gedaan.
- Vereist privébewijs: DPA- of contractexport plus de relevante organisatie- en
  projectinstellingen.
- Openbare bron: https://sentry.io/legal/dpa/

## Railway

- Productiemiddel: de productiebackend achter `api.pulse-messenger.com`.
- Controleer dat het juiste productieproject en de actieve service onder het
  beoordeelde Railway-workspace en de actuele DPA vallen.
- Leg contractpartij, DPA-versie, ingangsdatum, workspace/projectreferentie en
  eventuele subprocessor- of regiokeuze vast.
- Vereist privébewijs: DPA/contractbewijs plus project- of servicemapping.
- Openbare bron: https://railway.com/legal/dpa

## Cloudflare

- Productiemiddel: de actieve Realtime TURN-configuratie die door de
  productiebackend wordt gebruikt.
- Controleer de DPA-status en dat de TURN-sleutel bij het beoordeelde
  productieaccount hoort.
- Leg geen TURN-key-ID, API-token of gedeeld geheim vast in deze repository.
- Vereist privébewijs: DPA/contractbewijs plus een geredigeerde koppeling met de
  actieve Realtime TURN-configuratie.
- Openbare bronnen:
  - https://www.cloudflare.com/cloudflare-customer-dpa/
  - https://developers.cloudflare.com/realtime/turn/faq/

## Vereiste attestationvelden

Per dienstverlener moeten uiteindelijk aanwezig zijn:

- `providerId`;
- `productionResource`;
- `legalEntity`;
- `termsVersionOrEffectiveDate`;
- `acceptedBy` en `authorityBasis`;
- `acceptedAt`;
- `privateEvidenceReference`;
- `evidenceSha256`;
- `configurationReviewedAt`;
- definitief besluit over processor/service-providerstatus en Play Data Safety
  `shared`.

Zolang een van deze velden ontbreekt, blijft
`playConsoleNoSharingApproved=false` en mag de Data Safety-verklaring niet als
definitief worden ingediend.
