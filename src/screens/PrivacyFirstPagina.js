// src/screens/PrivacyFirstPagina.js
import { useEffect, useRef, useState } from 'react';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import AuthModal from '../components/AuthModal';
import ParentAuthModal from '../components/ParentAuthModal';
import PageMeta from '../components/PageMeta';
import DecorativeAvatar, { avatarSvgs } from '../components/DecorativeAvatars';
import {
  Check,
  Clock,
  Lock,
  Login,
  Shield,
  Users,
  User,
  Message,
  Activity,
  Mail,
  Trash2,
  Child,
} from '../components/Icons';

function useFadeIn() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
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

const retentionRows = [
  { label: 'Accountgegevens ouders',       Icon: User,     duration: 'Zolang actief',     onDelete: 'Bij verwijderen → direct weg' },
  { label: 'Accountgegevens kinderen',     Icon: Child,   duration: 'Zolang actief',     onDelete: 'Bij verwijderen → direct weg' },
  { label: 'Vertrouwde contacten',         Icon: Users,    duration: 'Zolang gekoppeld',  onDelete: 'Bij ontkoppelen → direct weg' },
  { label: 'Berichten en communicatie',    Icon: Message,  duration: 'Maximaal 30 dagen', why: 'Zodat je recente gesprekken kunt teruglezen',           onDelete: 'Daarna → automatisch verwijderd' },
  { label: 'Logbestanden',                 Icon: Activity, duration: 'Maximaal 7 dagen',  why: 'Alleen voor veiligheid en technische stabiliteit',      onDelete: 'Daarna → automatisch verwijderd' },
  { label: 'Support- en privacyverzoeken', Icon: Mail,     duration: 'Maximaal 30 dagen', why: 'Om je goed te kunnen helpen',                           onDelete: 'Daarna → automatisch verwijderd' },
];

export default function PrivacyFirstPagina({ onParentClick }) {
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [scrolled,        setScrolled]        = useState(false);
  const [showAuthModal,   setShowAuthModal]   = useState(false);
  const [showParentModal, setShowParentModal] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

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
        title="Privacy-First — Pulse beschermt, verzamelt niet"
        description="Pulse is 100% privacy-first. Geen dataverzameling, geen algoritmes, geen profielen. Lees hoe Pulse omgaat met jouw gegevens — eerlijk, duidelijk en zonder jargon."
        canonical="https://pulse-messenger.com/privacy-first"
      />
      <MarketingNavbar
        items={navItems}
        activeKey="privacy-first"
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
              <div className="fp-hero-badge">Privacy-First</div>
              <h1 className="ot-hero-title ot-hero-title--marketing">
                Veilig verbonden.<br />
                <span style={{ whiteSpace: 'nowrap' }}>Zonder ruis. Zonder zorgen.</span>
              </h1>
              <p className="ot-hero-sub">
                Bij Pulse draait alles om één ding: rust en veiligheid voor ouder en kind.
              </p>
              <p className="ot-hero-sub" style={{ marginTop: 12 }}>
                Geen social media. Geen algoritmes. Geen dataverzameling.<br />
                Gewoon communiceren — zoals het bedoeld is.
              </p>
              <div className="ot-hero-actions">
                <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>
                  Ouderaccount aanmaken
                </button>
                <a href="/privacybeleid" className="ot-secondary-btn" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  Privacybeleid lezen
                </a>
              </div>
            </div>
            <div className="ot-hero-visual" aria-hidden="true">
              <div className="op-privacy-card" style={{ maxWidth: 320 }}>
                <div className="op-privacy-icon"><Shield size={36} /></div>
                <div className="op-privacy-title">100% Privacy-First</div>
                <div className="op-privacy-sub">
                  Geen social media.<br />
                  Geen algoritmes.<br />
                  Geen dataverzameling.<br />
                  Gewoon communiceren.
                </div>
                <div className="op-privacy-badges" style={{ marginTop: 20 }}>
                  <span><Users size={12} /> Toezicht</span>
                  <span><Lock size={12} /> End-to-End</span>
                  <span><Clock size={12} /> 30 dagen</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── WAAROM PULSE BESTAAT ── */}
        <section className="hp-section" id="waarom-pulse">
          <div className="hp-section-inner">
            <FadeRow className="op-privacy-row">
              <div className="hp-feature-text">
                <div className="hp-feature-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Users size={14} /> Waarom Pulse bestaat</div>
                <h3>Pulse is bedacht door een vader.</h3>
                <p>Een vader die zich zorgen maakte.</p>
                <p style={{ marginTop: 16 }}>
                  Over hoe kinderen vandaag opgroeien in een digitale wereld vol prikkels. Over apps die alles volgen, analyseren en opslaan. Over hoe weinig controle ouders eigenlijk hebben.
                </p>
                <p style={{ marginTop: 16 }}>Hij wilde iets anders.</p>
                <p style={{ marginTop: 8 }}>
                  Iets simpels. Iets veiligs. Iets wat alleen draait om contact tussen ouder en kind.
                </p>
                <p style={{ marginTop: 16, fontWeight: 700, color: 'var(--text)' }}>Zo is Pulse ontstaan.</p>
              </div>
              <div className="hp-feature-mockup">
                <div className="op-privacy-card">
                  <div className="op-privacy-icon" style={{ marginBottom: 12 }}><Message size={32} /></div>
                  <div className="op-privacy-title">Een belofte aan ouders</div>
                  <div className="op-privacy-sub">
                    "Iets simpels. Iets veiligs. Iets wat alleen draait om contact tussen ouder en kind."
                  </div>
                  <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
                    — Oprichter van Pulse
                  </div>
                </div>
              </div>
            </FadeRow>
          </div>
        </section>

        {/* ── WAT PRIVACY-FIRST BETEKENT ── */}
        <section className="hp-section hp-section--gray" id="privacy-first">
          <div className="hp-section-inner">
            <FadeRow className="op-privacy-row">
              <div className="hp-feature-text">
                <div className="hp-feature-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Shield size={14} /> Wat Privacy-First betekent bij Pulse</div>
                <h3>Privacy is voor ons geen instelling. Het is de basis.</h3>
                <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[
                    'Wij verzamelen geen onnodige data',
                    'Wij verkopen geen data',
                    'Wij analyseren geen gedrag',
                    'Wij bouwen geen profielen',
                    'Wij gebruiken geen algoritmes',
                  ].map((item) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0', borderRadius: 14 }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 18 }}>✕</span>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hp-feature-mockup">
                <div className="op-privacy-card">
                  <div className="op-privacy-icon" style={{ marginBottom: 12 }}><Shield size={32} /></div>
                  <div className="op-privacy-title">Pulse heeft niets aan jouw data — en wil het ook niet.</div>
                  <div className="op-privacy-sub" style={{ marginTop: 12 }}>
                    Sterker nog: wat we niet nodig hebben, slaan we niet op.
                  </div>
                </div>
              </div>
            </FadeRow>
          </div>
        </section>

        {/* ── WAT WE WEL OPSLAAN ── */}
        <section className="hp-section" id="wat-opslaan">
          <div className="hp-section-inner">
            <FadeRow className="op-privacy-row">
              <div className="hp-feature-text">
                <div className="hp-feature-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Lock size={14} /> Wat we wél opslaan en waarom</div>
                <h3>Zo weinig mogelijk. Zo kort mogelijk.</h3>
                <p style={{ marginTop: 8, color: 'var(--text2)' }}>We slaan alleen op wat echt nodig is om de app te laten werken — en nooit langer dan nodig.</p>
                <div style={{ marginTop: 24 }}>
                  {retentionRows.map((row) => (
                    <div key={row.label} className="pf-retention-row">
                      <div className="pf-retention-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--accent)', display: 'flex' }}><row.Icon size={18} /></span>{row.label}
                      </div>
                      {row.why && <div className="pf-retention-why">{row.why}</div>}
                      <div className="pf-retention-meta">
                        <span className="pf-retention-badge pf-retention-badge--duration">
                          <Clock size={12} /> {row.duration}
                        </span>
                        <span className="pf-retention-badge pf-retention-badge--delete">
                          ✓ {row.onDelete}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hp-feature-mockup">
                <div className="op-privacy-card">
                  <div className="op-privacy-icon" style={{ marginBottom: 12 }}><Trash2 size={32} /></div>
                  <div className="op-privacy-title">Verwijderen = echt verwijderen</div>
                  <div className="op-privacy-sub" style={{ marginTop: 12 }}>
                    Geen archieven.<br />Geen kopieën.<br />Geen verborgen opslag.
                  </div>
                </div>
              </div>
            </FadeRow>
          </div>
        </section>

        {/* ── BEVEILIGING / E2EE ── */}
        <section className="hp-section" id="beveiliging">
          <div className="hp-section-inner">
            <FadeRow className="op-privacy-row">
              <div className="hp-feature-text">
                <div className="hp-feature-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Lock size={14} /> Veiligheid: End-to-End Encryptie</div>
                <h3>Alles wat je verstuurt via Pulse is beveiligd met end-to-end encryptie (E2EE).</h3>
                <p style={{ marginTop: 16 }}>Dat betekent:</p>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[
                    'Alleen jij en de ontvanger kunnen berichten lezen',
                    'Niemand anders — ook Pulse niet',
                    'Geen toegang. Geen inzage. Geen meelezen',
                  ].map((item) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0', borderRadius: 14 }}>
                      <span style={{ color: 'var(--accent)', display: 'flex' }}><Check size={18} /></span>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hp-feature-mockup">
                <div className="op-privacy-card" style={{ textAlign: 'center' }}>
                  <div className="op-privacy-icon" style={{ marginBottom: 12 }}><Lock size={36} /></div>
                  <div className="op-privacy-title">End-to-end versleuteld</div>
                  <div className="op-privacy-sub" style={{ marginTop: 12 }}>
                    Van jou naar je kind.<br />
                    Van je kind naar jou.<br />
                    Niemand anders leest mee.
                  </div>
                  <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(108,99,255,0.07)', borderRadius: 14, fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                    Versleuteld · Veilig · Privé
                  </div>
                </div>
              </div>
            </FadeRow>
          </div>
        </section>



        {/* ── CTA ── */}
        <section className="ot-final-cta">
          <h2>Veilig verbonden.<br className="ot-final-cta-break" />{' '}Zonder zorgen.</h2>
          <p>Geef je kind een veilige plek om te communiceren — zonder dat een bedrijf meekijkt, meeluistert of verdient aan het gedrag van je kind.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>
              Ouderaccount aanmaken
            </button>
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

      <MarketingFooter />

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} onParentClick={onParentClick} />
      )}
      {showParentModal && (
        <ParentAuthModal onClose={() => setShowParentModal(false)} defaultTab="register" />
      )}

      <style>{`
        .pf-retention-row {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          padding: 4px 0;
          margin-bottom: 5px;
        }
        .pf-retention-label {
          font-weight: 700;
          font-size: 15px;
          color: #1a1a2e;
        }
        .pf-retention-why {
          font-size: 13px;
          color: #3d3a5c;
          line-height: 1.5;
        }
        .pf-retention-meta {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          gap: 8px;
        }
        .pf-retention-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 11px;
          border-radius: 999px;
        }
        .pf-retention-badge--duration {
          background: rgba(108,99,255,0.12);
          color: #5b45e0;
        }
        .pf-retention-badge--delete {
          background: rgba(34,197,94,0.12);
          color: #16a34a;
        }
        @media (max-width: 600px) {
          .pf-retention-row {
            padding: 4px 0;
          }
        }
      `}</style>
    </div>
  );
}
