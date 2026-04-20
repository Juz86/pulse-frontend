import React, { useEffect, useState } from 'react';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import PageMeta from '../components/PageMeta';
import useMarketingAuth from '../hooks/useMarketingAuth';
import { Download, Lock, Login, Shield } from '../components/Icons';
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

function PlatformCard({
  id,
  badge,
  title,
  description,
  meta,
  icon,
  primaryLabel,
  primaryHref,
  primaryOnClick,
  secondaryLabel,
  secondaryHref,
  note,
  available = true,
}) {
  return (
    <article className={`dl-card${available ? '' : ' dl-card--coming-soon'}`} id={id}>
      <div className="dl-card-top">
        <span className={`dl-card-badge${available ? '' : ' dl-card-badge--muted'}`}>{badge}</span>
        <div className="dl-card-icon" aria-hidden="true">{icon}</div>
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="dl-card-meta">{meta}</div>
      <div className="dl-card-actions">
        {primaryHref ? (
          <a href={primaryHref} className="dl-btn">
            {primaryLabel}
          </a>
        ) : (
          <button type="button" className="dl-btn" onClick={primaryOnClick}>
            {primaryLabel}
          </button>
        )}
        {secondaryLabel ? (
          <a href={secondaryHref} className="dl-btn dl-btn--secondary">
            {secondaryLabel}
          </a>
        ) : null}
      </div>
      <p className="dl-card-note">{note}</p>
    </article>
  );
}

export default function DownloadPagina({ onParentClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { openParentSignup, openLogin, modals: marketingAuthModals } = useMarketingAuth({ onParentClick });
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

  return (
    <div className="hp-root dl-root">
      <PageMeta
        title="Download Pulse"
        description="Gebruik Pulse op web, iPhone en Android. Bekijk welke versie beschikbaar is en hoe je veilig start met Pulse."
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
          <div className="dl-hero-inner">
            <div className="dl-hero-copy">
              <div className="dl-eyebrow">
                <Download size={16} aria-hidden="true" />
                Download Pulse
              </div>
              <h1 id="download-title">Gebruik Pulse op elk scherm dat bij jullie gezin past</h1>
              <p className="dl-hero-text">
                Start veilig met Pulse op web en bekijk meteen welke mobiele versies eraan komen.
                Net als bij WhatsApp staat alles overzichtelijk op één downloadpagina.
              </p>
              <div className="dl-hero-points" aria-label="Belangrijkste voordelen">
                <span><Shield size={15} aria-hidden="true" /> Zonder telefoonnummer</span>
                <span><Lock size={15} aria-hidden="true" /> End-to-end versleuteld</span>
                <span><Login size={15} aria-hidden="true" /> Direct starten op web</span>
              </div>
              <div className="dl-hero-actions">
                <a href="#web" className="dl-btn">Bekijk webversie</a>
                <button type="button" className="dl-btn dl-btn--secondary" onClick={openParentSignup}>
                  Ouderaccount aanmaken
                </button>
              </div>
            </div>

            <div className="dl-hero-visual" aria-hidden="true">
              <div className="dl-visual-orb dl-visual-orb--one" />
              <div className="dl-visual-orb dl-visual-orb--two" />
              <div className="dl-device-stack">
                <div className="dl-device dl-device--browser">
                  <div className="dl-device-bar">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="dl-device-screen">
                    <div className="dl-device-logo">Pulse Web</div>
                    <div className="dl-device-bubbles">
                      <div className="dl-bubble dl-bubble--left">Hoi mam, ik ben veilig thuis.</div>
                      <div className="dl-bubble dl-bubble--right">Top, ik zie het in Pulse.</div>
                      <div className="dl-bubble dl-bubble--left">Zullen we vanavond videobellen?</div>
                    </div>
                  </div>
                </div>
                <div className="dl-device dl-device--phone" />
              </div>
            </div>
          </div>
        </section>

        <section className="dl-platforms" aria-labelledby="download-platforms-title">
          <div className="dl-section-inner">
            <div className="dl-section-head">
              <h2 id="download-platforms-title">Kies je platform</h2>
              <p>Open Pulse direct in je browser of bekijk welke mobiele app-versies je binnenkort kunt verwachten.</p>
            </div>

            <div className="dl-card-grid">
              <PlatformCard
                id="web"
                badge="Nu beschikbaar"
                title="Pulse Web"
                description="Voor ouders en kinderen die meteen veilig willen inloggen via hun browser."
                meta="Browser • Desktop • Laptop"
                icon={<GlobeIcon />}
                primaryLabel="Open Pulse Web"
                primaryHref={webLoginUrl}
                secondaryLabel="Hoe werkt het"
                secondaryHref="/hoe-werkt-het"
                note="Gebruik je bestaande Pulse-account of laat een ouder eerst een account aanmaken."
              />

              <PlatformCard
                id="ios"
                badge="Binnenkort"
                title="Pulse voor iPhone"
                description="De iPhone-versie krijgt dezelfde veilige communicatie-ervaring, afgestemd op gezinnen."
                meta="iOS • iPhone"
                icon={<AppleIcon />}
                primaryLabel="Bekijk updates"
                primaryHref="/over-pulse"
                secondaryLabel="Contact"
                secondaryHref="/contact"
                note="Nog geen publieke App Store-link beschikbaar. Deze sectie houdt de plek alvast vrij."
                available={false}
              />

              <PlatformCard
                id="android"
                badge="Binnenkort"
                title="Pulse voor Android"
                description="De Android-versie sluit aan op dezelfde privacy-first basis met ouderlijk toezicht."
                meta="Android • Telefoon • Tablet"
                icon={<AndroidIcon />}
                primaryLabel="Bekijk updates"
                primaryHref="/over-pulse"
                secondaryLabel="Contact"
                secondaryHref="/contact"
                note="Nog geen publieke Play Store-link beschikbaar. Deze sectie kan later direct worden uitgebreid."
                available={false}
              />
            </div>
          </div>
        </section>

        <section className="dl-steps" aria-labelledby="download-steps-title">
          <div className="dl-section-inner">
            <div className="dl-section-head dl-section-head--compact">
              <h2 id="download-steps-title">Zo start je met Pulse</h2>
            </div>
            <div className="dl-step-grid">
              <article className="dl-step-card">
                <span>1</span>
                <h3>Kies je apparaat</h3>
                <p>Open Pulse Web direct of bekijk de status van iPhone en Android.</p>
              </article>
              <article className="dl-step-card">
                <span>2</span>
                <h3>Log veilig in</h3>
                <p>Ouders beheren de start, kinderen gebruiken een account zonder telefoonnummer of e-mailadres.</p>
              </article>
              <article className="dl-step-card">
                <span>3</span>
                <h3>Blijf verbonden</h3>
                <p>Chat, bel en videobel in een omgeving die privacy en toezicht samenbrengt.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="dl-cta" aria-labelledby="download-cta-title">
          <div className="dl-section-inner dl-cta-inner">
            <div>
              <div className="dl-eyebrow dl-eyebrow--soft">Klaar om te starten?</div>
              <h2 id="download-cta-title">Open Pulse direct of maak eerst een ouderaccount aan</h2>
            </div>
            <div className="dl-cta-actions">
              <a href={webLoginUrl} className="dl-btn">Open Pulse Web</a>
              <button type="button" className="dl-btn dl-btn--secondary" onClick={openLogin}>Inloggen</button>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
      {marketingAuthModals}
    </div>
  );
}
