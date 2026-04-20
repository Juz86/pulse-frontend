import React, { useEffect, useRef, useState } from 'react';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import PageMeta from '../components/PageMeta';
import useMarketingAuth from '../hooks/useMarketingAuth';
import { Shield } from '../components/Icons';
import { getWebAppLoginUrl, isLandingBuild } from '../lib/siteTarget';

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a13.2 13.2 0 0 1 0 18" />
      <path d="M12 3a13.2 13.2 0 0 0 0 18" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function AndroidIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84 1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C14.15 1.23 13.1 1 12 1c-1.1 0-2.15.23-3.12.63L7.4.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.3 1.3C6.14 3.07 5 5.06 5 7h14c0-1.94-1.14-3.93-3.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z" />
    </svg>
  );
}

function StoreBadge({ icon, label, sublabel }) {
  return (
    <span className="dl-store-badge">
      <span className="dl-store-icon" aria-hidden="true">{icon}</span>
      <span className="dl-store-copy">
        <span>{label}</span>
        <strong>{sublabel}</strong>
      </span>
    </span>
  );
}

function CarouselSection({ title, intro, theme = 'sand', cards, sectionClassName = '' }) {
  const trackRef = useRef(null);

  const scrollCards = (direction) => {
    const node = trackRef.current;
    if (!node) return;
    const amount = Math.max(320, Math.round(node.clientWidth * 0.72));
    node.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  return (
    <section className={`dl-carousel dl-carousel--${theme} ${sectionClassName}`.trim()}>
      <div className="dl-section-inner dl-carousel-inner">
        <div className="dl-carousel-copy">
          <h2>{title}</h2>
          <p>{intro}</p>
          <div className="dl-carousel-controls" aria-label="Scroll door opties">
            <button type="button" className="dl-carousel-arrow dl-carousel-arrow--muted" onClick={() => scrollCards(-1)} aria-label="Scroll naar links">
              &#8249;
            </button>
            <button type="button" className="dl-carousel-arrow" onClick={() => scrollCards(1)} aria-label="Scroll naar rechts">
              &#8250;
            </button>
          </div>
        </div>

        <div className="dl-carousel-track" ref={trackRef}>
          {cards.map((card) => (
            <article key={card.title} className={`dl-option-card${card.infoCard ? ' dl-option-card--info' : ''}`}>
              {card.badge ? <span className="dl-option-badge">{card.badge}</span> : null}
              {card.eyebrow ? <div className="dl-option-eyebrow">{card.eyebrow}</div> : null}
              {card.image ? <div className={`dl-option-image dl-option-image--${card.image}`.trim()} aria-hidden="true" /> : null}
              <h3>{card.title}</h3>
              <p>{card.text}</p>
              {card.meta ? <div className="dl-option-meta">{card.meta}</div> : null}
              {card.cta ? (
                <a href={card.href} className={`dl-option-link${card.badgeStyle === 'store' ? ' dl-option-link--store' : ''}`}>
                  {card.cta}
                </a>
              ) : null}
              {card.storeBadge ? (
                <a href={card.href} className="dl-option-store-link">
                  <StoreBadge icon={card.storeBadge.icon} label={card.storeBadge.label} sublabel={card.storeBadge.sublabel} />
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function DownloadPagina({ onParentClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { openLogin, modals: marketingAuthModals } = useMarketingAuth({ onParentClick });
  const webLoginUrl = isLandingBuild ? getWebAppLoginUrl({ role: 'parent', mode: 'login' }) : '/?role=parent&mode=login';

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
    { key: 'hoe-werkt-het', label: 'Hoe werkt het', href: '/hoe-werkt-het' },
    { key: 'functies', label: 'Functies', href: '/functies' },
  ];

  const otherOptions = [
    {
      badge: 'NIEUW',
      eyebrow: 'Tablet',
      title: 'iPadOS',
      text: 'Een grotere weergave voor Pulse zodra de tabletversie beschikbaar is voor gezinnen en ouderlijk toezicht.',
      meta: 'Binnenkort beschikbaar',
      storeBadge: { icon: <AppleIcon />, label: 'Download in de', sublabel: 'App Store' },
      href: '/contact',
      badgeStyle: 'store',
    },
    {
      eyebrow: 'Desktop',
      title: 'Windows',
      text: 'Voor een rustige desktop-ervaring met aanmelden via het Pulse webportaal en ruimte voor langere gesprekken.',
      meta: 'Gebruik nu alvast Pulse Web',
      storeBadge: { icon: <GlobeIcon />, label: 'Open direct in', sublabel: 'Pulse Web' },
      href: webLoginUrl,
      badgeStyle: 'store',
    },
    {
      eyebrow: 'Mobiel',
      title: 'Android',
      text: 'De Android-app sluit straks aan op dezelfde privacy-first basis, zonder telefoonnummer en met oudertoezicht.',
      meta: 'Nog geen Play Store-link',
      storeBadge: { icon: <AndroidIcon />, label: 'Bekijk', sublabel: 'Updates' },
      href: '/over-pulse',
      badgeStyle: 'store',
    },
  ];

  const learnMoreCards = [
    {
      image: 'privacy',
      title: 'Verstuur priveberichten',
      text: 'Lees hoe Pulse communicatie veilig en rustig houdt voor kinderen en ouders.',
      cta: 'Meer informatie',
      href: '/privacy-first',
      infoCard: true,
    },
    {
      image: 'family',
      title: 'Blijf verbonden',
      text: 'Bekijk hoe ouders en kinderen samen starten met Pulse op web en straks in de apps.',
      cta: 'Meer informatie',
      href: '/hoe-werkt-het',
      infoCard: true,
    },
    {
      image: 'community',
      title: 'Ontwikkeld voor gezinnen',
      text: 'Ontdek waarom Pulse geen standaard chatapp is, maar een veilige familie-omgeving.',
      cta: 'Meer informatie',
      href: '/over-pulse',
      infoCard: true,
    },
  ];

  return (
    <div className="hp-root dl-root">
      <PageMeta
        title="Download Pulse"
        description="Gebruik Pulse op web, iPhone en Android. Bekijk de downloadopties en start veilig met Pulse."
        canonical="https://pulse-messenger.com/download"
      />

      <MarketingNavbar
        items={navItems}
        activeKey={null}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        scrolled={scrolled}
      />

      <main id="main-content" className="dl-main" data-page="download">
        <section className="dl-hero" aria-labelledby="download-title">
          <div className="dl-section-inner dl-hero-inner">
            <div className="dl-hero-copy">
             
              <h1 id="download-title">Download Pulse</h1>
              <p className="dl-hero-intro">
                Veilig chatten, bellen en video-bellen met Pulse op al je apparaten.
              </p>

              <article className="dl-hero-card" id="web">
                <div className="dl-hero-card-eyebrow">Browser</div>
                <h2>Pulse Web</h2>
                <p>
                  Wordt je apparaat nog niet ondersteund? Gebruik Pulse direct in je browser.
                </p>
                <a href={webLoginUrl} className="dl-hero-login">
                  Inloggen <span aria-hidden="true">&#8250;</span>
                </a>
              </article>
            </div>

            <div className="dl-hero-illustration" aria-hidden="true">
              <div className="dl-laptop">
                <div className="dl-laptop-screen">
                  <div className="dl-laptop-sidebar">
                    <div className="dl-parent-brand">
                      <span className="dl-parent-brand-mark" />
                    </div>
                    <span className="dl-parent-side-dot dl-parent-side-dot--active" />
                    <span className="dl-parent-side-dot" />
                    <span className="dl-parent-side-dot" />
                    <div className="dl-parent-side-user">Y</div>
                  </div>

                  <div className="dl-parent-shell">
                    <div className="dl-parent-topbar">
                      <div>
                        <div className="dl-parent-eyebrow">Ouderaccount</div>
                        <div className="dl-parent-heading">Ouderportaal</div>
                      </div>
                      <div className="dl-parent-topbar-badge">3 updates</div>
                    </div>

                    <div className="dl-parent-tabs">
                      <span className="dl-parent-tab dl-parent-tab--active">Mijn kinderen</span>
                      <span className="dl-parent-tab">Activiteiten</span>
                      <span className="dl-parent-tab">Instellingen</span>
                    </div>

                    <div className="dl-parent-grid">
                      <div className="dl-parent-panel dl-parent-panel--children">
                        <div className="dl-parent-card">
                          <div className="dl-parent-card-head">
                            <div className="dl-parent-avatar">T</div>
                            <div>
                              <div className="dl-parent-name">Tim</div>
                              <div className="dl-parent-meta"><span className="dl-parent-status" /> Online · 2 min geleden</div>
                            </div>
                          </div>
                          <div className="dl-parent-stats">
                            <span>5 contacten</span>
                            <span>8 chats</span>
                          </div>
                          <div className="dl-parent-actions">
                            <span className="dl-parent-chip">Pauze</span>
                            <span className="dl-parent-icon" />
                            <span className="dl-parent-icon" />
                          </div>
                        </div>

                        <div className="dl-parent-card dl-parent-card--soft">
                          <div className="dl-parent-card-head">
                            <div className="dl-parent-avatar dl-parent-avatar--soft">M</div>
                            <div>
                              <div className="dl-parent-name">Mila</div>
                              <div className="dl-parent-meta"><span className="dl-parent-status dl-parent-status--muted" /> Offline · 1 uur geleden</div>
                            </div>
                          </div>
                          <div className="dl-parent-stats">
                            <span>3 contacten</span>
                            <span>4 chats</span>
                          </div>
                          <div className="dl-parent-actions">
                            <span className="dl-parent-chip">Toezicht</span>
                            <span className="dl-parent-icon" />
                            <span className="dl-parent-icon" />
                          </div>
                        </div>
                      </div>

                      <div className="dl-parent-panel dl-parent-panel--activity">
                        <div className="dl-parent-panel-title">Recente activiteiten</div>
                        <div className="dl-parent-activity">
                          <span className="dl-parent-activity-icon">+</span>
                          <div>
                            <strong>Nieuw contactverzoek</strong>
                            <span>Tim wil Sam toevoegen</span>
                          </div>
                        </div>
                        <div className="dl-parent-activity">
                          <span className="dl-parent-activity-icon dl-parent-activity-icon--soft">✓</span>
                          <div>
                            <strong>Toezicht actief</strong>
                            <span>Mila gebruikt een goedgekeurde lijst</span>
                          </div>
                        </div>
                        <div className="dl-parent-summary">
                          <div className="dl-parent-summary-card">
                            <span>Kinderen online</span>
                            <strong>1 van 2</strong>
                          </div>
                          <div className="dl-parent-summary-card dl-parent-summary-card--accent">
                            <span>Nieuwe meldingen</span>
                            <strong>3</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="dl-laptop-base" />
              </div>
              <div className="dl-hero-float dl-hero-float--star" />
              <div className="dl-hero-float dl-hero-float--mic" />
              <div className="dl-hero-float dl-hero-float--paper" />
              <div className="dl-hero-float dl-hero-float--check" />
            </div>
          </div>
        </section>

        <CarouselSection
          title="Andere downloadopties"
          intro="Blijf in contact met familie en vrienden via al je apparaten."
          theme="sand"
          cards={otherOptions}
        />

        <CarouselSection
          title="Al gedownload?"
          intro="Bekijk meer informatie over wat je kunt doen in Pulse."
          theme="light"
          cards={learnMoreCards}
          sectionClassName="dl-carousel--learn"
        />

        <section className="dl-bottom-cta" aria-labelledby="download-bottom-title">
          <div className="dl-section-inner dl-bottom-cta-inner">
            <div>
              <div className="dl-bottom-kicker"><Shield size={16} aria-hidden="true" /> Privacy-first</div>
              <h2 id="download-bottom-title">Open Pulse Web of lees eerst hoe het werkt</h2>
            </div>
            <div className="dl-bottom-actions">
              <a href={webLoginUrl} className="dl-bottom-btn">Open Pulse Web</a>
              <button type="button" className="dl-bottom-btn dl-bottom-btn--ghost" onClick={openLogin}>Inloggen</button>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
      {marketingAuthModals}
    </div>
  );
}
