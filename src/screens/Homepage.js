// src/screens/Homepage.js
import { useState, useEffect, useRef } from 'react';
import {
  Shield,
  PhoneIcon,
  Login,
  Reply,
  Forward,
  BrowserIcon,
  AppleIcon,
  AndroidIcon,
  WindowsIcon,
} from '../components/Icons';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import PageMeta from '../components/PageMeta';
import { Users } from '../components/Icons';
import useMarketingAuth from '../hooks/useMarketingAuth';

const downloadOptionCards = [
  {
    category: 'Browser',
    title: 'Pulse Web',
    description: 'Wordt je apparaat niet ondersteund? Gebruik Pulse in je browser.',
    href: '#',
    icon: BrowserIcon,
    iconClassName: 'hp-download-card-icon--browser',
  },
  {
    category: 'iOS',
    title: 'iPhone/iPad',
    description: 'Profiteer van chatten, bellen en videobellen met de iPhone- en iPad-app.',
    href: '#',
    icon: AppleIcon,
    iconClassName: 'hp-download-card-icon--ios',
  },
  {
    category: 'Android',
    title: 'Mobiel/tablet',
    description: 'Profiteer van chatten, bellen en videobellen met de Android-app.',
    href: '#',
    icon: AndroidIcon,
    iconClassName: 'hp-download-card-icon--android',
  },
  {
    category: 'Desktop',
    title: 'Windows',
    description: 'Profiteer van chatten, bellen en videobellen met de Windows-app.',
    href: '#',
    icon: WindowsIcon,
    iconClassName: 'hp-download-card-icon--desktop',
  },
  {
    category: 'Desktop',
    title: 'Mac',
    description: 'Profiteer van chatten, bellen en videobellen met de Mac-app.',
    href: '#',
    icon: AppleIcon,
    iconClassName: 'hp-download-card-icon--mac',
  },
];

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
          <source src="/videos/Pulse Messenger v4.mp4" type="video/mp4" />
        </video>
      </div>
    </div>
  );
}

function DownloadOptionsSection() {
  const trackRef = useRef(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return undefined;
    }

    const updateScrollState = () => {
      const maxScrollLeft = track.scrollWidth - track.clientWidth;
      setCanScrollPrev(track.scrollLeft > 8);
      setCanScrollNext(maxScrollLeft - track.scrollLeft > 8);
    };

    updateScrollState();
    track.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);

    return () => {
      track.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, []);

  const scrollCards = (direction) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const firstCard = track.querySelector('.hp-download-card');
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 320;
    const gap = 20;
    track.scrollBy({
      left: direction * (cardWidth + gap),
      behavior: 'smooth',
    });
  };

  return (
    <section className="hp-download-options" aria-labelledby="homepage-download-options-title">
      <div className="hp-section-inner hp-download-options-inner">
        <div className="hp-download-options-copy">
          <div className="hp-feature-tag">Pulse downloaden</div>
          <h2 id="homepage-download-options-title">Andere downloadopties</h2>
          <p>Blijf in contact met familie en vrienden via al je apparaten.</p>
          <div className="hp-download-options-controls" aria-label="Scroll door downloadopties">
            <button
              type="button"
              className="hp-download-arrow"
              onClick={() => scrollCards(-1)}
              disabled={!canScrollPrev}
              aria-label="Scroll naar links"
            >
              <Reply size={22} />
            </button>
            <button
              type="button"
              className="hp-download-arrow"
              onClick={() => scrollCards(1)}
              disabled={!canScrollNext}
              aria-label="Scroll naar rechts"
            >
              <Forward size={22} />
            </button>
          </div>
        </div>

        <div className="hp-download-options-rail">
          <div className="hp-download-options-track" ref={trackRef}>
            {downloadOptionCards.map((card) => {
              const Icon = card.icon;

              return (
                <article className="hp-download-card" key={card.title}>
                  <div className={`hp-download-card-icon ${card.iconClassName}`}>
                    <Icon size={22} />
                  </div>
                  <span className="hp-download-card-category">{card.category}</span>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  <a href={card.href} className="hp-download-card-link">
                    Downloaden <span aria-hidden="true">→</span>
                  </a>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Homepage({ onParentClick }) {
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [scrolled,      setScrolled]      = useState(false);
  const { openParentSignup, openLogin, modals: marketingAuthModals } = useMarketingAuth({ onParentClick });

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
              <button type="button" className="hp-cta-btn" onClick={openParentSignup}>
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

      <DownloadOptionsSection />


      {/* ── CTA ── */}
      <section className="ot-final-cta">
        <h2>Veilig verbonden.<br className="ot-final-cta-break" />{' '}Met wie echt telt.</h2>
        <p>Pulse helpt gezinnen om in contact te blijven op een manier die vertrouwd, veilig en privé voelt. Voor kinderen. Voor ouders. Voor iedereen die erom geeft.</p>
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

      {/* ── FOOTER ── */}
      <MarketingFooter />

      {marketingAuthModals}

    </div>
  );
}
