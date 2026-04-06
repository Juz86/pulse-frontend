import React, { useEffect, useRef, useState } from 'react';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import AuthModal from '../components/AuthModal';
import DecorativeAvatar, { avatarSvgs } from '../components/DecorativeAvatars';
import ParentAuthModal from '../components/ParentAuthModal';
import PageMeta from '../components/PageMeta';
import {
  Bell,
  Check,
  Clock,
  Heart,
  Lock,
  Login,
  Message,
  Phone,
  PhoneIcon,
  Shield,
  Users,
  Video,
  XIcon,
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
    <div className="op-feature-strip" aria-hidden="true">
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
        <span><Shield size={16} />Versleuteld & privé</span>
        <span><PhoneIcon size={16} />Chatten & (video)bellen</span>
        <span><Users size={16} />Ouderlijk toezicht</span>
      </div>
    </div>
  );
}

export default function OverPulsePagina({ onParentClick }) {
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [scrolled,      setScrolled]      = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showParentModal, setShowParentModal] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id) => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    setMenuOpen(false);
  };

  const navItems = [
    { key: 'privacy-first', label: 'Privacy-First', href: '/privacy-first', highlight: true },
    { key: 'ouderlijk-toezicht', label: 'Ouderlijk toezicht', href: '/ouderlijk-toezicht' },
    { key: 'hoe-werkt-het',      label: 'Hoe werkt het',      href: '/hoe-werkt-het' },
    { key: 'functies',           label: 'Functies',           href: '/functies' },
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
      icon: <Lock size={22} />,
      title: 'Alleen vertrouwde contacten',
      text: 'Kinderen communiceren uitsluitend met mensen die door de ouder zijn goedgekeurd. Geen onbekenden, geen verzoeken van vreemden.',
    },
    {
      icon: <Users size={22} />,
      title: 'Ouders in regie',
      text: 'Het ouderportaal geeft real-time inzicht. Chat, bellen of videobellen pauzeren per functie. Direct een melding bij nieuwe contacten.',
    },
    {
      icon: <Bell size={22} />,
      title: 'Rust en overzicht',
      text: 'Geen notificatieregen, geen eindeloos scrollen. Pulse is kalm, helder en gericht — precies wat kinderen en ouders nodig hebben.',
    },
  ];

  return (
    <div className="hp-root">
      <PageMeta
        title="Over Pulse — Waarom veilige communicatie voor kinderen anders moet"
        description="Lees waarom Pulse bestaat: een Nederlandse, privacyvriendelijke communicatie-app voor kinderen zonder advertenties, algoritmes of afleiding."
        canonical="https://pulse-messenger.com/over-pulse"
      />
      <MarketingNavbar
        items={navItems}
        activeKey="over-pulse"
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
            <div className="fp-hero-badge">Over Pulse</div>
            <h1 className="ot-hero-title ot-hero-title--marketing">
              Geen social media.<br /><span style={{ whiteSpace: 'nowrap' }}>Wel verbinding.</span>
            </h1>
            <p className="ot-hero-sub">
              Wij geloven dat kinderen recht hebben op veilige, rustgevende communicatie — zonder algoritmes, zonder verslaving, zonder zorgen. Pulse is daarvoor gebouwd.
            </p>
            <div className="ot-hero-actions">
              <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>Ouderaccount aanmaken</button>
              <button type="button" className="ot-secondary-btn" onClick={() => scrollTo('waarom-pulse')}>Meer lezen</button>
            </div>
          </div>
          <div className="ot-hero-visual" aria-hidden="true">
            <FeatureStrip />
          </div>
        </div>
      </section>

      {/* ── WAAROM PULSE BESTAAT ── */}


      {/* ── PULSE IS BEDACHT DOOR EEN VADER ── */}
      <section className="hp-section hp-section--gray" id="pulse-ontstaan">
        <div className="hp-section-inner">
          <FadeRow className="op-privacy-row">
            <div className="hp-feature-text">
              <div className="hp-feature-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Waarom Pulse bestaat</div>
              <h3>Pulse is bedacht door een vader.</h3>
              <p>Een vader die zich zorgen maakte.</p>
              <p style={{ marginTop: 16 }}>
                Over hoe kinderen vandaag opgroeien in een digitale wereld vol prikkels. Over apps die alles volgen, analyseren en opslaan. Over hoe weinig controle ouders eigenlijk hebben.
              </p>
              <p style={{ marginTop: 16 }}>Hij wilde iets anders.</p>
              <p style={{ marginTop: 8 }}>
                Iets simpels. Iets veiligs. Iets wat alleen draait om contact tussen ouder en kind.
              </p>
              <p style={{ marginTop: 16, fontWeight: 700, color: '#1a1a2e' }}>Zo is Pulse ontstaan.</p>
            </div>
            <div className="hp-feature-mockup">
              <div className="op-privacy-card">
                <div className="op-privacy-icon" style={{ marginBottom: 12 }}><Heart size={32} /></div>
                <div className="op-privacy-title">Een belofte aan ouders</div>
                <div className="op-privacy-sub">
                  "Iets simpels. Iets veiligs. Iets wat alleen draait om contact tussen ouder en kind."
                </div>
                <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
                  — Oprichter van Pulse
                </div>
              </div>
            </div>
          </FadeRow>
        </div>
      </section>

      {/* ── ZIJN MISSIE ── */}
      <section className="hp-section" id="zijn-missie">
        <div className="hp-section-inner">
          <FadeRow className="op-privacy-row">
            <div className="hp-feature-text">
              <div className="hp-feature-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Zijn missie</div>
              <h3>Een veilig alternatief</h3>
              <p style={{ marginTop: 16 }}>
                Hij heeft het zijn missie gemaakt om een veilige manier van communiceren terug te brengen.
              </p>
              <p style={{ marginTop: 16 }}>
                Een plek waar kinderen kunnen chatten, bellen en videobellen met hun ouders, familie en vertrouwde mensen om hen heen.
              </p>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Zonder filters', 'Zonder gifs of memes', 'Zonder social media prikkels'].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#ef4444', display: 'flex', flexShrink: 0 }}><XIcon size={18} /></span>
                    <span style={{ fontSize: 15, color: '#1a1a2e' }}>{item}</span>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 16, fontWeight: 700, color: '#1a1a2e' }}>
                Terug naar de kern:<br />
                <span style={{ fontWeight: 400 }}>gewoon contact, zoals het bedoeld is.</span>
              </p>
            </div>
            <div className="hp-feature-mockup" style={{ flex: '1' }}>
              <div className="op-privacy-card" style={{ textAlign: 'left', width: '100%' }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>Pulse is anders</div>
                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', marginBottom: 16 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    'Chatten met vertrouwde contacten',
                    'Bellen en videobellen zonder telefoonnummer',
                    'Ouderlijk toezicht en contactbeheer',
                    'AVG-compliant en privacy-first',
                    'Rustig, overzichtelijk en afleidingsvrij',
                  ].map((item) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'rgba(108,99,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, color: 'var(--accent)',
                      }}>
                        <Check size={14} />
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a2e' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeRow>
        </div>
      </section>

      {/* ── EEN VEILIG ALTERNATIEF ── */}
      <section className="hp-section" id="veilig-alternatief">
        <div className="hp-section-inner">
          <SectionHeader
            badge="Een veilig alternatief"
            title="Pure communicatie, zonder afleiding"
            text="Pulse is bewust gestript van alles wat niet bijdraagt aan veilig contact. Het resultaat: een app die doet wat het belooft — en niets meer dan dat."
            align="left"
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
            align="left"
          />
          <div className="hp-why-grid op-feature-grid">
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
          <FadeRow className="op-privacy-row">
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
            align="left"
          />
          <div className="op-quote-scene">
            {[
              { label: 'Schermtijd bij kinderen',       style: { top: '8%',  left: '2%',   transform: 'rotate(-4deg)' } },
              { label: 'Verslavend app-design',         style: { top: '4%',  left: 'calc(32% + 50px)',  transform: 'rotate(2deg)'  } },
              { label: 'Online veiligheid',             style: { top: '6%',  right: '4%',  transform: 'rotate(-3deg)' } },
              { label: 'Cyberpesten',                   style: { top: '38%', right: '1%',  transform: 'rotate(4deg)'  } },
              { label: 'Privacy & AVG',                 style: { bottom: '8%',  left: '3%',  transform: 'rotate(3deg)'  } },
              { label: 'Smartphonegebruik op scholen',  style: { bottom: '4%', left: 'calc(28% + 50px)', transform: 'rotate(-2deg)' } },
              { label: 'Kinderen en sociale media',     style: { bottom: '5%',  right: '3%', transform: 'rotate(-4deg)' } },
              { label: 'Digitaal welzijn',              style: { top: '38%', left: '1%',  transform: 'rotate(-3deg)' } },
            ].map(({ label, style }) => (
              <span key={label} className="op-topic-pill op-topic-pill--deco" style={style} aria-hidden="true">{label}</span>
            ))}
            <div className="op-statement">
              <blockquote>
                "Kinderen hebben geen sociale media nodig. Ze hebben contact nodig — met opa en oma, met hun beste vriend, met de ouder die op het werk is. Dat is waar Pulse voor is."
              </blockquote>
            </div>
          </div>
        </div>
      </section>

      {/* ── VOOR GEZINNEN, SCHOLEN EN PARTNERS ── */}
      {/* ── CTA ── */}
      <section className="ot-final-cta">
        <h2>Veilig verbonden.<br className="ot-final-cta-break" />{' '}Met wie echt telt.</h2>
        <p>Pulse helpt gezinnen om in contact te blijven op een manier die vertrouwd, veilig en rustig voelt. Voor kinderen. Voor ouders. Voor iedereen die erom geeft.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>Ouderaccount aanmaken</button>
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
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onParentClick={onParentClick}
        />
      )}
      {showParentModal && (
        <ParentAuthModal onClose={() => setShowParentModal(false)} defaultTab="register" />
      )}
    </div>
  );
}
