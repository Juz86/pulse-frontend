import React, { useEffect, useRef, useState } from 'react';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import DecorativeAvatar, { avatarSvgs } from '../components/DecorativeAvatars';
import PageMeta from '../components/PageMeta';
import useMarketingAuth from '../hooks/useMarketingAuth';
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
  const { openParentSignup, openLogin, modals: marketingAuthModals } = useMarketingAuth({ onParentClick });

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
              Geen social media.<br /><span className="pf-hero-nowrap">Wel verbinding.</span>
            </h1>
            <p className="ot-hero-sub">
              Wij geloven dat kinderen recht hebben op veilige, rustgevende communicatie — zonder algoritmes, zonder verslaving, zonder zorgen. Pulse is daarvoor gebouwd.
            </p>
            <div className="ot-hero-actions">
              <button type="button" className="hp-cta-btn" onClick={openParentSignup}>Ouderaccount aanmaken</button>
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
              <div className="hp-feature-tag pf-inline-tag">Waarom Pulse bestaat</div>
              <h2>Pulse is bedacht door een vader</h2>
              <p>Een vader die zich zorgen maakte.</p>
              <p className="pf-paragraph-spaced">
                Over hoe kinderen vandaag opgroeien in een digitale wereld vol prikkels. Over apps die alles volgen, analyseren en opslaan. Over hoe weinig controle ouders eigenlijk hebben.
              </p>
              <p className="pf-paragraph-spaced">Hij wilde iets anders.</p>
              <p className="pf-paragraph-tight">
                Iets simpels. Iets veiligs. Iets wat alleen draait om contact tussen ouder en kind.
              </p>
              <p className="pf-emphasis">Zo is Pulse ontstaan.</p>
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

      {/* ── ZIJN MISSIE ── */}
      <section className="hp-section" id="zijn-missie">
        <div className="hp-section-inner">
          <FadeRow className="op-privacy-row">
            <div className="hp-feature-text">
              <div className="hp-feature-tag pf-inline-tag">Zijn missie</div>
              <h2>Een veilig alternatief</h2>
              <p className="pf-paragraph-spaced">
                Hij heeft het zijn missie gemaakt om een veilige manier van communiceren terug te brengen.
              </p>
              <p className="pf-paragraph-spaced">
                Een plek waar kinderen veilig kunnen chatten, bellen en videobellen met hun ouders, familie en vertrouwde mensen om hen heen.
              </p>
              <div className="op-mission-list">
                {['Zonder filters', 'Zonder gifs of memes', 'Zonder social media prikkels'].map((item) => (
                  <div key={item} className="op-mission-item">
                    <span className="op-mission-icon"><XIcon size={18} /></span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <p className="pf-paragraph-spaced">
                Terug naar de kern:
                <span> gewoon contact, zoals het bedoeld is.</span>                  
              </p>
            </div>
            <div className="hp-feature-mockup op-mission-mockup">
              <div className="op-privacy-card op-mission-card">
                <div className="op-mission-label">Pulse is anders</div>
                <hr className="pf-divider" />
                <div className="op-mission-card-list">
                  {[
                    'Chatten met vertrouwde contacten',
                    'Bellen en videobellen zonder telefoonnummer',
                    'Ouderlijk toezicht',
                    'AVG-compliant en privacy-first',
                    'Geen data-verzameling',
                  ].map((item) => (
                    <div key={item} className="op-mission-card-item">
                      <span className="op-mission-card-icon">
                        <Check size={14} />
                      </span>
                      <span className="op-mission-card-text">{item}</span>
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
        <div className="ot-final-cta-actions">
          <button type="button" className="hp-cta-btn" onClick={openParentSignup}>Ouderaccount aanmaken</button>
          <button
            type="button"
            className="hp-cta-btn hp-cta-btn--secondary"
            onClick={openLogin}
          >
            <Login size={18} /> Inloggen
          </button>
        </div>
      </section>
      </main>

      <MarketingFooter />

      {marketingAuthModals}
    </div>
  );
}
