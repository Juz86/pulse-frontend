# Realtime synchronisatie: test met twee gebruikers

Open Pulse met gebruiker A en B in twee afzonderlijke browsers (of een browser
en een apparaat). Laat beide verbindingen open. Controleer bij elke stap dat de
ontvanger zijn lijst zonder navigeren of handmatig verversen ziet veranderen.

| Actie door A | Verwachting bij B | Popup bij B |
| --- | --- | --- |
| Stuur een bericht in een bestaand gesprek | Chatlijst en, indien geopend, berichtweergave verversen direct | Alleen systeemmelding voor een nieuw bericht wanneer de chat niet actief is |
| Bewerk, verwijder en reageer op een bericht | Gespreksvoorvertoning en actieve berichtweergave zijn actueel | Nee |
| Maak een 1-op-1- of groepsgesprek | Nieuwe chat verschijnt direct in de chatlijst | Nee |
| Hernoem een groep | Nieuwe naam verschijnt in lijst en geopende header | Nee |
| Voeg een groepslid toe, verwijder het, ontbind de groep of wis de geschiedenis | Chatlijst en actieve chat worden direct aangepast | Nee |
| Vraag B als beheerder | B ontvangt het beheerverzoek; na acceptatie ziet B de nieuwe rol | Alleen voor het gerichte beheerverzoek/de toegekende rol |
| Stuur een vriendschapsverzoek | Verzoekenlijst van B ververst direct | Ja, één uitnodigingsmelding |
| Accepteer of annuleer een vriendschapsverzoek | Contacten en inkomende/uitgaande verzoeken zijn direct correct bij de andere gebruiker | Alleen bij acceptatie voor de oorspronkelijke aanvrager |
| Pas een profielfoto of naam aan | Contact- en gesprekslijsten tonen de actuele gegevens | Nee |
| Blokkeer, deblokkeer of verwijder een contact via ouderlijk toezicht | Contact-, blokkeer- en gesprekslijsten zijn direct correct | Nee |
| Zet B offline, voer bovenliggende acties uit, zet B weer online | Bij reconnect worden chat-, contact-, verzoek- en blokkeerlijsten volledig herladen | Nee voor de ingehaalde statuswijzigingen |

Herhaal de reconnect-stap terwijl meerdere acties snel na elkaar plaatsvinden.
Daarbij mag de interface niet flikkeren of meerdere gelijke pop-ups tonen; de
synclaag voegt refreshes per domein kort samen.
