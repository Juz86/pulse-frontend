import React from 'react';
import LegalPageLayout from '../components/LegalPageLayout';
import { Login } from '../components/Icons';
import useMarketingAuth from '../hooks/useMarketingAuth';

const SITEMAP = [
  {
    title: 'Functies',
    links: [
      { label: 'Chatten',       href: '/functies#chatten' },
      { label: 'Alle functies', href: '/functies' },
    ],
  },
  {
    title: 'Hoe werkt het',
    links: [
      { label: 'Aan de slag',          href: '/hoe-werkt-het' },
      { label: 'Account aanmaken',     href: '/hoe-werkt-het#registreren' },
      { label: 'Contacten toevoegen',  href: '/hoe-werkt-het#contact-toevoegen' },
    ],
  },
  {
    title: 'Ouderlijk toezicht',
    links: [
      { label: 'Dashboard',             href: '/ouderlijk-toezicht#dashboard' },
      { label: 'Functies pauzeren',     href: '/ouderlijk-toezicht#pauzeren' },
      { label: 'Activiteitenoverzicht', href: '/ouderlijk-toezicht#activiteiten' },
    ],
  },
  {
    title: 'Over Pulse',
    links: [
      { label: 'Ons verhaal',          href: '/over-pulse' },
      { label: 'Privacy & AVG',        href: '/over-pulse#privacy' },
      { label: 'Voor gezinnen',        href: '/over-pulse#voor-wie' },
      { label: 'Voor scholen',         href: '/over-pulse#voor-wie' },
      { label: 'Voor partners',        href: '/over-pulse#voor-wie' },
    ],
  },
  {
    title: 'Juridisch & Privacy',
    links: [
      { label: 'Privacybeleid',                            href: '/privacybeleid' },
      { label: 'AVG-beleid elektronische communicatie',    href: '/avg-beleid-elektronische-communicatie' },
      { label: 'Sitemap',                                  href: '/sitemap' },
    ],
  },
  {
    title: 'Contact',
    links: [
      { label: 'Contactformulier',   href: '/contact' },
      { label: 'E-mail',             href: 'mailto:info@pulse-messenger.com' },
    ],
  },
];

function SitemapSection({ title, links }) {
  return (
    <section className="sitemap-section">
      <h2 className="sitemap-section-title">{title}</h2>
      <ul className="sitemap-links">
        {links.map(({ label, href }) => (
          <li key={label}>
            <a href={href} className="sitemap-link">
              <span className="sitemap-link-marker" />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SitemapPagina() {
  const { openParentSignup, openLogin, modals: marketingAuthModals } = useMarketingAuth();

  return (
    <>
      <LegalPageLayout
        badge="Sitemap"
        title="Sitemap"
        intro="Een overzicht van alle pagina's en secties van de Pulse-website."
        lastUpdated="22 november 2026"
        canonical="/sitemap"
        metaTitle="Sitemap — Pulse Messenger"
        metaDescription="Overzicht van alle pagina's en secties op de Pulse Messenger-website."
        cta={
          <section className="ot-final-cta">
            <h2>Veilig verbonden.<br className="ot-final-cta-break" />{' '}Met wie echt telt.</h2>
            <p>Pulse helpt gezinnen om in contact te blijven op een manier die vertrouwd, veilig en rustig voelt. Voor kinderen. Voor ouders. Voor iedereen die erom geeft.</p>
            <div className="ot-final-cta-actions">
              <button type="button" className="hp-cta-btn" onClick={openParentSignup}>Ouderaccount aanmaken</button>
              <button
                type="button"
                className="hp-cta-btn contact-cta-btn-login"
                onClick={openLogin}
              >
                <Login size={18} /> Inloggen
              </button>
            </div>
          </section>
        }
      >
        <div className="sitemap-grid sitemap-grid--primary">
          {SITEMAP.slice(0, 3).map(section => (
            <SitemapSection key={section.title} title={section.title} links={section.links} />
          ))}
        </div>
        {SITEMAP.length > 3 && (
          <div className="sitemap-grid sitemap-grid--secondary">
            {SITEMAP.slice(3).map(section => (
              <SitemapSection key={section.title} title={section.title} links={section.links} />
            ))}
          </div>
        )}
      </LegalPageLayout>

      {marketingAuthModals}
    </>
  );
}
