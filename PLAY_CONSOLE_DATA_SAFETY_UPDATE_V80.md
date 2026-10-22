# Play Console Data Safety Update v80

Status op 22 oktober 2026: invoerblad gereed; nog niet indienen voordat de
accountgebonden DPA-controle is afgerond.

Dit blad hoort bij Pulse `1.0.24` (`versionCode 80`) en de Play Console-export
met SHA-256
`89a9d26d7261cb66492b3e9a58f561a7f123ca0e9b2c6d4681dea38863f57b58`.
De export bevat al `Naam` en `E-mailadres`. Voeg onderstaande twaalf typen toe.

## Algemene antwoorden

- Verzameld: `Ja` voor alle onderstaande typen.
- Gedeeld: kandidaat `Nee`, pas definitief na accountbewijs voor Firebase,
  Sentry, Railway en Cloudflare.
- Tijdelijk verwerkt: alleen `Audio` en `Video's` op `Ja`; alle andere op
  `Nee`.
- Gegevens worden versleuteld tijdens overdracht: `Ja`.

## Ontbrekende typen

| Consolelabel | ID | Vereist/optioneel | Doelen |
| --- | --- | --- | --- |
| Gebruikers-ID's | `PSL_USER_ACCOUNT` | vereist | App-functionaliteit; Accountbeheer; Fraudepreventie, beveiliging en naleving |
| Overige persoonlijke informatie | `PSL_OTHER_PERSONAL` | vereist | App-functionaliteit; Accountbeheer; Fraudepreventie, beveiliging en naleving |
| Andere berichten in de app | `PSL_OTHER_MESSAGES` | vereist | App-functionaliteit |
| Foto's | `PSL_PHOTOS` | optioneel | App-functionaliteit; Accountbeheer |
| Video's | `PSL_VIDEOS` | optioneel, tijdelijk verwerkt | App-functionaliteit |
| Audio | `PSL_AUDIO` | optioneel, tijdelijk verwerkt | App-functionaliteit |
| Contacten | `PSL_CONTACTS` | vereist | App-functionaliteit; Fraudepreventie, beveiliging en naleving |
| Crashlogs | `PSL_CRASH_LOGS` | vereist | App-functionaliteit; Analyse |
| Diagnostische gegevens | `PSL_PERFORMANCE_DIAGNOSTICS` | vereist | App-functionaliteit; Analyse |
| App-interacties | `PSL_USER_INTERACTION` | vereist | App-functionaliteit; Fraudepreventie, beveiliging en naleving |
| Andere acties | `PSL_OTHER_APP_ACTIVITY` | vereist | App-functionaliteit; Fraudepreventie, beveiliging en naleving |
| Apparaat- of andere ID's | `PSL_DEVICE_ID` | vereist | App-functionaliteit; Fraudepreventie, beveiliging en naleving |

## Niet selecteren

Selecteer voor deze release geen precieze locatie. Het gemergde manifest van
v80 bevat geen locatiepermissie en de verpakte Permissions Policy blokkeert
geolocatie. Selecteer evenmin financiële gegevens, gezondheid en fitness,
agenda, geïnstalleerde apps, sms/mms, webbrowsegeschiedenis of advertentie-ID's;
daarvoor is in de beoordeelde release geen codebewijs gevonden.

## Controle na invoer

1. Exporteer de bijgewerkte CSV opnieuw vanuit Play Console.
2. Laat de ruwe export buiten Git staan.
3. Voer uit:

```bash
npm run verify:play-console-release-evidence -- \
  --csv /pad/naar/data_safety_export.csv \
  --upload-cert-sha256 '70:24:15:2E:B1:99:D7:B3:59:F3:8F:A3:85:07:84:14:32:C2:74:7D:AD:88:DC:F0:35:B3:12:44:43:A8:88:52'
```

De controle moet zonder ontbrekende of onverwachte typen eindigen. Dit blad
vervangt niet het machineleesbare antwoordplan in
`security/android-data-safety/release-1.0.24-v80-response-plan.json`.
