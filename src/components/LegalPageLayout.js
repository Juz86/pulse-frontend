import React, { useEffect, useState } from 'react';
import MarketingNavbar from './MarketingNavbar';
import MarketingFooter from './MarketingFooter';
import PageMeta from './PageMeta';

export default function LegalPageLayout({
  badge,
  title,
  intro,
  lastUpdated,
  canonical,
  metaTitle,
  metaDescription,
  children,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
    <div className="hp-root legal-root">
      <PageMeta
        title={metaTitle}
        description={metaDescription}
        canonical={canonical}
      />

      <MarketingNavbar
        items={navItems}
        activeKey={null}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        scrolled={scrolled}
      />

      <main id="main-content" className="legal-main">
        <section className="legal-hero">
          <div className="legal-hero-inner">
            <div className="fp-hero-badge legal-hero-badge">{badge}</div>
            <h1 className="legal-hero-title">{title}</h1>
            <p className="legal-hero-intro">{intro}</p>
            <div className="legal-hero-meta">
              <span className="legal-meta-label">Laatst bijgewerkt</span>
              <span className="legal-meta-value">{lastUpdated}</span>
            </div>
          </div>
        </section>

        <div className="legal-content">
          {children}
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
