import React from 'react';
import LegalPageLayout from '../components/LegalPageLayout';
import { Login } from '../components/Icons';
import useMarketingAuth from '../hooks/useMarketingAuth';

const SITEMAP = [
  {
    title: 'Functies',
    links: [
      { label: 'Chatten',       href: '/functies#chatten' },
      { label: 'Bellen',        href: '/functies#bellen' },
      { label: 'Videobellen',   href: '/functies#videobellen' },
      { label: 'Alle functies', href: '/functies' },
    ],
  },
  {
    title: 'Hoe werkt het',
    links: [
      { label: 'Aan de slag',          href: '/hoe-werkt-het' },
      { label: 'Account aanmaken',     href: '/hoe-werkt-het#account' },
      { label: 'Contacten toevoegen',  href: '/hoe-werkt-het#contacten' },
      { label: 'Gesprekken starten',   href: '/hoe-werkt-het#gesprekken' },
    ],
  },
  {
    title: 'Ouderlijk toezicht',
    links: [
      { label: 'Dashboard',             href: '/ouderlijk-toezicht#dashboard' },
      { label: 'Contactbeheer',         href: '/ouderlijk-toezicht#contactbeheer' },
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
    <div style={{
      borderBottom: '1px solid var(--border)',
      paddingBottom: 32,
      marginBottom: 32,
    }}>
      <h2 style={{
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--accent)',
        marginBottom: 16,
      }}>
        {title}
      </h2>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {links.map(({ label, href }) => (
          <li key={label}>
            <a
              href={href}
              style={{
                color: 'var(--accent)',
                textDecoration: 'none',
                fontSize: 16,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                opacity: 0.8,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.8'; }}
            >
              <span style={{
                display: 'inline-block',
                width: 6, height: 6,
                borderRadius: '50%',
                background: 'var(--accent)',
                flexShrink: 0,
                opacity: 0.5,
              }} />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
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
        lastUpdated="4 april 2026"
        canonical="/sitemap"
        metaTitle="Sitemap — Pulse Messenger"
        metaDescription="Overzicht van alle pagina's en secties op de Pulse Messenger-website."
        cta={
          <section className="ot-final-cta">
            <h2>Veilig verbonden.<br className="ot-final-cta-break" />{' '}Met wie echt telt.</h2>
            <p>Pulse helpt gezinnen om in contact te blijven op een manier die vertrouwd, veilig en rustig voelt. Voor kinderen. Voor ouders. Voor iedereen die erom geeft.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="hp-cta-btn" onClick={openParentSignup}>Ouderaccount aanmaken</button>
              <button
                type="button"
                className="hp-cta-btn"
                style={{ background: '#fff', border: '1.5px solid rgba(108,99,255,0.4)', color: '#6c63ff', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={openLogin}
              >
                <Login size={18} /> Inloggen
              </button>
            </div>
          </section>
        }
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0 48px',
        }}>
          {SITEMAP.slice(0, 3).map(section => (
            <SitemapSection key={section.title} title={section.title} links={section.links} />
          ))}
        </div>
        {SITEMAP.length > 3 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '0 48px',
            marginTop: 8,
          }}>
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
