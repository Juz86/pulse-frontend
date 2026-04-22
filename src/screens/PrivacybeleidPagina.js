import React from 'react';
import LegalPageLayout from '../components/LegalPageLayout';

function LegalSection({ title, children }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      <div className="legal-section-body">{children}</div>
    </section>
  );
}

function LegalSubsection({ title, children }) {
  return (
    <div className="legal-subsection">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export default function PrivacybeleidPagina() {
  return (
    <LegalPageLayout
      badge="Privacybeleid"
      title="Privacybeleid"
      intro="Dit privacybeleid legt uit hoe Pulse persoonsgegevens verwerkt van ouders, kinderen en vertrouwde contacten. Het document is geschreven voor een kindgerichte communicatiedienst en is bedoeld als een zorgvuldige, publiceerbare eerste versie die later juridisch kan worden verfijnd."
      lastUpdated="30 maart 2026"
      canonical="/privacybeleid"
      metaTitle="Privacybeleid van Pulse"
      metaDescription="Lees hoe Pulse persoonsgegevens verwerkt van ouders, kinderen en vertrouwde contacten binnen een veilige communicatieomgeving voor families."
    >
      <LegalSection title="Inleiding">
        <p>
          Pulse is ontwikkeld als een veilige communicatieomgeving voor kinderen en families. Pulse is geen socialmediaplatform.
          De dienst is bedoeld voor chatten op web en bellen of videobellen in de app binnen een besloten omgeving met vertrouwde contacten, onder
          ouderlijke regie. Dat productontwerp is leidend voor hoe wij met persoonsgegevens omgaan.
        </p>
        <p>
          In dit privacybeleid beschrijven wij welke persoonsgegevens Pulse kan verwerken, waarom wij dat doen, op welke
          grondslagen wij ons beroepen, hoe lang wij gegevens bewaren, met wie wij gegevens delen en welke rechten betrokkenen
          hebben. Waar definitieve keuzes over techniek, infrastructuur of bewaartermijnen nog niet zijn vastgesteld, gebruiken wij
          expliciete placeholders.
        </p>
      </LegalSection>

      <LegalSection title="Wie verantwoordelijk is voor de verwerking">
        <div className="legal-card">
          <p><strong>Pulse Messenger</strong></p>
        </div>
      </LegalSection>

      <LegalSection title="Op wie dit privacybeleid van toepassing is">
        <ul className="legal-list">
          <li>ouders of wettelijke vertegenwoordigers die een Pulse-account aanmaken of beheren;</li>
          <li>kinderen voor wie via een ouder een kinderaccount wordt ingericht;</li>
          <li>vertrouwde contacten die binnen de Pulse-omgeving worden toegevoegd of beheerd;</li>
          <li>bezoekers van de Pulse-website, voor zover daarbij persoonsgegevens worden verwerkt.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Waarvoor Pulse bedoeld is">
        <p>
          Pulse is bedoeld voor veilige, rustige en familiegerichte communicatie. De kernfuncties zijn chatten, bellen en
          videobellen. Pulse bevat nadrukkelijk geen foto’s delen, GIFs, algoritmes, eindeloos scrollen of entertainment-first
          functies. Die keuzes zijn niet alleen productmatig, maar ook privacyrelevant: Pulse probeert alleen die gegevens te
          verwerken die nodig zijn voor accountbeheer, toegangscontrole, veilige communicatie en beveiliging.
        </p>
      </LegalSection>

      <LegalSection title="Welke persoonsgegevens wij verwerken">
        <LegalSubsection title="Gegevens van ouders">
          <ul className="legal-list">
            <li>naam en contactgegevens, zoals e-mailadres;</li>
            <li>inloggegevens en authenticatiegerelateerde gegevens;</li>
            <li>accountinstellingen en voorkeuren;</li>
            <li>gegevens over kinderaccounts die door de ouder zijn aangemaakt of beheerd;</li>
            <li>gegevens over contactgoedkeuringen, toestemmingen en beheerhandelingen;</li>
            <li>support- en correspondentiegegevens.</li>
          </ul>
        </LegalSubsection>

        <LegalSubsection title="Gegevens van kinderen">
          <ul className="legal-list">
            <li>een door de ouder aangemaakt accountprofiel;</li>
            <li>een unieke, ouder-beheerde gebruikersnaam;</li>
            <li>beperkte profielgegevens die nodig zijn voor herkenning binnen Pulse;</li>
            <li>gegevens over toegestane vertrouwde contacten;</li>
            <li>communicatiegerelateerde gegevens die nodig zijn om de dienst technisch te laten functioneren;</li>
            <li>beveiligings- en loggegevens die nodig zijn voor veiligheid, integriteit en toegangscontrole.</li>
          </ul>
        </LegalSubsection>

        <LegalSubsection title="Gegevens van vertrouwde contacten">
          <ul className="legal-list">
            <li>naam en identificerende contactgegevens die nodig zijn om hen te koppelen binnen Pulse;</li>
            <li>account- of toegangsgegevens, als zij zelf een Pulse-account gebruiken;</li>
            <li>gegevens over hun relatie tot het kind of gezin, voor zover nodig voor veilig contactbeheer;</li>
            <li>beperkte technische en beveiligingsgegevens.</li>
          </ul>
        </LegalSubsection>

        <LegalSubsection title="Accountgegevens, profielgegevens en gebruikersnamen">
          <p>
            Pulse maakt onderscheid tussen accountgegevens en communicatiegegevens. Accountgegevens zijn bijvoorbeeld naam,
            e-mailadres, rol, gebruikersnaam, accountinstellingen en authenticatiegegevens. Gebruikersnamen binnen Pulse zijn
            uniek en worden beheerd binnen het ouderlijke governance-model.
          </p>
        </LegalSubsection>

        <LegalSubsection title="Communicatiegerelateerde gegevens">
          <p>
            Naast accountgegevens verwerkt Pulse gegevens die samenhangen met de communicatievoorzieningen, zoals informatie die
            nodig is om berichten, oproepen en videogesprekken te verzenden, af te leveren, te synchroniseren en te beveiligen.
            Daarbij maken wij in beginsel onderscheid tussen inhoud van communicatie, technische metadata en beveiligings- of
            loggegevens die nodig zijn om de dienst betrouwbaar en veilig te laten functioneren.
            Voor een meer gerichte uitleg daarover verwijzen wij ook naar het afzonderlijke AVG-beleid voor elektronische communicatie.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection title="Waarom wij persoonsgegevens verwerken">
        <ul className="legal-list">
          <li>om ouderaccounts en kinderaccounts aan te maken en te beheren;</li>
          <li>om veilige communicatie tussen kinderen en vertrouwde contacten mogelijk te maken;</li>
          <li>om contacten, toestemmingen en ouderlijk toezicht te beheren;</li>
          <li>om accounts en systemen te beveiligen;</li>
          <li>om misbruik, fraude of ongeautoriseerde toegang te voorkomen en onderzoeken;</li>
          <li>om support te verlenen;</li>
          <li>om te voldoen aan wettelijke verplichtingen;</li>
          <li>om de stabiliteit en veiligheid van de dienst te verbeteren, voor zover dat past bij het privacy-first karakter van Pulse.</li>
        </ul>
        <p>
          Pulse verwerkt persoonsgegevens niet voor advertenties, gedragsprofilering, aanbevelingsalgoritmes of engagement-optimalisatie.
        </p>
      </LegalSection>

      <LegalSection title="Op welke wettelijke grondslagen wij persoonsgegevens verwerken">
        <ul className="legal-list">
          <li><strong>Uitvoering van een overeenkomst</strong> voor zover verwerking nodig is om Pulse te leveren.</li>
          <li><strong>Gerechtvaardigd belang</strong> voor passende beveiliging, fraudepreventie, logging en integriteitsbewaking.</li>
          <li><strong>Wettelijke verplichting</strong> wanneer wet- of regelgeving bepaalde verwerking vereist.</li>
          <li><strong>Toestemming</strong> voor zover dat in een specifieke context nodig is, bijvoorbeeld rond bepaalde websitefunctionaliteit.</li>
        </ul>
        <p>
          Waar verwerking betrekking heeft op kinderen, wordt extra terughoudendheid betracht en is ouderlijke betrokkenheid een
          kernonderdeel van de dienst.
        </p>
      </LegalSection>

      <LegalSection title="Ouderlijk toezicht en de rol van ouders bij kinderaccounts">
        <p>
          Binnen Pulse maakt de ouder in beginsel het kinderaccount aan en beheert die ouder ook de relevante instellingen,
          toestemmingen en toegestane contacten. Het kind gebruikt een beperkte, rolgebaseerde omgeving. Dat betekent dat het
          kind niet zelfstandig een open sociaal profiel kan opbouwen of vrij nieuwe contacten kan toevoegen buiten het door de
          ouder beheerde model.
        </p>
        <p>
          Voor zover de uiteindelijke productinrichting daarin voorziet, kunnen ouders daarnaast functies beheren die samenhangen
          met toegang, contacten en communicatieopties van het kinderaccount. Welke beheermogelijkheden precies beschikbaar zijn,
          hangt af van de definitieve implementatie van Pulse.
        </p>
      </LegalSection>

      <LegalSection title="Trusted contacts en contactbeheer">
        <p>
          Pulse werkt met een trusted contacts model. Dat model is bedoeld om contact te beperken tot personen die binnen de
          veilige omgeving zijn toegelaten. Geen open netwerk, geen onbeperkte vindbaarheid, geen communicatie met onbekenden
          als standaard. Voor de uitvoering van dit model kunnen persoonsgegevens worden verwerkt die nodig zijn om contacten te
          identificeren, te koppelen, te beheren en te beveiligen.
        </p>
        <p>
          Dit model is een belangrijk onderdeel van de veiligheidsarchitectuur van Pulse: het beperkt de kring van mogelijke
          communicatiepartners en ondersteunt ouderlijke regie, dataminimalisatie en een besloten communicatieomgeving.
        </p>
      </LegalSection>

      <LegalSection title="Hoe wij omgaan met persoonsgegevens van kinderen">
        <ul className="legal-list">
          <li>wij streven naar dataminimalisatie;</li>
          <li>de zichtbaarheid van profielgegevens is beperkt;</li>
          <li>contactmogelijkheden zijn ouder-governed en restricted;</li>
          <li>de omgeving is privacy by design en privacy by default ingericht;</li>
          <li>wij verwerken geen gegevens van kinderen voor advertenties of gedragssturing;</li>
          <li>waar mogelijk hanteren wij beperkte bewaartermijnen.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Hoe lang wij gegevens bewaren">
        <p>
          Wij bewaren persoonsgegevens niet langer dan nodig is voor de doeleinden waarvoor zij zijn verzameld of verwerkt, tenzij
          een langere bewaartermijn wettelijk verplicht of aantoonbaar noodzakelijk is. De concrete bewaartermijn verschilt per
          gegevenscategorie en kan in specifieke gevallen langer zijn als dat nodig is voor beveiliging, incidentonderzoek,
          geschilafhandeling of naleving van wettelijke verplichtingen.
        </p>
      </LegalSection>

      <LegalSection title="Bewaartermijnen per categorie gegevens">
        <div className="legal-grid">
          <div className="legal-card">
            <h2>Accountgegevens ouders</h2>
            <p>Zolang account actief is.</p>
          </div>
          <div className="legal-card">
            <h2>Accountgegevens kinderen</h2>
            <p>Zolang account actief is.</p>
          </div>
          <div className="legal-card">
            <h2>Vertrouwde contacten</h2>
            <p>Zolang gekoppeld.</p>
          </div>
          <div className="legal-card">
            <h2>Berichten en communicatie-inhoud</h2>
            <p>Standaard 30 dagen, ouder kan 24 uur, 7 dagen of 14 dagen kiezen.</p>
          </div>
          <div className="legal-card">
            <h2>Logbestanden</h2>
            <p>7 dagen</p>
          </div>
          <div className="legal-card">
            <h2>Support- en privacyverzoeken</h2>
            <p>30 dagen</p>
          </div>
        </div>
      </LegalSection>

      <LegalSection title="Delen wij gegevens met derden?">
        <p>
          Wij verkopen geen persoonsgegevens. Wij delen persoonsgegevens alleen wanneer dat noodzakelijk is voor het leveren van
          de dienst, hosting, technische ondersteuning, beveiliging, communicatievoorzieningen of om te voldoen aan een wettelijke
          verplichting. Wij proberen gegevensdeling daarbij zoveel mogelijk te beperken.
        </p>
      </LegalSection>

      <LegalSection title="Verwerkers, hosting en technische dienstverleners">
        <p>
          Pulse kan gebruikmaken van verwerkers of technische dienstverleners voor bijvoorbeeld hosting, authenticatie, logging,
          support en communicatievoorzieningen. Voor zover van toepassing sluiten wij met zulke partijen verwerkersovereenkomsten.
        </p>
        <div className="legal-card">
          <p>Cloudflare - voor frontend-hosting, content delivery, netwerkbeveiliging en technische bescherming van de website.</p>
          <p>Railway - voor hosting, deployment en technische infrastructuur van de backenddiensten en API van Pulse.</p>
          <p>Google Firebase - voor database-infrastructuur en, voor zover gebruikt binnen de dienst, aanverwante backendfunctionaliteiten zoals authenticatie en opslag.</p>
          <p>Vimexx - voor domeinregistratie en domeinbeheer.</p>
          <p><strong>Hosting- en technische partijen:</strong> Cloudflare (frontend-hosting), Railway (backend-hosting), Google Firebase (database-infrastructuur) en Vimexx (domeinregistratie en domeinbeheer).</p>
        </div>
      </LegalSection>

      <LegalSection title="Doorgifte buiten de EER">
        <p>
          Als persoonsgegevens buiten de Europese Economische Ruimte worden verwerkt of toegankelijk zijn, zorgen wij voor een
          passende juridische grondslag en passende waarborgen overeenkomstig de AVG.
        </p>
        <p>
          Persoonsgegevens kunnen worden verwerkt of toegankelijk zijn buiten de EER, waaronder in de Verenigde Staten,
          bijvoorbeeld via Cloudflare, Railway en Google Firebase. Als sprake is van doorgifte buiten de EER, baseren wij die op
          een passend doorgiftemechanisme, zoals een adequaatheidsbesluit, het EU-U.S. Data Privacy Framework of de Europese
          Standard Contractual Clauses (SCC’s), aangevuld met passende waarborgen waar nodig.
        </p>
      </LegalSection>

      <LegalSection title="Beveiliging van persoonsgegevens">
        <p>
          Wij nemen passende technische en organisatorische maatregelen om persoonsgegevens te beschermen tegen verlies, misbruik,
          ongeautoriseerde toegang en onrechtmatige verwerking. Denk aan toegangsbeperking op basis van rollen, authenticatiemaatregelen,
          logging van beveiligingsrelevante gebeurtenissen en passende beveiliging van opslag en transport. Dit beleid claimt geen
          technische maatregelen die nog niet definitief zijn bevestigd.
        </p>
      </LegalSection>

      <LegalSection title="Privacy by design en dataminimalisatie">
        <p>
          Pulse probeert privacy niet achteraf toe te voegen, maar vanaf het ontwerp mee te nemen. Dat betekent onder meer:
          beperkte functionaliteit, geen entertainment-first patronen, restricted trusted contacts, ouderlijk beheer, beperkte
          profielinformatie en terughoudende bewaartermijnen.
        </p>
      </LegalSection>

      <LegalSection title="Rechten van betrokkenen onder de AVG">
        <ul className="legal-list">
          <li>recht op inzage;</li>
          <li>recht op rectificatie;</li>
          <li>recht op verwijdering;</li>
          <li>recht op beperking van de verwerking;</li>
          <li>recht op overdraagbaarheid van gegevens;</li>
          <li>recht van bezwaar;</li>
          <li>recht om toestemming in te trekken, als verwerking op toestemming berust.</li>
        </ul>
        <p>
          Deze rechten zijn niet absoluut. In sommige gevallen kunnen wettelijke verplichtingen, veiligheidsbelangen of rechten
          van anderen meebrengen dat een verzoek niet volledig kan worden ingewilligd.
        </p>
      </LegalSection>

      <LegalSection title="Rechten van ouders namens hun kind">
        <p>
          Omdat Pulse voor kinderen is ontworpen, kunnen ouders of wettelijke vertegenwoordigers in veel gevallen privacyrechten
          namens hun kind uitoefenen, voor zover dat past binnen toepasselijk recht en de positie van het kind. Bij zulke verzoeken
          houden wij rekening met de veiligheid van het kind, de rol van de ouder en de rechten van andere betrokkenen.
        </p>
      </LegalSection>

      <LegalSection title="Cookies en vergelijkbare technieken">
        <p>
          Voor de Pulse-website kunnen cookies of vergelijkbare technieken worden gebruikt voor basisfunctionaliteit, beveiliging,
          voorkeursinstellingen en — indien relevant — beperkte analyse. Verdere informatie volgt in:
        </p>
        <p>
          Op dit moment gebruikt de Pulse-website alleen functionele en technisch noodzakelijke cookies of vergelijkbare
          technieken. Wij gebruiken geen advertentiecookies en geen niet-noodzakelijke trackingcookies, tenzij dit later
          expliciet wordt toegevoegd.
        </p>
      </LegalSection>

      <LegalSection title="Contact opnemen over privacy">
        <div className="legal-card">
          <p><strong>Bedrijf:</strong> Pulse Messenger</p>
          <p><strong>E-mail:</strong> info@pulse-messenger.com</p>
        </div>
      </LegalSection>

      <LegalSection title="Klacht indienen bij de bevoegde toezichthouder">
        <p>
          Als u meent dat de verwerking van persoonsgegevens binnen Pulse in strijd is met de AVG, heeft u het recht een klacht
          in te dienen bij de bevoegde toezichthouder:
        </p>
        <p><strong>Autoriteit Persoonsgegevens (AP)</strong> - de Nederlandse toezichthouder voor de bescherming van persoonsgegevens. Meer informatie of een klacht indienen kan via: https://autoriteitpersoonsgegevens.nl</p>
      </LegalSection>

      <section className="legal-section legal-section--closing">
        <p>
          Pulse wil een veilige communicatiedienst zijn voor kinderen en families, met zo min mogelijk gegevensverwerking en zo
          veel mogelijk duidelijkheid. Dit privacybeleid is bedoeld als een zorgvuldige eerste websiteversie en moet waar nodig
          verder worden verfijnd zodra definitieve keuzes over infrastructuur, verwerkers en bewaartermijnen zijn vastgesteld.
        </p>
      </section>
    </LegalPageLayout>
  );
}
