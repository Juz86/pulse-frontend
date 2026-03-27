// src/screens/Homepage.js
import React, { useState, useEffect } from 'react';
import AuthScreen from './AuthScreen';
import AuthModal from '../components/AuthModal';
import ParentAuthModal from '../components/ParentAuthModal';
import { Shield, PhoneIcon, Wifi } from '../components/Icons';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import PageMeta from '../components/PageMeta';


export default function Homepage({ onParentClick }) {
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [scrolled,      setScrolled]      = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showParentModal, setShowParentModal] = useState(false);

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
      <section className="hp-hero" id="hero">
        <div className="hp-hero-inner">
          <div className="hp-hero-text">
            <div className="hp-hero-badge">🇳🇱 100% Nederlands</div>
            <h1 className="hp-hero-title">
              Veilig chatten en (video)bellen voor elk kind
            </h1>
            <p className="hp-hero-sub">
              Pulse is de enige Nederlandse communicatie-app waarmee kinderen
              zonder telefoonnummer kunnen bellen, videobellen en chatten — zonder
              afleiding, zonder pesterij, volledig onder ouderlijk toezicht. Speciaal ontworpen voor de veiligheid van kinderen online.
            </p>
            <div className="hp-hero-features">
              <div className="hp-hero-feature"><Shield size={16} /> Versleuteld &amp; privé</div>
              <div className="hp-hero-feature"><PhoneIcon size={16} /> Chatten &amp; (video)bellen</div>
              <div className="hp-hero-feature"><Wifi size={16} /> Wifi &amp; mobiel</div>
            </div>
          </div>

          <div className="hp-hero-card" id="login">
            <AuthScreen onParentClick={onParentClick} />
          </div>
        </div>
      </section>


      {/* ── FUNCTIES ── */}
      <section className="hp-section" id="functies">
        <div className="hp-section-inner">

          {/* Rij 1 */}
          <div className="hp-feature-row" id="veiligheid">
            <div className="hp-feature-text">
              <div className="hp-feature-tag">Communicatie</div>
              <h3>Chatten, bellen en videobellen</h3>
              <p>Blijf verbonden met familie en vrienden via chat, bellen en videobellen.
                Geen telefoonnummer, foto's, gifs of algoritmes. Pulse is pure communicatie.
              </p>
              <a href="/functies" className="hp-read-more-btn">Lees meer →</a>
            </div>
            <div className="hp-feature-mockup">
              <img
                src="/screenshots/pulse1.png"
                alt="Pulse chat in gebruik"
                loading="lazy"
                decoding="async"
                style={{ width: '100%', maxWidth: 420, borderRadius: 16, display: 'block' }}
              />
            </div>
          </div>

          {/* Rij 2 */}
          <div className="hp-feature-row hp-feature-row--reverse" id="toezicht">
            <div className="hp-feature-mockup">
              <img
                src="/screenshots/tablet-hand.jpg"
                alt="Ouderlijk toezicht dashboard"
                loading="lazy"
                decoding="async"
                style={{ width: '100%', maxWidth: 420, borderRadius: 16, display: 'block' }}
              />
            </div>
            <div className="hp-feature-text">
              <div className="hp-feature-tag">Ouderlijk toezicht</div>
              <h3>Volledig overzicht voor ouders</h3>
              <p>Ouders hebben volledig toezicht via een eigen dashboard. Chat, bellen of videobellen pauzeren per functie. Direct meldingen bij nieuwe contacten.</p>
              <a href="/ouderlijk-toezicht" className="hp-read-more-btn">Lees meer →</a>
            </div>
          </div>

          {/* Rij 3 */}
          <div className="hp-feature-row">
            <div className="hp-feature-text">
              <div className="hp-feature-tag">Privacy &amp; AVG</div>
              <h3>AVG en privacy centraal</h3>
              <p>Pulse brengt familie en vrienden dichter bij elkaar in één vertrouwde en beveiligde omgeving — met respect voor privacy: geen onnodige dataverzameling en berichten verdwijnen na 30 dagen.</p>
              <a href="/over-pulse" className="hp-read-more-btn">Lees meer →</a>
            </div>
            <div className="hp-feature-mockup">
              <img
                src="/screenshots/avg.png"
                alt="AVG en privacy"
                loading="lazy"
                decoding="async"
                style={{ width: '100%', maxWidth: 420, borderRadius: 16, display: 'block' }}
              />
            </div>
          </div>

        </div>
      </section>


      {/* ── CTA ── */}
      <section className="hp-cta">
        <div className="hp-cta-inner">
          <h2>Blijf veilig verbonden met wie echt telt</h2>
          <p>Gratis account aanmaken. Beschikbaar op web, iOS en Android.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>
              Ouderaccount aanmaken
            </button>
            <button
              type="button"
              className="hp-cta-btn"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)' }}
              onClick={() => setShowAuthModal(true)}
            >
              Kind inloggen
            </button>
          </div>
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
