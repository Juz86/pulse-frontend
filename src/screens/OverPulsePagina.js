import React, { useEffect, useRef, useState } from 'react';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import AuthModal from '../components/AuthModal';
import DecorativeAvatar, { avatarSvgs } from '../components/DecorativeAvatars';
import ParentAuthModal from '../components/ParentAuthModal';
import PageMeta from '../components/PageMeta';
import {
  Check,
  Login,
  Message,
  Phone,
  PhoneIcon,
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
              Rustige communicatie.<br /><span style={{ whiteSpace: 'nowrap' }}>Voor ouder en kind.</span>
            </h1>
            <p className="ot-hero-sub">
              Pulse is gemaakt voor veilig contact tussen ouder en kind. Gewoon chatten, bellen en videobellen, zonder social media en zonder onnodige afleiding.
            </p>
            <div className="ot-hero-actions">
              <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>Account maken</button>
              <button type="button" className="ot-secondary-btn" onClick={() => scrollTo('waarom-pulse')}>Meer lezen</button>
            </div>
          </div>
          <div className="ot-hero-visual" aria-hidden="true">
            <FeatureStrip />
          </div>
        </div>
      </section>

      {/* ── WAAROM PULSE BESTAAT ── */}
      <section className="hp-section" id="waarom-pulse">
        <div className="hp-section-inner">
          <SectionHeader
            badge="Waarom Pulse bestaat"
            title="Waarom Pulse bestaat"
            text="Pulse is ontstaan vanuit een simpele vraag van een vader: “Waarom bestaat er geen veilige manier voor mijn kind om gewoon contact te hebben?”"
            align="left"
          />
          <div className="op-compare-row" style={{ marginTop: 32 }}>
            <div className="op-compare-col op-compare-col--yes">
              <ul className="ot-feature-list">
                {[
                  'Zonder social media',
                  'Zonder afleiding',
                  'Zonder dat alles wordt opgeslagen',
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

      {/* ── WAT IS PULSE ── */}
      <section className="hp-section hp-section--gray" id="veilig-alternatief">
        <div className="hp-section-inner">
          <SectionHeader
            badge="Wat is Pulse"
            title="Wat is Pulse"
            text="Pulse is een communicatie-app voor ouder en kind."
            align="left"
          />
          <div className="op-compare-row">
            <div className="op-compare-col op-compare-col--yes">
              <div className="op-compare-label op-compare-label--yes">Kinderen kunnen</div>
              <ul className="ot-feature-list">
                {[
                  'chatten',
                  'bellen',
                  'videobellen',
                ].map((item) => (
                  <li key={item}>
                    <span className="ot-feature-check"><Check size={14} /></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="op-compare-col op-compare-col--no">
              <p style={{ margin: 0 }}>
                Zonder telefoonnummer, in een rustige en veilige omgeving.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WAAROM PULSE ANDERS IS ── */}
      <section className="hp-section" id="voor-kinderen">
        <div className="hp-section-inner">
          <SectionHeader
            badge="Waarom Pulse anders is"
            title="Waarom Pulse anders is"
            text="De meeste apps zijn gemaakt om aandacht vast te houden. Pulse is gemaakt om rust te brengen."
            align="left"
          />
          <div className="hp-why-grid op-feature-grid">
            {[
              { icon: <Shield size={22} />, title: 'Geen social media' },
              { icon: <Users size={22} />, title: 'Geen algoritmes' },
              { icon: <PhoneIcon size={22} />, title: 'Geen onnodige dataverzameling' },
              { icon: <Message size={22} />, title: 'Alleen contact met vertrouwde personen' },
            ].map((item) => (
              <FadeCard key={item.title}>
                <div className="hp-why-card">
                  <div className="op-feature-icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                </div>
              </FadeCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── WAT DIT BETEKENT ── */}
      <section className="hp-section hp-section--gray" id="privacy">
        <div className="hp-section-inner">
          <FadeRow className="op-privacy-row">
            <div className="hp-feature-text">
              <div className="hp-feature-tag">Wat dit betekent voor jullie</div>
              <h3>Wat dit betekent voor jullie</h3>
              <p>Pulse geeft kinderen ruimte om veilig contact te houden, terwijl ouders overzicht en rust behouden.</p>
              <ul className="ot-feature-list" style={{ marginTop: 24 }}>
                <li><strong>Voor kinderen:</strong></li>
                <li><span className="ot-feature-check"><Check size={14} /></span>veilig communiceren</li>
                <li><span className="ot-feature-check"><Check size={14} /></span>geen druk of afleiding</li>
                <li style={{ marginTop: 12 }}><strong>Voor ouders:</strong></li>
                <li><span className="ot-feature-check"><Check size={14} /></span>volledige controle</li>
                <li><span className="ot-feature-check"><Check size={14} /></span>overzicht en rust</li>
              </ul>
            </div>
            <div className="hp-feature-mockup">
              <div className="op-privacy-card">
                <div className="op-privacy-icon"><Shield size={32} /></div>
                <div className="op-privacy-title">Rustig en veilig contact</div>
                <div className="op-privacy-sub">
                  Chatten, bellen en videobellen in een omgeving die simpel, vertrouwd en overzichtelijk voelt.
                </div>
                <div className="op-privacy-badges">
                  <span><Shield size={12} /> Veilig</span>
                  <span><Users size={12} /> Vertrouwd</span>
                  <span><PhoneIcon size={12} /> Rustig contact</span>
                </div>
              </div>
            </div>
          </FadeRow>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="ot-final-cta">
        <h2>Veilig verbonden.<br className="ot-final-cta-break" />{' '}Met wie echt telt.</h2>
        <p>Pulse helpt ouder en kind om rustig en veilig in contact te blijven.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>Account maken</button>
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
