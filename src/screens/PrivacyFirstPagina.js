// src/screens/PrivacyFirstPagina.js
import { useEffect, useRef, useState } from 'react';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import AuthModal from '../components/AuthModal';
import ParentAuthModal from '../components/ParentAuthModal';
import PageMeta from '../components/PageMeta';
import DecorativeAvatar, { avatarSvgs } from '../components/DecorativeAvatars';
import {
  Bell,
  Check,
  Clock,
  Lock,
  Login,
  Message,
  Shield,
  Users,
} from '../components/Icons';

function useFadeIn() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
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

function SectionHeader({ badge, title, text, align }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} className={`hp-section-header fp-section-header${align === 'left' ? ' hp-section-header--left' : ''}${visible ? ' fp-visible' : ''}`}>
      {badge && <div className="fp-hero-badge" style={{ marginBottom: 16 }}>{badge}</div>}
      <h2>{title}</h2>
      {text && <p style={{ marginTop: 12 }}>{text}</p>}
    </div>
  );
}

const retentionRows = [
  {
    label: 'Ouderaccount',
    duration: 'Zolang actief',
    why: 'Zodat je kunt inloggen en je kind kunt beheren.',
    onDelete: 'Direct verwijderd bij accountverwijdering',
  },
  {
    label: 'Kindaccount',
    duration: 'Zolang actief',
    why: 'Zodat je kind kan communiceren met vertrouwde contacten.',
    onDelete: 'Direct verwijderd bij accountverwijdering',
  },
  {
    label: 'Vertrouwde contacten',
    duration: 'Zolang verbonden',
    why: 'Zodat je kind weet met wie het mag communiceren.',
    onDelete: 'Direct verwijderd bij verwijdering van contact',
  },
  {
    label: 'Berichten & gesprekken',
    duration: '30 dagen',
    why: 'Zodat recente gesprekken leesbaar blijven.',
    onDelete: 'Automatisch verwijderd na 30 dagen',
  },
  {
    label: 'Logbestanden',
    duration: '7 dagen',
    why: 'Voor beveiliging en stabiliteit van de app.',
    onDelete: 'Automatisch verwijderd na 7 dagen',
  },
  {
    label: 'Supportverzoeken',
    duration: '30 dagen',
    why: 'Zodat we je vraag kunnen afhandelen.',
    onDelete: 'Automatisch verwijderd na 30 dagen',
  },
];

export default function PrivacyFirstPagina({ onParentClick }) {
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [scrolled,        setScrolled]        = useState(false);
  const [showAuthModal,   setShowAuthModal]   = useState(false);
  const [showParentModal, setShowParentModal] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navItems = [
    { key: 'privacy-first',      label: 'Privacy-First',      href: '/privacy-first' },
    { key: 'ouderlijk-toezicht', label: 'Ouderlijk toezicht', href: '/ouderlijk-toezicht' },
    { key: 'hoe-werkt-het',      label: 'Hoe werkt het',      href: '/hoe-werkt-het' },
    { key: 'functies',           label: 'Functies',           href: '/functies' },
  ];

  return (
    <div className="hp-root">
      <PageMeta
        title="Privacy-First — Pulse beschermt, verzamelt niet"
        description="Pulse is 100% privacy-first. Geen dataverzameling, geen algoritmes, geen profielen. Lees hoe Pulse omgaat met jouw gegevens — eerlijk, duidelijk en zonder jargon."
        canonical="https://pulse-messenger.com/privacy-first"
      />
      <MarketingNavbar
        items={navItems}
        activeKey="privacy-first"
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        scrolled={scrolled}
        onParentClick={onParentClick}
      />

      <main id="main-content">

        {/* ── HERO ── */}
        <section className="ot-hero op-hero hw-hero">
          <DecorativeAvatar svg={avatarSvgs.opTop}    className="fp-deco-avatar--hero-top" />
          <DecorativeAvatar svg={avatarSvgs.opBottom} className="fp-deco-avatar--hero-bottom" />
          <div className="ot-hero-inner op-hero-inner hw-hero-inner">
            <div className="ot-hero-copy hw-hero-copy marketing-hero-copy">
              <div className="fp-hero-badge">Privacy-First</div>
              <h1 className="ot-hero-title ot-hero-title--marketing">
                Jouw kind.<br />
                <span style={{ whiteSpace: 'nowrap' }}>Niet onze data.</span>
              </h1>
              <p className="ot-hero-sub">
                Pulse is gebouwd op één overtuiging: kinderen hebben recht op veilige communicatie — zonder dat iemand meekijkt, meeschrijft of hun gedrag analyseert. Wij ook niet.
              </p>
              <div className="ot-hero-actions">
                <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>
                  Ouderaccount aanmaken
                </button>
                <a href="/privacybeleid" className="ot-secondary-btn" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  Privacybeleid lezen
                </a>
              </div>
            </div>
            <div className="ot-hero-visual" aria-hidden="true">
              <div className="op-privacy-card" style={{ maxWidth: 320 }}>
                <div className="op-privacy-icon"><Shield size={36} /></div>
                <div className="op-privacy-title">100% Privacy-First</div>
                <div className="op-privacy-sub">
                  Geen dataverzameling.<br />
                  Geen algoritmes.<br />
                  Geen profielen.<br />
                  Verwijderen = echt verwijderen.
                </div>
                <div className="op-privacy-badges" style={{ marginTop: 20 }}>
                  <span>🇳🇱 Nederlands</span>
                  <span><Lock size={12} /> E2EE</span>
                  <span><Clock size={12} /> 30 dagen</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── WAAROM PULSE BESTAAT ── */}
        <section className="hp-section" id="waarom-pulse">
          <div className="hp-section-inner">
            <FadeRow className="op-privacy-row">
              <div className="hp-feature-text">
                <div className="hp-feature-tag">Het verhaal achter Pulse</div>
                <h3>Gemaakt door een vader die zich zorgen maakte</h3>
                <p>
                  Pulse is niet ontstaan in een vergaderzaal. Het begon met een simpele vraag van een vader: <em>"Waarom bestaat er geen communicatie-app die echt veilig is voor kinderen?"</em>
                </p>
                <p style={{ marginTop: 16 }}>
                  Hij zag hoe kinderen steeds vroeger smartphones kregen. Hoe ze blootgesteld werden aan dataverzameling, algoritmes en sociale druk — zonder dat ouders het doorhadden. Hoe grote techbedrijven winst maakten van het gedrag van kinderen.
                </p>
                <p style={{ marginTop: 16 }}>
                  Dat kon anders. Dat moest anders. Pulse is het antwoord.
                </p>
              </div>
              <div className="hp-feature-mockup">
                <div className="op-privacy-card">
                  <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
                  <div className="op-privacy-title">Een belofte aan ouders</div>
                  <div className="op-privacy-sub">
                    "Ik wil dat ouders hun kind een telefoon kunnen geven zonder te hoeven nadenken over wat er met de data gebeurt. Dat gevoel van controle — dat is wat Pulse geeft."
                  </div>
                  <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
                    — Oprichter van Pulse
                  </div>
                </div>
              </div>
            </FadeRow>
          </div>
        </section>

        {/* ── WAT PRIVACY-FIRST BETEKENT ── */}
        <section className="hp-section hp-section--gray" id="privacy-first">
          <div className="hp-section-inner">
            <SectionHeader
              badge="Wat Privacy-First betekent"
              title="Wij hebben geen interesse in jouw data"
              text="Die zin menen we letterlijk. Pulse wil zo min mogelijk gegevens. Onze database moet schoon blijven. Wat niet nodig is, bewaren we niet."
              align="left"
            />
            <div className="hp-why-grid op-feature-grid" style={{ marginTop: 48 }}>
              {[
                {
                  icon: <Shield size={22} />,
                  title: 'Geen onnodige data',
                  text: 'We verzamelen alleen wat strikt nodig is om de app te laten werken. Geen extra velden, geen verborgen trackers, geen statistieken over jouw kind.',
                },
                {
                  icon: <Lock size={22} />,
                  title: 'Geen verkoop van data',
                  text: 'Jouw gegevens worden nooit verkocht, gedeeld of doorgegeven aan derden. Niet voor geld. Niet voor een "partnership". Nooit.',
                },
                {
                  icon: <Message size={22} />,
                  title: 'Geen gedragsanalyse',
                  text: 'We analyseren niet wat je kind schrijft, hoe vaak het chat of wanneer het online is. Dat gaat ons niets aan.',
                },
                {
                  icon: <Bell size={22} />,
                  title: 'Geen algoritmes',
                  text: 'Er is geen aanbevelingssysteem, geen "misschien ken je dit persoon", geen notificatietrucjes. Pulse werkt niet op afhankelijkheid.',
                },
                {
                  icon: <Users size={22} />,
                  title: 'Geen profielen',
                  text: 'We bouwen geen profiel op van jou of je kind. Geen interesses, geen gedragspatronen, geen scoresystemen.',
                },
                {
                  icon: <Clock size={22} />,
                  title: 'Geen eeuwige opslag',
                  text: 'Berichten verdwijnen automatisch na 30 dagen. Logbestanden na 7 dagen. Wat niet meer nodig is, wordt verwijderd. Punt.',
                },
              ].map((card) => (
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

        {/* ── WAT WE NIET DOEN ── */}
        <section className="hp-section" id="wat-niet">
          <div className="hp-section-inner">
            <SectionHeader
              badge="Wat wij niet doen"
              title="Geen datahonger. Geen verborgen opslag."
              align="left"
            />
            <div className="op-compare-row" style={{ marginTop: 40 }}>
              <div className="op-compare-col op-compare-col--no" style={{ flex: 1 }}>
                <div className="op-compare-label op-compare-label--no">Pulse doet dit nooit</div>
                <ul className="ot-feature-list">
                  {[
                    'Jouw data verkopen aan adverteerders',
                    'Gedrag van kinderen analyseren',
                    'Profielen aanmaken van gebruikers',
                    'Algoritmes inzetten om aandacht te stelen',
                    'Berichten langer bewaren dan nodig',
                    'Telefoonnummers vereisen of opslaan',
                    'Foto\'s of media opslaan',
                    'Data delen met derden',
                    'Kinderen targeten met aanbevelingen',
                  ].map((item) => (
                    <li key={item} className="op-not-item">
                      <span className="op-not-check">✕</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="op-compare-col op-compare-col--yes" style={{ flex: 1 }}>
                <div className="op-compare-label op-compare-label--yes">Pulse doet dit wel</div>
                <ul className="ot-feature-list">
                  {[
                    'Veilig communiceren mogelijk maken',
                    'Data direct verwijderen als je dat wilt',
                    'Ouders volledig in controle houden',
                    'Berichten end-to-end versleutelen',
                    'Automatisch opschonen na de bewaartermijn',
                    'Transparant zijn over wat we opslaan',
                    'Werken zonder advertenties',
                    'AVG-compliant blijven',
                    'Jou als eigenaar van jouw data behandelen',
                  ].map((item) => (
                    <li key={item}>
                      <span className="ot-feature-check"><Check size={14} /></span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── WAT WE WEL OPSLAAN ── */}
        <section className="hp-section hp-section--gray" id="wat-opslaan">
          <div className="hp-section-inner">
            <SectionHeader
              badge="Wat we opslaan — en waarom"
              title="Eerlijk en transparant"
              text="We bewaren alleen wat noodzakelijk is. Hieronder zie je precies wat, hoe lang, en waarom. Verwijderen = echt verwijderen."
              align="left"
            />
            <div style={{ marginTop: 40 }}>
              {retentionRows.map((row) => (
                <FadeCard key={row.label}>
                  <div className="pf-retention-row">
                    <div className="pf-retention-label">{row.label}</div>
                    <div className="pf-retention-body">
                      <div className="pf-retention-why">{row.why}</div>
                      <div className="pf-retention-meta">
                        <span className="pf-retention-badge pf-retention-badge--duration">
                          <Clock size={12} /> {row.duration}
                        </span>
                        <span className="pf-retention-badge pf-retention-badge--delete">
                          ✓ {row.onDelete}
                        </span>
                      </div>
                    </div>
                  </div>
                </FadeCard>
              ))}
            </div>
          </div>
        </section>

        {/* ── BEVEILIGING / E2EE ── */}
        <section className="hp-section" id="beveiliging">
          <div className="hp-section-inner">
            <FadeRow className="op-privacy-row">
              <div className="hp-feature-text">
                <div className="hp-feature-tag">End-to-end versleuteling</div>
                <h3>Alleen jij en je kind kunnen meelezen. Wij niet.</h3>
                <p>
                  Alle berichten in Pulse zijn end-to-end versleuteld (E2EE). Dat betekent: een bericht wordt versleuteld op het apparaat van de afzender, en pas ontsleuteld op het apparaat van de ontvanger.
                </p>
                <p style={{ marginTop: 16 }}>
                  Onderweg ziet niemand de inhoud. Geen hacker, geen overheid, geen Pulse-medewerker. Niemand.
                </p>
                <ul className="ot-feature-list" style={{ marginTop: 24 }}>
                  <li><span className="ot-feature-check"><Check size={14} /></span>Berichten versleuteld op jouw apparaat</li>
                  <li><span className="ot-feature-check"><Check size={14} /></span>Alleen leesbaar voor afzender en ontvanger</li>
                  <li><span className="ot-feature-check"><Check size={14} /></span>Pulse kan jouw berichten niet inzien</li>
                  <li><span className="ot-feature-check"><Check size={14} /></span>Geldt voor chat, bellen én videobellen</li>
                </ul>
              </div>
              <div className="hp-feature-mockup">
                <div className="op-privacy-card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
                  <div className="op-privacy-title">End-to-end versleuteld</div>
                  <div className="op-privacy-sub" style={{ marginTop: 12 }}>
                    Van jou naar je kind.<br />
                    Van je kind naar jou.<br />
                    Niemand anders leest mee.
                  </div>
                  <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(108,99,255,0.07)', borderRadius: 14, fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                    Versleuteld · Veilig · Privé
                  </div>
                </div>
              </div>
            </FadeRow>
          </div>
        </section>

        {/* ── OUDERS IN CONTROLE ── */}
        <section className="hp-section hp-section--gray" id="controle">
          <div className="hp-section-inner">
            <SectionHeader
              badge="Ouders in controle"
              title="Jij bent de eigenaar van de data"
              text="Pulse geeft ouders volledige zeggenschap. Geen verborgen systemen, geen algoritmes die beslissen. Jij bepaalt."
              align="left"
            />
            <div className="hp-why-grid op-feature-grid" style={{ marginTop: 48 }}>
              {[
                {
                  icon: <Users size={22} />,
                  title: 'Jij beslist wie er contact heeft',
                  text: 'Geen enkel contact kan jouw kind bereiken zonder jouw goedkeuring. Vertrouwde contacten voeg jij toe. Onbekenden bestaan niet in Pulse.',
                },
                {
                  icon: <Shield size={22} />,
                  title: 'Jij bent eigenaar van de data',
                  text: 'De gegevens van jou en je kind zijn van jou. Je kunt op elk moment alles verwijderen. Direct, volledig, zonder vertraging.',
                },
                {
                  icon: <Lock size={22} />,
                  title: 'Geen verborgen systemen',
                  text: 'Er is geen algoritme dat meebeslist. Geen systeem dat je kind "aanbevelingen" stuurt. Pulse doet precies wat jij ziet — niets meer, niets minder.',
                },
                {
                  icon: <Bell size={22} />,
                  title: 'Direct op de hoogte',
                  text: 'Je krijgt een melding bij nieuwe contactverzoeken. Jij keurt goed of wijst af. Je kind kan niemand toevoegen zonder jouw akkoord.',
                },
              ].map((card) => (
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

        {/* ── AFSLUITING / BELOFTE ── */}
        <section className="hp-section" id="belofte">
          <div className="hp-section-inner">
            <FadeCard>
              <div className="op-statement" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
                <blockquote>
                  "Privacy is voor ons geen marketingterm. Het is de reden waarom Pulse bestaat. Wij bouwen een app waarbij jij nooit hoeft na te denken over wat er met jouw gegevens gebeurt."
                </blockquote>
                <p style={{ marginTop: 24, color: 'var(--text2)', fontSize: 15, lineHeight: 1.7 }}>
                  Pulse verzamelt niet. Pulse analyseert niet. Pulse verkoopt niet.<br />
                  <strong style={{ color: 'var(--text)' }}>Pulse beschermt.</strong>
                </p>
              </div>
            </FadeCard>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="ot-final-cta">
          <h2>Veilig verbonden.<br className="ot-final-cta-break" />{' '}Zonder zorgen.</h2>
          <p>Geef je kind een veilige plek om te communiceren — zonder dat een bedrijf meekijkt, meeluistert of verdient aan het gedrag van je kind.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>
              Ouderaccount aanmaken
            </button>
            <button
              type="button"
              className="hp-cta-btn"
              style={{ background: '#fff', border: '1.5px solid rgba(108,99,255,0.4)', color: '#6c63ff', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setShowAuthModal(true)}
            >
              <Login size={18} /> Inloggen
            </button>
          </div>
        </section>

      </main>

      <MarketingFooter />

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} onParentClick={onParentClick} />
      )}
      {showParentModal && (
        <ParentAuthModal onClose={() => setShowParentModal(false)} defaultTab="register" />
      )}

      <style>{`
        .pf-retention-row {
          display: flex;
          gap: 24px;
          align-items: flex-start;
          background: var(--surface, #fff);
          border: 1px solid rgba(108,99,255,0.1);
          border-radius: 18px;
          padding: 20px 24px;
          margin-bottom: 12px;
        }
        .pf-retention-label {
          font-weight: 700;
          font-size: 15px;
          color: var(--text);
          min-width: 180px;
          flex-shrink: 0;
          padding-top: 2px;
        }
        .pf-retention-body {
          flex: 1;
          min-width: 0;
        }
        .pf-retention-why {
          font-size: 14px;
          color: var(--text2);
          line-height: 1.55;
          margin-bottom: 10px;
        }
        .pf-retention-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .pf-retention-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 11px;
          border-radius: 999px;
        }
        .pf-retention-badge--duration {
          background: rgba(108,99,255,0.1);
          color: var(--accent);
        }
        .pf-retention-badge--delete {
          background: rgba(34,197,94,0.1);
          color: #16a34a;
        }
        @media (max-width: 600px) {
          .pf-retention-row {
            flex-direction: column;
            gap: 10px;
            padding: 16px 18px;
          }
          .pf-retention-label {
            min-width: unset;
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
}
