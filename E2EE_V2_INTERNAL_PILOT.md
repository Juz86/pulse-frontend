# Pulse E2EE v2 Interne Pilot

## Status

De eerste begrensde Android-only pilotsessie is op 20 oktober 2026 geslaagd in
de afgescheiden QA-omgeving. Dit is geen productiepilot en geeft geen
toestemming om E2EE in de publieke app te claimen of gesprekken naar
`v2_required` om te zetten.

## Scope

- Firebase-project `pulse-messenger-e2ee-qa`;
- tijdelijke Railway QA-backend met `E2EE_V2_ENABLED=true`;
- twee interne QA-accounts en een expliciet `v2_pending` een-op-eengesprek;
- twee fysieke Android-toestellen en uitsluitend de aparte QA-packages;
- alleen tekstberichten; groepen, browser, media, calls en attachments blijven
  buiten deze pilot;
- productieaccounts, productiegesprekken en de Play Store-app blijven buiten
  bereik.

## Harde Grenzen

- geen automatische downgrade naar legacy-, mock- of plaintexttransport;
- geen `v2_required` en geen zichtbare E2EE-productclaim;
- private identity keys, prekeys en sessierecords verlaten Android niet;
- de backend ontvangt alleen ciphertext, beperkte routingmetadata en
  `Versleuteld bericht` als preview;
- de Railway-deployment wordt direct na iedere pilotsessie gestopt;
- een onbekend recipient-device, decryptiefout, identity-conflict of
  providerfout stopt de verzending of ontvangst fail-closed.

## Startcriteria

- Android-naar-Android verkeer werkt in beide richtingen;
- offline ontvangst, processherstart en lokale versleutelde geschiedenis zijn
  fysiek bewezen;
- multi-device fan-out, revoke/herregistratie en identity-change zijn fysiek
  bewezen;
- Firestore TTL is actief en gecontroleerd;
- frontend- en backendtests, lint en build zijn groen;
- de QA-backend heeft buiten pilotsessies geen actieve deployment.

## Pilotsessie

1. Controleer dat uitsluitend de bekende QA-devices actief zijn.
2. Start de tijdelijke QA-backend.
3. Open hetzelfde `v2_pending`-gesprek op beide fysieke Android-toestellen.
4. Verstuur meerdere normale tekstberichten in beide richtingen.
5. Controleer realtime ontvangst, volgorde en conversation previews.
6. Breng een ontvanger naar de achtergrond en controleer hervatting.
7. Herstart minstens een app-proces en controleer lokale geschiedenis.
8. Controleer per bericht de exacte device-audience en envelope-status.
9. Controleer dat alle feeds leeg eindigen en dat geen pilotmarker plaintext in
   Firestore, envelopes of procesgebonden logs staat.
10. Stop Railway en bevestig `activeDeployments: []` en
    `latestDeployment: null`.

## Bewijs Eerste Sessie

De eerste pilotsessie gebruikte twee fysieke Samsung-toestellen, twee
QA-accounts, drie actieve account/device-combinaties en een bestaand
`v2_pending`-gesprek:

- vijf normale tekstberichten zijn via de zichtbare Pulse-interface in beide
  richtingen verzonden;
- alle vijf verschenen exact eenmaal en zonder laadfout;
- een bericht dat werd verzonden terwijl QA-B op de achtergrond stond,
  verscheen bij hervatten exact eenmaal in de chat;
- na een volledige QA-B-processherstart kwamen alle vijf pilotberichten exact
  eenmaal terug uit de versleutelde lokale geschiedenis;
- de backend bevatte vijf generieke previews en exact tien afzonderlijke
  device-enveloppen; alle tien bevatten ciphertext en eindigden als
  `decrypted`;
- de feeds van beide account-A-devices en het account-B-device eindigden op
  nul;
- geen van de vijf herkenbare pilotmarkers stond plaintext in Firestore of de
  envelopes;
- beide procesgebonden Logcat-controles bevatten nul pilotmarkers;
- na afloop is de Railway QA-deployment verwijderd en expliciet gecontroleerd
  op nul actieve deployments.

Uitkomst: `GO` voor verdere interne Android-QA en onafhankelijke beoordeling;
`NO-GO` voor productie, `v2_required` en een E2EE-productclaim.

## Stopcriteria

Stop de pilot onmiddellijk bij:

- plaintext in backendopslag, logging, push of analytics;
- een envelope voor een onbekend of ingetrokken device;
- verlies, duplicatie of verkeerde volgorde van bevestigde berichten;
- automatische fallback naar legacy- of mocktransport;
- een onverwachte identity-change of niet-herstelbare decryptiefout;
- impact op productieaccounts, productie-Firebase of de Play Store-app.

Bewaar bij een stop alleen niet-gevoelige IDs, foutcodes en tijdstippen. Bewaar
geen plaintext, private keys of volledige ciphertext-enveloppen in tickets.

## Go/No-Go Na De Pilot

Een geslaagde Android-only pilotsessie betekent uitsluitend dat de QA-flow
geschikt is voor verdere interne beoordeling. Productie blijft `NO-GO` totdat:

- een browserprovider dezelfde vastgelegde vectors en fail-closed regels haalt;
- een onafhankelijke securityreview is afgerond;
- distributie- en licentievoorwaarden definitief zijn afgevinkt;
- geselecteerde gesprekken gecontroleerd naar `v2_required` kunnen migreren.
