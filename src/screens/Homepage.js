// src/screens/Homepage.js
import { useState, useEffect } from 'react';
import AuthModal from '../components/AuthModal';
import ParentAuthModal from '../components/ParentAuthModal';
import { Shield, PhoneIcon, Login } from '../components/Icons';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import PageMeta from '../components/PageMeta';
import { Users } from '../components/Icons';


function HeroVideo() {
  return (
    <div className="hp-hero-video-card" aria-label="Pulse introductievideo">
      <div className="hp-hero-video-frame">
        <video
          className="hp-hero-video"
          controls
          playsInline
          preload="metadata"
          poster="/screenshots/pulse1.png"
        >
          <source src="/videos/pulse-home-audio.mp4" type="video/mp4" />
        </video>
        <div className="hp-hero-video-downloads" aria-label="Download de Pulse app">
          <button type="button" className="hp-hero-store-btn" aria-label="Download Pulse voor iOS">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <span>iOS</span>
          </button>
          <button type="button" className="hp-hero-store-btn" aria-label="Download Pulse voor Android">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84 1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C14.15 1.23 13.1 1 12 1c-1.1 0-2.15.23-3.12.63L7.4.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.3 1.3C6.14 3.07 5 5.06 5 7h14c0-1.94-1.14-3.93-3.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>
            </svg>
            <span>Android</span>
          </button>
        </div>
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
    { key: 'privacy-first', label: 'Privacy-First', href: '/privacy-first', highlight: true },
    { key: 'ouderlijk-toezicht', label: 'Ouderlijk toezicht', href: '/ouderlijk-toezicht' },
    { key: 'hoe-werkt-het',      label: 'Hoe werkt het',      href: '/hoe-werkt-het' },
    { key: 'functies',           label: 'Functies',           href: '/functies' },
  ];

  return (
    <div className="hp-root">
      <PageMeta
        title="Pulse — Voor ouder en kind. Veilig verbonden."
        description="Pulse is een veilige Nederlandse communicatie-app voor kinderen: chatten, bellen en videobellen, zonder telefoonnummer en e-mailadres, onder ouderlijk toezicht."
        canonical="https://pulse-messenger.com/"
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
        <div className="hp-hero-inner">
          <div className="hp-hero-text">
            <ul className="hp-hero-features hp-hero-features--lead" aria-label="Belangrijkste voordelen">
              <li className="hp-hero-feature"><span aria-hidden="true"><Shield size={16} /></span> Versleuteld &amp; privé</li>
              <li className="hp-hero-feature"><span aria-hidden="true"><PhoneIcon size={16} /></span> Chatten en (video)bellen</li>
              <li className="hp-hero-feature"><span aria-hidden="true"><Users size={16} /></span> Ouderlijk toezicht</li>
            </ul>
            <h1 id="homepage-hero-title" className="hp-hero-title">
              Veilig chatten, bellen en videobellen<br className="hp-hero-title-break" /> voor elk kind
            </h1>
            <p className="hp-hero-sub">
            Met Pulse kunnen kinderen zonder telefoonnummer en e-mailadres veilig chatten, bellen en videobellen. In contact met wie echt telt, volledig onder ouderlijk toezicht.            </p>
            <div className="hp-hero-cta-row">
              <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>
                Start met Pulse
              </button>
              <a href="/hoe-werkt-het" className="hp-cta-btn hp-cta-btn--secondary">
                Bekijk hoe het werkt
              </a>
            </div>
          </div>

          <HeroVideo />
        </div>
      </section>


      {/* ── FUNCTIES ── */}
      <section className="hp-section" id="functies" aria-labelledby="homepage-features-title">
        <div className="hp-section-inner">
          <h2 id="homepage-features-title" className="sr-only">Belangrijkste Pulse functies</h2>

          {/* Rij 1 — Privacy-First */}
          <article className="hp-feature-row" id="privacy" aria-labelledby="homepage-feature-privacy">
            <div className="hp-feature-text">
              <div className="hp-feature-tag">Privacy-First</div>
              <h2 id="homepage-feature-privacy">Pulse staat voor privacy-first</h2>
              <p>Pulse verzamelt niet wat niet nodig is. Geen algoritmes, geen profielen, geen gedragsanalyse. Berichten verdwijnen automatisch volgens de ingestelde timer, met 30 dagen als standaard. Verwijderen is echt verwijderen.</p>
              <a href="/privacy-first" className="hp-read-more-btn" aria-label="Lees meer over Privacy-First bij Pulse">
                Lees meer <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="hp-feature-mockup">
              <div className="hp-img-container hp-img-tilt-subtle">
                <img
                  src="/screenshots/avg.png"
                  alt="Privacy-First bij Pulse"
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
          <article className="hp-feature-row hp-feature-row--reverse" id="veiligheid" aria-labelledby="homepage-feature-communication">
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
            <div className="hp-feature-text">
              <div className="hp-feature-tag">Communicatie</div>
              <h2 id="homepage-feature-communication">Chatten, bellen en videobellen in de app</h2>
              <p>Blijf veilig verbonden met familie en vrienden in de Pulse app. Chatten, bellen en videobellen zonder telefoonnummer, foto’s, gifs of algoritmes. Pulse is pure communicatie.
              </p>
              <a href="/functies#chatten" className="hp-read-more-btn" aria-label="Lees meer over chatten op web en bellen in de app">
                Lees meer <span aria-hidden="true">→</span>
              </a>
            </div>
          </article>

          {/* Rij 3 */}
          <article className="hp-feature-row" id="toezicht" aria-labelledby="homepage-feature-parental-controls">
            <div className="hp-feature-text">
              <div className="hp-feature-tag">Ouderlijk toezicht</div>
              <h2 id="homepage-feature-parental-controls">Volledig overzicht voor ouders</h2>
              <p>Ouders hebben volledig toezicht via een eigen dashboard. Chatten, bellen en videobellen in de app blijven overzichtelijk beheerd. Direct meldingen bij nieuwe activiteiten van je kinderen.</p>
              <a href="/ouderlijk-toezicht#dashboard" className="hp-read-more-btn" aria-label="Lees meer over ouderlijk toezicht">
                Lees meer <span aria-hidden="true">→</span>
              </a>
            </div>
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
          </article>

        </div>
      </section>


      {/* ── CTA ── */}
      <section className="ot-final-cta">
        <h2>Veilig verbonden.<br className="ot-final-cta-break" />{' '}Met wie echt telt.</h2>
        <p>Pulse helpt gezinnen om in contact te blijven op een manier die vertrouwd, veilig en privé voelt. Voor kinderen. Voor ouders. Voor iedereen die erom geeft.</p>
        <div className="ot-final-cta-actions">
          <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>Ouderaccount aanmaken</button>
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
