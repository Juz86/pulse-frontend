// src/screens/Homepage.js
import React, { useState, useEffect } from 'react';
import AuthScreen from './AuthScreen';
import AuthModal from '../components/AuthModal';
import ParentAuthModal from '../components/ParentAuthModal';
import { Shield, PhoneIcon, Wifi, Login } from '../components/Icons';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import PageMeta from '../components/PageMeta';


function HeroChatBubbles() {
  return (
    <div className="hp-hero-chat" aria-hidden="true">
      <div className="hp-hero-bubble hp-hero-bubble--in" style={{ '--bubble-delay': '0s' }}>
        <span className="hp-hero-bubble-text">Hoi! Ben je al thuis? 🏠</span>
        <span className="hp-hero-bubble-time">17:02</span>
      </div>
      <div className="hp-hero-bubble hp-hero-bubble--out" style={{ '--bubble-delay': '2s' }}>
        <span className="hp-hero-bubble-text">Bijna! 10 minuutjes 😊</span>
        <span className="hp-hero-bubble-time">17:02</span>
      </div>
      <div className="hp-hero-bubble hp-hero-bubble--in" style={{ '--bubble-delay': '4s' }}>
        <span className="hp-hero-bubble-text">Oké, ik wacht! ❤️</span>
        <span className="hp-hero-bubble-time">17:03</span>
      </div>
    </div>
  );
}

export default function Homepage({ onParentClick }) {
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [scrolled,      setScrolled]      = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showParentModal, setShowParentModal] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navItems = [
    { key: 'functies', label: 'Functies', href: '/functies' },
    { key: 'hoe-werkt-het', label: 'Hoe werkt het', href: '/hoe-werkt-het' },
    { key: 'ouderlijk-toezicht', label: 'Ouderlijk toezicht', href: '/ouderlijk-toezicht' },
    { key: 'over-pulse', label: 'Over Pulse', href: '/over-pulse' },
  ];

  return (
    <div className="hp-root">
      <PageMeta
        title="Pulse — Veilig communiceren voor elk kind"
        description="Pulse is een veilige Nederlandse communicatie-app voor kinderen: chatten, bellen en videobellen zonder telefoonnummer, onder ouderlijk toezicht."
        canonical="https://pulse-frontend-elt.pages.dev/"
      />

      {/* ── NAVIGATIE ── */}
      <MarketingNavbar
        items={navItems}
        activeKey={null}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        scrolled={scrolled}
        onParentClick={onParentClick}
      />

      <main id="main-content">
      {/* ── HERO ── */}
      <section className="hp-hero" id="hero" aria-labelledby="homepage-hero-title">
        <HeroChatBubbles />
        <div className="hp-hero-inner">
          <div className="hp-hero-text">
            <div className="hp-hero-badge">🇳🇱 100% Nederlands</div>
            <h1 id="homepage-hero-title" className="hp-hero-title">
              Veilig chatten en (video)bellen voor elk kind
            </h1>
            <p className="hp-hero-sub">
              Pulse is de enige Nederlandse communicatie-app waarmee kinderen
              zonder telefoonnummer kunnen bellen, videobellen en chatten — zonder
              afleiding, zonder pesterij, volledig onder ouderlijk toezicht. Speciaal ontworpen voor de veiligheid van kinderen online.
            </p>
            <ul className="hp-hero-features" aria-label="Belangrijkste voordelen">
              <li className="hp-hero-feature"><span aria-hidden="true"><Shield size={16} /></span> Versleuteld &amp; privé</li>
              <li className="hp-hero-feature"><span aria-hidden="true"><PhoneIcon size={16} /></span> Chatten &amp; (video)bellen</li>
              <li className="hp-hero-feature"><span aria-hidden="true"><Wifi size={16} /></span> Wi-Fi &amp; data</li>
            </ul>
          </div>

          <div className="hp-hero-card" id="login" aria-label="Inloggen bij Pulse">
            <AuthScreen />
          </div>
        </div>
      </section>


      {/* ── FUNCTIES ── */}
      <section className="hp-section" id="functies" aria-labelledby="homepage-features-title">
        <div className="hp-section-inner">
          <h2 id="homepage-features-title" className="sr-only">Belangrijkste Pulse functies</h2>

          {/* Rij 1 */}
          <article className="hp-feature-row" id="veiligheid" aria-labelledby="homepage-feature-communication">
            <div className="hp-feature-text">
              <div className="hp-feature-tag">Communicatie</div>
              <h3 id="homepage-feature-communication">Chatten, bellen en videobellen</h3>
              <p>Blijf verbonden met familie en vrienden via chat, bellen en videobellen.
                Geen telefoonnummer, foto's, gifs of algoritmes. Pulse is pure communicatie.
              </p>
              <a href="/functies#chatten" className="hp-read-more-btn" aria-label="Lees meer over chatten, bellen en videobellen">
                Lees meer <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="hp-feature-mockup">
              <div className="hp-img-container hp-img-tilt-left">
                <img
                  src="/screenshots/pulse1.png"
                  alt="Pulse chat in gebruik"
                  width="420"
                  height="315"
                  sizes="(max-width: 768px) 100vw, 420px"
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: 'center' }}
                />
              </div>
            </div>
          </article>

          {/* Rij 2 */}
          <article className="hp-feature-row hp-feature-row--reverse" id="toezicht" aria-labelledby="homepage-feature-parental-controls">
            <div className="hp-feature-mockup">
              <div className="hp-img-container hp-img-tilt-right">
                <img
                  src="/screenshots/tablet-hand.jpg"
                  alt="Ouderlijk toezicht dashboard"
                  width="420"
                  height="315"
                  sizes="(max-width: 768px) 100vw, 420px"
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: '50% 80%' }}
                />
              </div>
            </div>
            <div className="hp-feature-text">
              <div className="hp-feature-tag">Ouderlijk toezicht</div>
              <h3 id="homepage-feature-parental-controls">Volledig overzicht voor ouders</h3>
              <p>Ouders hebben volledig toezicht via een eigen dashboard. Chat, bellen of videobellen pauzeren per functie. Direct meldingen bij nieuwe contacten.</p>
              <a href="/ouderlijk-toezicht#dashboard" className="hp-read-more-btn" aria-label="Lees meer over ouderlijk toezicht">
                Lees meer <span aria-hidden="true">→</span>
              </a>
            </div>
          </article>

          {/* Rij 3 */}
          <article className="hp-feature-row" aria-labelledby="homepage-feature-privacy">
            <div className="hp-feature-text">
              <div className="hp-feature-tag">Privacy &amp; AVG</div>
              <h3 id="homepage-feature-privacy">AVG en privacy centraal</h3>
              <p>Pulse brengt familie en vrienden dichter bij elkaar in één vertrouwde en beveiligde omgeving — met respect voor privacy: geen onnodige dataverzameling en berichten verdwijnen na 30 dagen.</p>
              <a href="/over-pulse#privacy" className="hp-read-more-btn" aria-label="Lees meer over privacy en AVG bij Pulse">
                Lees meer <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="hp-feature-mockup">
              <div className="hp-img-container hp-img-tilt-subtle">
                <img
                  src="/screenshots/avg.png"
                  alt="AVG en privacy"
                  width="420"
                  height="315"
                  sizes="(max-width: 768px) 100vw, 420px"
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: 'center' }}
                />
              </div>
            </div>
          </article>

        </div>
      </section>


      {/* ── CTA ── */}
      <section className="ot-final-cta">
        <h2>Veilig verbonden. Met wie echt telt.</h2>
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

      {/* ── FOOTER ── */}
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
