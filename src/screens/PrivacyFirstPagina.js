// src/screens/PrivacyFirstPagina.js
import { useEffect, useRef, useState } from 'react';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import AuthModal from '../components/AuthModal';
import ParentAuthModal from '../components/ParentAuthModal';
import PageMeta from '../components/PageMeta';
import DecorativeAvatar, { avatarSvgs } from '../components/DecorativeAvatars';
import {
  Check,
  Clock,
  Lock,
  Login,
  Shield,
  Users,
  User,
  Message,
  Activity,
  Mail,
  Child,
  XIcon,
  Heart,
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

function FadeRow({ children, className = '' }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} className={`hp-feature-row ot-row${visible ? ' fp-visible' : ''} ${className}`}>
      {children}
    </div>
  );
}

const retentionRows = [
  { label: 'Accountgegevens ouder',       Icon: User,     duration: 'Zolang actief',     onDelete: 'Bij verwijderen → direct weg' },
  { label: 'Accountgegevens kind',     Icon: Child,   duration: 'Zolang actief',     onDelete: 'Bij verwijderen → direct weg' },
  { label: 'Vertrouwde contacten',         Icon: Users,    duration: 'Zolang gekoppeld',  onDelete: 'Bij ontkoppelen → direct weg' },
  { label: 'Berichten en communicatie',    Icon: Message,  duration: 'Standaard 30 dagen, ouder kan korter kiezen', why: 'Zodat je recente gesprekken kunt teruglezen.',           onDelete: 'Daarna → automatisch verwijderd' },
  { label: 'Logbestanden',                 Icon: Activity, duration: 'Maximaal 7 dagen',  why: 'Alleen voor veiligheid en technische stabiliteit.',      onDelete: 'Daarna → automatisch verwijderd' },
  { label: 'Support- en privacyverzoeken', Icon: Mail,     duration: 'Maximaal 30 dagen', why: 'Om je goed te kunnen helpen.',                           onDelete: 'Daarna → automatisch verwijderd' },
];

export default function PrivacyFirstPagina({ onParentClick }) {
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [scrolled,        setScrolled]        = useState(false);
  const [showAuthModal,   setShowAuthModal]   = useState(false);
  const [showParentModal, setShowParentModal] = useState(false);
  const [showAllRetention, setShowAllRetention] = useState(false);
  const retentionRef = useRef(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navItems = [
    { key: 'privacy-first', label: 'Privacy-First', href: '/privacy-first', highlight: true },
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
                Veilig verbonden.<br />
                <span className="pf-hero-nowrap">Zonder zorgen.</span>
              </h1>
              <p className="ot-hero-sub">
                Bij Pulse draait alles om één ding: rust en veiligheid voor ouder en kind.
                 Geen social media. Geen algoritmes. Geen dataverzameling.<br />
                Gewoon communiceren — zoals het bedoeld is.
              </p>
              <div className="ot-hero-actions">
                <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>
                  Ouderaccount aanmaken
                </button>
                <a href="/privacybeleid" className="ot-secondary-btn pf-secondary-link">
                  Privacybeleid lezen
                </a>
              </div>
            </div>
            <div className="ot-hero-visual" aria-hidden="true">
              <div className="op-privacy-card pf-hero-card">
                <div className="op-privacy-icon"><Shield size={36} /></div>
                <div className="op-privacy-title">100% Privacy-First</div>
                <div className="op-privacy-sub">
                  Geen social media.<br />
                  Geen algoritmes.<br />
                  Geen dataverzameling.<br />
                  Gewoon communiceren.
                </div>
                <div className="op-privacy-badges pf-hero-badges">
                  <span><Users size={12} /> Toezicht</span>
                  <span><Lock size={12} /> End-to-End</span>
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
                <div className="hp-feature-tag pf-inline-tag">Waarom Pulse bestaat</div>
                <h3>Jij bepaalt hoe lang geschiedenis blijft bestaan.</h3>
                <p>
                  Bij Pulse kies je zelf hoelang chat- bel- en videobel geschiedenis bewaard blijven.
                  Zo houd je controle over wat zichtbaar blijft en wat weer verdwijnt.
                </p>
                <p className="pf-paragraph-spaced">
                  Je kunt per gesprek een bewaartermijn kiezen van 24 uur, 7 dagen of niet bewaren.
                  Kies je niets, dan bewaart Pulse berichten standaard 30 dagen.
                </p>
                <p className="pf-paragraph-spaced">
                  Als ouder kun je deze instellingen ook voor je kind aanpassen.
                  Zo houd je niet alleen toezicht op contact, maar ook op hoe lang gesprekken bewaard blijven.
                </p>
                <p className="pf-paragraph-spaced">
                  Met niet bewaren worden berichten niet opgeslagen voor later.
                  Ze blijven alleen zichtbaar tijdens gebruik en verdwijnen zodra je de app verlaat.
                </p>
                <p className="pf-emphasis">
                  Zo blijft communicatie niet alleen veilig en prive, maar ook in lijn met wat jij belangrijk vindt.
                </p>
              </div>
              <div className="hp-feature-mockup">
                <div className="op-privacy-card">
                  <div className="op-privacy-icon pf-icon-tight"><Heart size={32} /></div>
                  <div className="op-privacy-title">Een belofte aan ouders</div>
                  <div className="op-privacy-sub">
                    "Iets simpels. Iets veiligs. Iets wat alleen draait om contact tussen ouder en kind."
                  </div>
                  <div className="pf-quote-credit">
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
            <FadeRow className="op-privacy-row">
              <div className="hp-feature-text">
                <div className="hp-feature-tag pf-inline-tag">Wat Privacy-First betekent bij Pulse</div>
                <h3>Privacy is voor ons geen instelling. Het is de basis.</h3>
                <div className="pf-points-list">
                  {[
                    'Wij verzamelen geen onnodige data',
                    'Wij verkopen geen data',
                    'Wij analyseren geen gedrag',
                    'Wij bouwen geen profielen',
                    'Wij gebruiken geen algoritmes',
                  ].map((item) => (
                    <div key={item} className="pf-points-item">
                      <span className="pf-points-icon"><XIcon size={18} /></span>
                      <span className="pf-points-text">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hp-feature-mockup">
                <div className="op-privacy-card">
                  <div className="op-privacy-icon pf-icon-tight"><Shield size={32} /></div>
                  <div className="op-privacy-title">Bij Pulse draait het om contact, niet om data.</div>
                  <div className="op-privacy-sub pf-sub-tight">
                    Zo simpel is het.
                  </div>
                </div>
              </div>
            </FadeRow>
          </div>
        </section>

        {/* ── WAT WE WEL OPSLAAN ── */}
        <section className="hp-section" id="wat-opslaan">
          <div className="hp-section-inner">
            <div className="hp-feature-tag pf-inline-tag pf-tag-spaced">Wat we wél opslaan en waarom</div>
            <h3 className="pf-section-title">Zo weinig mogelijk. Zo kort mogelijk.</h3>
            <p className="pf-section-intro">We slaan alleen op wat echt nodig is om de app te laten werken — en nooit langer dan nodig. <br></br>Wanneer je je account verwijdert, worden al je gegevens permanent gewist. Zo blijft onze database schoon.</p>
            <div ref={retentionRef} className="pf-retention-grid">
              {retentionRows.map((row, i) => (
                <div key={row.label} className={i >= 2 && !showAllRetention ? 'pf-retention-item pf-retention-item--hidden' : 'pf-retention-item'}>
                  <div className="pf-retention-head">
                    <span className="pf-retention-icon"><row.Icon size={18} /></span>
                    <span className="pf-retention-title">{row.label}</span>
                  </div>
                  {row.why && <div className="pf-retention-why">{row.why}</div>}
                  <div className="pf-retention-meta-stack">
                    <span className="pf-retention-badge pf-retention-badge--duration">
                      <Clock size={12} /> {row.duration}
                    </span>
                    <span className="pf-retention-badge pf-retention-badge--delete">
                      ✓ {row.onDelete}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {!showAllRetention && (
              <button
                type="button"
                className="pf-retention-more-btn"
                onClick={() => setShowAllRetention(true)}
              >
                Bekijk meer
              </button>
            )}
          </div>
        </section>

        {/* ── BEVEILIGING / E2EE ── */}
        <section className="hp-section hp-section--gray" id="beveiliging">
          <div className="hp-section-inner">
            <FadeRow className="op-privacy-row">
              <div className="hp-feature-text">
                <div className="hp-feature-tag pf-inline-tag">Veiligheid: End-to-End Encryptie</div>
                <h3>Pulse is beveiligd met <br></br>End-to-End encryptie.</h3>
                <p className="pf-paragraph-spaced">Dat betekent:</p>
                <div className="pf-points-list">
                  {[
                    'Alleen jij en de ontvanger kunnen berichten lezen.',
                    'Niemand anders — ook Pulse niet.',
                    'Geen toegang. Geen inzage. Geen meelezen.',
                  ].map((item) => (
                    <div key={item} className="pf-points-item">
                      <span className="pf-points-icon"><Check size={18} /></span>
                      <span className="pf-points-text">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hp-feature-mockup">
                <div className="op-privacy-card">
                  <div className="op-privacy-icon pf-icon-tight"><Lock size={36} /></div>
                  <div className="op-privacy-title">End-to-end encryptie</div>
                  <div className="op-privacy-sub pf-sub-tight">
                    Van jou naar je kind.<br />
                    Van je kind naar jou.<br />
                    Niemand anders leest mee.
                  </div>
                  <div className="op-privacy-badges pf-hero-badges">
                    <span><Lock size={12} /> Versleuteld</span>
                    <span><Shield size={12} /> Veilig</span>
                    <span><Users size={12} /> Privé</span>
                  </div>
                </div>
              </div>
            </FadeRow>
          </div>
        </section>

        <div className="pf-divider-wrap">
          <hr className="pf-divider" />
        </div>

        {/* ── CTA ── */}
        <section className="ot-final-cta">
          <h2>Veilig verbonden.<br className="ot-final-cta-break" />{' '}Met wie echt telt.</h2>
          <p>Pulse helpt gezinnen om in contact te blijven op een manier die vertrouwd, veilig en rustig voelt. Voor kinderen. Voor ouders. Voor iedereen die erom geeft.</p>
          <div className="ot-final-cta-actions">
            <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>
              Ouderaccount aanmaken
            </button>
            <button
              type="button"
              className="hp-cta-btn hp-cta-btn--secondary"
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

    </div>
  );
}
