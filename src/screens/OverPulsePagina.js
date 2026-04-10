import React, { useEffect, useRef, useState } from 'react';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import AuthModal from '../components/AuthModal';
import DecorativeAvatar, { avatarSvgs } from '../components/DecorativeAvatars';
import ParentAuthModal from '../components/ParentAuthModal';
import PageMeta from '../components/PageMeta';
import {
  Check,
  Heart,
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
      <div className="op-strip-header">Pulse houdt contact simpel</div>
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
        <span><PhoneIcon size={16} />Chatten op web</span>
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


      {/* ── WAAROM PULSE BESTAAT & ZIJN MISSIE ── */}
      <section className="hp-section hp-section--gray" id="pulse-ontstaan">
        <div className="hp-section-inner">
          <FadeRow className="op-privacy-row">
            <div className="hp-feature-text">
              <div className="hp-feature-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Waarom Pulse bestaat</div>
              <h3>Pulse is bedacht door een vader</h3>
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
                Een plek waar kinderen veilig kunnen chatten op web en bellen of videobellen in de Pulse app met hun ouders, familie en vertrouwde mensen om hen heen.
              </p>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Zonder filters', 'Zonder gifs of memes', 'Zonder social media prikkels'].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#ef4444', display: 'flex', flexShrink: 0 }}><XIcon size={18} /></span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 16 }}>
                Terug naar de kern:
                <span> gewoon contact, zoals het bedoeld is.</span>                  
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
                    'Ouderlijk toezicht',
                    'AVG-compliant en privacy-first',
                    'Geen data-verzameling',
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
