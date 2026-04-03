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
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export default function ElektronischeCommunicatieBeleidPagina() {
  return (
    <LegalPageLayout
      badge="Elektronische communicatie"
      title="AVG-beleid voor elektronische communicatie"
      intro="Dit beleid richt zich specifiek op de vertrouwelijkheid, beveiliging, toegang, bewaring en verwerking van communicatiegegevens binnen Pulse. Het document vult het algemene privacybeleid aan en is geschreven voor een Europese, kindgerichte communicatiedienst."
      lastUpdated="30 maart 2026"
      canonical="https://pulse-frontend-elt.pages.dev/avg-beleid-elektronische-communicatie"
      metaTitle="AVG-beleid voor elektronische communicatie van Pulse"
      metaDescription="Lees hoe Pulse omgaat met vertrouwelijkheid, metadata, bewaartermijnen en beveiliging van chat-, bel- en videocommunicatie."
    >
      <LegalSection title="Inleiding">
        <p>
          Voor Pulse is elektronische communicatie de kern van de dienst. Juist daarom gelden er hoge eisen aan vertrouwelijkheid,
          minimale gegevensverwerking, beperkte toegang en passende beveiliging. Dit beleid legt uit hoe Pulse met communicatiegegevens
          omgaat binnen chatten, bellen en videobellen.
        </p>
      </LegalSection>

      <LegalSection title="Doel en reikwijdte van dit beleid">
        <p>
          Dit beleid is van toepassing op de verwerking van gegevens die samenhangen met elektronische communicatie binnen Pulse,
          waaronder berichten, oproepen, videocommunicatie, technische metadata, beveiligingslogs en daarmee verbonden support- of
          incidentgegevens.
        </p>
      </LegalSection>

      <LegalSection title="Wat onder elektronische communicatie binnen Pulse valt">
        <ul className="legal-list">
          <li>het uitwisselen van tekstberichten;</li>
          <li>het opzetten, ontvangen en afhandelen van spraakoproepen;</li>
          <li>het opzetten, ontvangen en afhandelen van videogesprekken;</li>
          <li>de technische processen die nodig zijn om die communicatie veilig en betrouwbaar te laten functioneren.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Vertrouwelijkheid van communicatie als uitgangspunt">
        <p>
          Vertrouwelijkheid van communicatie is voor Pulse een fundamenteel uitgangspunt. Communicatie wordt binnen Pulse niet
          behandeld als grondstof voor advertenties, profilering of gedragsoptimalisatie. Pulse is gebouwd voor contact, niet voor
          aandachtsextractie of behavioural targeting.
        </p>
        <p>
          Dat uitgangspunt is extra belangrijk omdat Pulse is ontworpen voor kinderen en families. Juist in een kindgerichte
          omgeving moeten toegang, zichtbaarheid en verdere verwerking van communicatiegegevens beperkt en zorgvuldig zijn.
        </p>
      </LegalSection>

      <LegalSection title="Welke communicatievormen Pulse ondersteunt">
        <ul className="legal-list">
          <li>chatten;</li>
          <li>bellen;</li>
          <li>videobellen.</li>
        </ul>
        <p>
          Pulse ondersteunt geen open sociale interactie, algoritmische aanbevelingen of entertainmentfuncties rond communicatie.
        </p>
      </LegalSection>

      <LegalSection title="Welke communicatiegegevens kunnen worden verwerkt">
        <ul className="legal-list">
          <li>inhoud van tekstberichten;</li>
          <li>gegevens die nodig zijn om oproepen en videogesprekken tot stand te brengen;</li>
          <li>afzender- en ontvangerrelaties binnen het trusted contacts model;</li>
          <li>tijdstippen van verzending, aflevering, oproepstart of oproepeinde;</li>
          <li>technische metadata die nodig zijn voor routering, synchronisatie, stabiliteit en beveiliging;</li>
          <li>beveiligings- en integriteitslogs;</li>
          <li>support- of incidentgegevens wanneer storingen, misbruik of meldingen moeten worden onderzocht.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Onderscheid tussen inhoud van communicatie en technische metadata">
        <p>
          Pulse maakt onderscheid tussen de inhoud van communicatie, zoals tekstberichten, en technische metadata, zoals
          tijdstippen, afleverstatus of sessie-informatie. Niet elke technische verwerking heeft dezelfde gevoeligheid of dezelfde
          bewaarbehoefte, maar ook metadata vereist een terughoudende en doelgebonden benadering.
        </p>
      </LegalSection>

      <LegalSection title="Accountdata versus berichtdata versus logdata">
        <LegalSubsection title="Accountdata">
          <p>Gegevens die nodig zijn om accounts, rollen, authenticatie en contacttoestemmingen te beheren.</p>
        </LegalSubsection>
        <LegalSubsection title="Child account data">
          <p>Gegevens die samenhangen met het kinderaccount en de ouderlijk beheerde omgeving.</p>
        </LegalSubsection>
        <LegalSubsection title="Trusted contact data">
          <p>Gegevens van personen die als vertrouwd contact zijn toegelaten binnen het besloten communicatiemodel.</p>
        </LegalSubsection>
        <LegalSubsection title="Berichtdata">
          <p>Inhoud van chatberichten en de gegevens die nodig zijn om die berichten te verzenden, ontvangen en verwijderen.</p>
        </LegalSubsection>
        <LegalSubsection title="Call- en videocommunicatiegegevens">
          <p>Gegevens die nodig zijn om bel- en videocommunicatie technisch mogelijk te maken, af te handelen en te beveiligen.</p>
        </LegalSubsection>
        <LegalSubsection title="Technische metadata en security logs">
          <p>
            Gegevens over sessies, verbindingen, afleverstatus, foutafhandeling, misbruikpreventie en beveiligingsincidenten.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection title="Ouderlijk toezicht binnen elektronische communicatie">
        <p>
          Ouderlijk toezicht is een onderdeel van het veiligheidsmodel van Pulse. Dat betekent niet automatisch onbeperkte
          toegang van ouders tot alle communicatie-inhoud. Welke vormen van ouderlijk inzicht beschikbaar zijn, hangt af van de
          definitieve productinrichting en moet steeds worden afgewogen tegen veiligheid, proportionaliteit, vertrouwelijkheid van
          communicatie en de positie van het kind.
        </p>
      </LegalSection>

      <LegalSection title="Wie toegang heeft tot communicatiegegevens">
        <ul className="legal-list">
          <li>de gebruikers die deelnemen aan de communicatie binnen de Pulse-omgeving;</li>
          <li>bevoegde technische of operationele functionarissen, voor zover strikt noodzakelijk voor beveiliging of incidentafhandeling;</li>
          <li>verwerkers of infrastructuurpartijen, voor zover technisch noodzakelijk en onder passende contractuele waarborgen.</li>
        </ul>
        <p>
          Toegang is daarbij geen vrij uitgangspunt, maar moet steeds berusten op noodzaak, bevoegdheid en een passende
          juridische en organisatorische basis.
        </p>
      </LegalSection>

      <LegalSection title="Role-based access en beperkte toegang">
        <p>
          Pulse gebruikt of beoogt een role-based access model te gebruiken. Toegang tot communicatiegegevens is afhankelijk van
          rol, noodzaak en bevoegdheid. Kinderen gebruiken een beperkte omgeving, ouders beheren contacten en instellingen, en
          interne toegang wordt beperkt tot geautoriseerde personen met een aantoonbare noodzaak.
        </p>
        <p>
          Voor zover de huidige productinrichting dat ondersteunt, worden accountrollen, contacttoestemmingen en toegangsrechten
          niet als vrij wijzigbaar beschouwd, maar als onderdelen van een gecontroleerde en beperkte communicatieomgeving.
        </p>
      </LegalSection>

      <LegalSection title="Trusted contacts en besloten communicatieomgeving">
        <p>
          Pulse is gebaseerd op een trusted contacts model. Dat model beperkt communicatie tot een besloten kring en ondersteunt
          daarmee zowel kindveiligheid als vertrouwelijkheid van communicatie. Het voorkomt dat Pulse functioneert als een open
          sociaal netwerk of als een kanaal voor contact met onbekenden.
        </p>
      </LegalSection>

      <LegalSection title="Toegangsbeveiliging en authenticatie">
        <p>
          Pulse neemt of beoogt passende maatregelen te nemen voor toegangsbeveiliging, sessiebeheer en authenticatie. De
          concrete invulling hangt af van de definitieve implementatie en wordt waar nodig nader gespecificeerd.
        </p>
        <div className="legal-card">
          <p><strong>Beveiligings- of encryptiemodel:</strong> Pulse gebruikt versleuteling tijdens transport (TLS/SSL) en passende beveiliging van gegevensopslag. Pulse claimt geen end-to-end encryptie tenzij dat technisch is bevestigd en juridisch correct is beschreven.</p>
        </div>
        <p>
          Pulse claimt geen end-to-end encryptie of een ander specifiek cryptografisch model zolang dat niet feitelijk is
          bevestigd en juridisch correct is beschreven.
        </p>
      </LegalSection>

      <LegalSection title="Logging, monitoring en misbruikpreventie">
        <p>
          Beperkte logging en monitoring kunnen noodzakelijk zijn voor beschikbaarheid, foutopsporing, detectie van misbruik,
          fraudepreventie, beveiligingsonderzoek en incidentrespons. Zulke verwerking is niet bedoeld voor gedragsprofilering of
          commerciële analyse, maar voor veiligheid en integriteit van de dienst.
        </p>
      </LegalSection>

      <LegalSection title="Grondslagen voor verwerking van communicatiegegevens">
        <ul className="legal-list">
          <li><strong>Uitvoering van een overeenkomst</strong> voor zover nodig om chat-, bel- en videofuncties te leveren;</li>
          <li><strong>Gerechtvaardigd belang</strong> voor beveiliging, integriteit, misbruikpreventie en storingsanalyse;</li>
          <li><strong>Wettelijke verplichting</strong> indien bepaalde verwerking wettelijk vereist is;</li>
          <li><strong>Toestemming</strong> voor zover dat in een specifieke context juridisch nodig is.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Bewaartermijnen voor berichten, oproepgegevens, videocommunicatiegegevens en logbestanden">
        <div className="legal-grid">
          <div className="legal-card">
            <h3>Berichteninhoud</h3>
            <p>30 dagen</p>
          </div>
          <div className="legal-card">
            <h3>Oproepgegevens</h3>
            <p>30 dagen</p>
          </div>
          <div className="legal-card">
            <h3>Videocommunicatiegerelateerde data</h3>
            <p>30 dagen</p>
          </div>
          <div className="legal-card">
            <h3>Technische metadata</h3>
            <p>30 dagen</p>
          </div>
          <div className="legal-card">
            <h3>Logbestanden</h3>
            <p>30 dagen</p>
          </div>
          <div className="legal-card">
            <h3>Support- en incidentdossiers</h3>
            <p>30 dagen</p>
          </div>
        </div>
      </LegalSection>

      <LegalSection title="Verwijdering van berichten na 30 dagen">
        <p>
          Indien Pulse werkt met automatisch verwijderde berichten, wordt die werking transparant beschreven. Het uitgangspunt is
          dat communicatie-inhoud niet langer wordt bewaard dan nodig is voor aflevering, synchronisatie, beveiliging, redelijke
          herstelprocessen en toepasselijke wettelijke verplichtingen.
        </p>
      </LegalSection>

      <LegalSection title="Verwijdering of anonimisering van technische metadata waar mogelijk">
        <p>
          Waar mogelijk en passend streeft Pulse ernaar technische metadata tijdig te verwijderen, te beperken of te anonimiseren
          zodra individuele herleidbaarheid niet langer nodig is.
        </p>
      </LegalSection>

      <LegalSection title="Beveiligingsmaatregelen voor elektronische communicatie">
        <p>
          Voor elektronische communicatie neemt of beoogt Pulse passende beveiligingsmaatregelen te nemen, zoals beperkte interne
          toegang, sessie- en transportbeveiliging, beveiligingslogging en maatregelen tegen ongeautoriseerde toegang of accountovernames.
          De uiteindelijke technische invulling wordt gespecificeerd zodra die definitief is vastgesteld.
        </p>
      </LegalSection>

      <LegalSection title="Verwerkers en infrastructuur voor communicatievoorzieningen">
        <p>
          Voor chat-, bel- en videofunctionaliteit kan Pulse gebruikmaken van gespecialiseerde verwerkers of infrastructuurpartijen.
          Daarbij worden passende afspraken gemaakt over vertrouwelijkheid, beveiliging en verwerkingsinstructies.
        </p>
        <div className="legal-card">
          <p><strong>Cloudflare</strong> — frontend-hosting, content delivery, DDoS-beveiliging en netwerkbeveiliging van de website.</p>
          <p><strong>Railway</strong> — backend-hosting, deployment en technische infrastructuur van de API en servercomponenten van Pulse.</p>
          <p><strong>Google Firebase</strong> — database-infrastructuur, authenticatie en aanverwante backendfunctionaliteiten.</p>
          <p><strong>Resend</strong> — transactionele e-mailverzending (verificatiecodes en wachtwoordherstel).</p>
          <p><strong>Vimexx</strong> — domeinregistratie en domeinbeheer.</p>
        </div>
      </LegalSection>

      <LegalSection title="Doorgifte buiten de EER">
        <p>
          Voor zover communicatiegegevens of gerelateerde metadata buiten de EER worden verwerkt of toegankelijk zijn, treft Pulse
          passende waarborgen overeenkomstig de AVG.
        </p>
        <p>
          Persoonsgegevens kunnen worden verwerkt of toegankelijk zijn buiten de Europese Economische Ruimte, waaronder in de
          <strong> Verenigde Staten</strong>, via de volgende dienstverleners: Cloudflare (VS), Railway (VS), Google Firebase (VS)
          en Resend (VS). Vimexx is in Nederland gevestigd en valt binnen de EER.
        </p>
        <p>
          Voor doorgifte buiten de EER baseren wij ons op passende doorgiftemechanismen overeenkomstig de AVG, waaronder
          het EU-U.S. Data Privacy Framework, de Europese Standard Contractual Clauses (SCC's) en, waar van toepassing,
          adequaatheidsbesluiten van de Europese Commissie.
        </p>
      </LegalSection>

      <LegalSection title="Datalekken, incidenten en meldplicht">
        <p>
          Wanneer zich een beveiligingsincident of datalek voordoet, beoordeelt Pulse de aard en omvang van het incident, de
          betrokken gegevenscategorieën en de risico’s voor betrokkenen. Waar vereist handelt Pulse conform de meldplichten onder
          de AVG.
        </p>
      </LegalSection>

      <LegalSection title="Rechten van gebruikers en ouders">
        <p>
          Gebruikers en, waar passend, ouders of wettelijke vertegenwoordigers hebben rechten onder de AVG, waaronder inzage,
          rectificatie, verwijdering, beperking, bezwaar en — voor zover van toepassing — dataportabiliteit. Bij verzoeken over
          communicatiegegevens kan een zorgvuldige afweging nodig zijn tussen vertrouwelijkheid van communicatie, veiligheid van
          kinderen, rechten van andere betrokkenen en wettelijke bewaarplichten.
        </p>
      </LegalSection>

      <LegalSection title="Wijzigingen in dit beleid">
        <p>
          Pulse kan dit beleid aanpassen wanneer wetgeving, productinrichting, infrastructuur of interne processen wijzigen. De
          meest recente versie wordt gepubliceerd op de website van Pulse.
        </p>
      </LegalSection>

      <LegalSection title="Contactpunt voor privacy en elektronische communicatie">
        <div className="legal-card">
          <p><strong>Pulse Messenger</strong></p>
          <p>info@pulse-messenger.com</p>
          <p>Willem III Straat 36</p>
          <p>2291TM Wateringen</p>
          <p>[FUNCTIONARIS GEGEVENSBESCHERMING]</p>
        </div>
      </LegalSection>

      <section className="legal-section legal-section--closing">
        <p>
          Met dit beleid wil Pulse duidelijk maken dat vertrouwelijkheid van elektronische communicatie in een kindgerichte dienst
          om extra zorgvuldigheid vraagt. Beperkte toegang, ouderlijke governance, trusted contacts en minimale verwerking zijn
          geen bijzaken, maar een essentieel onderdeel van het productontwerp.
        </p>
      </section>
    </LegalPageLayout>
  );
}
