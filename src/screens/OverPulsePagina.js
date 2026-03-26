import React, { useEffect, useRef, useState } from 'react';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import AuthModal from '../components/AuthModal';
import {
  AdminIcon,
  Bell,
  Check,
  Clock,
  EyeOn,
  Heart,
  Lock,
  Message,
  Phone,
  Shield,
  Users,
  Video,
} from '../components/Icons';

function useFadeIn() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return [ref, visible];
}

function SectionHeader({ badge, title, text }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} className={`hp-section-header fp-section-header${visible ? ' fp-visible' : ''}`}>
      {badge && <div className="fp-hero-badge" style={{ marginBottom: 16 }}>{badge}</div>}
      <h2>{title}</h2>
      {text && <p style={{ marginTop: 12 }}>{text}</p>}
    </div>
  );
}

function FadeCard({ children }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} className={`ot-row${visible ? ' fp-visible' : ''}`}>
      {children}
    </div>
  );
}

function FadeRow({ children, className = '' }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} className={`hp-feature-row ot-row${visible ? ' fp-visible' : ''} ${className}`}>
      {children}
    </div>
  );
}

function FeatureStrip() {
  return (
    <div className="op-feature-strip">
      <div className="op-strip-header">Pulse doet drie dingen</div>
      <div className="op-strip-item">
        <div className="op-strip-icon"><Message size={20} /></div>
        <div>
          <strong>Chatten</strong>
          <span>Veilig berichten sturen</span>
        </div>
      </div>
      <div className="op-strip-divider" />
      <div className="op-strip-item">
        <div className="op-strip-icon"><Phone size={20} /></div>
        <div>
          <strong>Bellen</strong>
          <span>Zonder telefoonnummer</span>
        </div>
      </div>
      <div className="op-strip-divider" />
      <div className="op-strip-item">
        <div className="op-strip-icon"><Video size={20} /></div>
        <div>
          <strong>Videobellen</strong>
          <span>Met vertrouwde contacten</span>
        </div>
      </div>
      <div className="op-strip-footer">
        <Shield size={13} /> &nbsp;AVG-compliant &nbsp;·&nbsp; 🇳🇱 Nederlands
      </div>
    </div>
  );
}

export default function OverPulsePagina({ onParentClick }) {
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [scrolled,      setScrolled]      = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  const navItems = [
    { key: 'functies',           label: 'Functies',           href: '/functies' },
    { key: 'hoe-werkt-het',      label: 'Hoe werkt het',      href: '/hoe-werkt-het' },
    { key: 'ouderlijk-toezicht', label: 'Ouderlijk toezicht', href: '/ouderlijk-toezicht' },
    { key: 'over-pulse',         label: 'Over Pulse',         onClick: () => scrollTo('footer') },
  ];

  const problemCards = [
    {
      icon: <Bell size={22} />,
      title: 'Gemaakt voor verslaving',
      text: 'Populaire apps zijn ontworpen om zoveel mogelijk tijd te stelen. Oneindige feeds, notificaties, foto\'s en gif\'s — gebouwd op gedragspatronen die zelfs voor volwassenen uitdagend zijn.',
    },
    {
      icon: <EyeOn size={22} />,
      title: 'Kinderen zijn het product',
      text: 'Bij gratis apps betaal je met data. Elk bericht, elke interactie wordt gevolgd en verwerkt. Voor kinderen is dat niet alleen onwenselijk — het is ook niet AVG-proof.',
    },
    {
      icon: <Shield size={22} />,
      title: 'Ouders staan buitenspel',
      text: 'De meeste apps bieden ouders weinig tot geen inzicht in wat er gebeurt. Wie stuurt wie een bericht? Met wie chat mijn kind? Pulse geeft ouders het overzicht terug.',
    },
  ];

  const pulseIs = [
    'Chatten met vertrouwde contacten',
    'Bellen en videobellen zonder telefoonnummer',
    'Ouderlijk toezicht en contactbeheer',
    'AVG-compliant en privacy-first',
    'Rustig, overzichtelijk en afleidingsvrij',
    'Berichten die na 30 dagen automatisch verdwijnen',
  ];

  const pulseIsNot = [
    'Geen foto\'s of GIFs',
    'Geen algoritmes of aanbevelingen',
    'Geen advertenties of dataverzameling',
    'Geen onbekende contacten mogelijk',
    'Geen entertainment of spelletjes',
    'Geen social media-elementen',
  ];

  const coreFeatures = [
    {
      icon: <Shield size={22} />,
      title: 'Veiligheid by design',
      text: 'Pulse is gebouwd met veiligheid als startpunt, niet als nagedachte. Geen media-deling betekent: cyberpesten via foto\'s of gif\'s is structureel onmogelijk.',
    },
    {
      icon: <Users size={22} />,
      title: 'Alleen vertrouwde contacten',
      text: 'Kinderen communiceren uitsluitend met mensen die door de ouder zijn goedgekeurd. Geen onbekenden, geen verzoeken van vreemden.',
    },
    {
      icon: <Lock size={22} />,
      title: 'Ouders in regie',
      text: 'Het ouderportaal geeft real-time inzicht. Chat, bellen of videobellen pauzeren per functie. Direct een melding bij nieuwe contacten.',
    },
    {
      icon: <Bell size={22} />,
      title: 'Rust en overzicht',
      text: 'Geen notificatieregen, geen eindeloos scrollen. Pulse is kalm, helder en gericht — precies wat kinderen en ouders nodig hebben.',
    },
  ];

  const topics = [
    'Schermtijd bij kinderen',
    'Verslavend app-design',
    'Online veiligheid',
    'Cyberpesten',
    'Privacy & AVG',
    'Smartphonegebruik op scholen',
    'Kinderen en sociale media',
    'Digitaal welzijn',
  ];

  const audiences = [
    {
      icon: <Heart size={22} />,
      title: 'Gezinnen',
      text: 'Ouders die hun kind veilig willen laten communiceren met familie en vrienden. Opa en oma, neven en nichten, vertrouwde vriendjes van school — altijd bereikbaar, nooit onveilig.',
    },
    {
      icon: <Users size={22} />,
      title: 'Scholen',
      text: 'Basisscholen en middelbare scholen die zoeken naar een veilige communicatieoplossing voor leerlingen. Geen WhatsApp-groepen, geen uitsluiting, geen pesterij via media-deling.',
    },
    {
      icon: <AdminIcon size={22} />,
      title: 'Partners & organisaties',
      text: 'Telecomproviders, gemeenten, jeugdzorgorganisaties en andere partners die werken aan digitale veiligheid voor kinderen. Pulse biedt een compleet, klaar en AVG-compliant platform.',
    },
  ];

  return (
    <div className="hp-root">
      <MarketingNavbar
        items={navItems}
        activeKey="over-pulse"
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        scrolled={scrolled}
        onParentClick={onParentClick}
      />

      {/* ── HERO ── */}
      <section className="ot-hero op-hero">
        <div className="ot-hero-inner op-hero-inner">
          <div className="ot-hero-copy">
            <div className="fp-hero-badge">Over Pulse</div>
            <h1 className="ot-hero-title">
              Pulse is geen<br />sociale media.<br />Pulse is verbinding.
            </h1>
            <p className="ot-hero-sub">
              Wij geloven dat kinderen recht hebben op veilige, rustgevende communicatie — zonder algoritmes, zonder verslaving, zonder zorgen. Pulse is daarvoor gebouwd.
            </p>
            <div className="ot-hero-actions">
              <button className="hp-cta-btn" onClick={() => onParentClick('register')}>Ouderaccount aanmaken</button>
              <button className="ot-secondary-btn" onClick={() => scrollTo('waarom-pulse')}>Meer lezen</button>
            </div>
          </div>
          <div className="ot-hero-visual">
            <FeatureStrip />
          </div>
        </div>
      </section>

      {/* ── WAAROM PULSE BESTAAT ── */}
      <section className="hp-section" id="waarom-pulse">
        <div className="hp-section-inner">
          <SectionHeader
            badge="Waarom Pulse bestaat"
            title="Kinderen verdienen beter dan de apps die nu bestaan"
            text="De huidige communicatie-apps zijn gemaakt voor volwassenen — of voor winst. Ze zijn niet gebouwd met het welzijn van kinderen als vertrekpunt. Pulse wel."
          />
          <div className="hp-why-grid" style={{ marginTop: 48 }}>
            {problemCards.map((card) => (
              <FadeCard key={card.title}>
                <div className="hp-why-card">
                  <div className="op-feature-icon">{card.icon}</div>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </div>
              </FadeCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── EEN VEILIG ALTERNATIEF ── */}
      <section className="hp-section hp-section--gray" id="veilig-alternatief">
        <div className="hp-section-inner">
          <SectionHeader
            badge="Een veilig alternatief"
            title="Pure communicatie, zonder afleiding"
            text="Pulse is bewust gestript van alles wat niet bijdraagt aan veilig contact. Het resultaat: een app die doet wat het belooft — en niets meer dan dat."
          />
          <div className="op-compare-row">
            <div className="op-compare-col op-compare-col--yes">
              <div className="op-compare-label op-compare-label--yes">Pulse is</div>
              <ul className="ot-feature-list">
                {pulseIs.map((item) => (
                  <li key={item}>
                    <span className="ot-feature-check"><Check size={14} /></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="op-compare-col op-compare-col--no">
              <div className="op-compare-label op-compare-label--no">Pulse is niet</div>
              <ul className="ot-feature-list">
                {pulseIsNot.map((item) => (
                  <li key={item} className="op-not-item">
                    <span className="op-not-check">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── ONTWORPEN VOOR KINDEREN ── */}
      <section className="hp-section" id="voor-kinderen">
        <div className="hp-section-inner">
          <SectionHeader
            badge="Ontworpen voor kinderen"
            title="Met ouders in regie, voor kinderen in vrijheid"
            text="Pulse geeft kinderen de vrijheid om contact te houden met de mensen die echt belangrijk zijn — binnen een veilige omgeving die ouders volledig in de hand hebben."
          />
          <div className="hp-why-grid op-feature-grid" style={{ marginTop: 48 }}>
            {coreFeatures.map((f) => (
              <FadeCard key={f.title}>
                <div className="hp-why-card">
                  <div className="op-feature-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              </FadeCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRIVACY EN VEILIGHEID ── */}
      <section className="hp-section hp-section--gray" id="privacy">
        <div className="hp-section-inner">
          <FadeRow>
            <div className="hp-feature-text">
              <div className="hp-feature-tag">Privacy &amp; AVG</div>
              <h3>Privacy als fundament, niet als bijzaak</h3>
              <p>Bij Pulse is privacy geen checkbox. Het is het vertrekpunt van elke ontwerpbeslissing. We verzamelen alleen wat strikt noodzakelijk is, en bewaren het niet langer dan nodig.</p>
              <ul className="ot-feature-list" style={{ marginTop: 24 }}>
                <li><span className="ot-feature-check"><Check size={14} /></span>Volledig AVG-compliant</li>
                <li><span className="ot-feature-check"><Check size={14} /></span>Geen profilering of dataverzameling voor advertenties</li>
                <li><span className="ot-feature-check"><Check size={14} /></span>Berichten verdwijnen automatisch na 30 dagen</li>
                <li><span className="ot-feature-check"><Check size={14} /></span>Geen telefoonnummer vereist</li>
                <li><span className="ot-feature-check"><Check size={14} /></span>Geen media-deling — geen risico op verspreiding van beelden</li>
                <li><span className="ot-feature-check"><Check size={14} /></span>100% Nederlands, 100% transparant</li>
              </ul>
            </div>
            <div className="hp-feature-mockup">
              <div className="op-privacy-card">
                <div className="op-privacy-icon"><Lock size={32} /></div>
                <div className="op-privacy-title">AVG-compliant</div>
                <div className="op-privacy-sub">
                  Gebouwd voor de Nederlandse markt, met naleving van Europese privacywetgeving als basis. Geen dataverzameling voor commerciële doeleinden.
                </div>
                <div className="op-privacy-badges">
                  <span>🇳🇱 Nederlands</span>
                  <span><Lock size={12} /> Versleuteld</span>
                  <span><Clock size={12} /> 30 dagen</span>
                </div>
              </div>
            </div>
          </FadeRow>
        </div>
      </section>

      {/* ── WAAROM JUIST NU ── */}
      <section className="hp-section" id="juist-nu">
        <div className="hp-section-inner">
          <SectionHeader
            badge="Waarom juist nu"
            title="De wereld vraagt om een rustiger digitaal alternatief"
            text="De discussie over schermtijd, online veiligheid en verslavend app-design staat hoog op de agenda — van de Tweede Kamer tot ouderavonden op school. Er is een breed gedeeld gevoel dat het anders moet. Pulse is dat alternatief."
          />
          <div className="op-topic-grid">
            {topics.map((topic) => (
              <span key={topic} className="op-topic-pill">{topic}</span>
            ))}
          </div>
          <div className="op-statement">
            <blockquote>
              "Kinderen hebben geen sociale media nodig. Ze hebben contact nodig — met opa en oma, met hun beste vriend, met de ouder die op het werk is. Dat is waar Pulse voor is."
            </blockquote>
          </div>
        </div>
      </section>

      {/* ── VOOR GEZINNEN, SCHOLEN EN PARTNERS ── */}
      <section className="hp-section hp-section--gray" id="voor-wie">
        <div className="hp-section-inner">
          <SectionHeader
            badge="Voor wie is Pulse?"
            title="Voor gezinnen, scholen en partners"
            text="Pulse is relevant voor iedereen die werkt aan veilige digitale communicatie voor kinderen — van thuis tot op school."
          />
          <div className="hp-why-grid" style={{ marginTop: 48 }}>
            {audiences.map((a) => (
              <FadeCard key={a.title}>
                <div className="hp-why-card">
                  <div className="op-feature-icon">{a.icon}</div>
                  <h3>{a.title}</h3>
                  <p>{a.text}</p>
                </div>
              </FadeCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="ot-final-cta">
        <h2>Veilig verbonden. Met wie echt telt.</h2>
        <p>Pulse helpt gezinnen om in contact te blijven op een manier die vertrouwd, veilig en rustig voelt. Voor kinderen. Voor ouders. Voor iedereen die erom geeft.</p>
        <button className="hp-cta-btn" onClick={() => setShowAuthModal(true)}>Gratis account aanmaken</button>
      </section>

      <MarketingFooter />

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onParentClick={onParentClick}
        />
      )}
    </div>
  );
}
