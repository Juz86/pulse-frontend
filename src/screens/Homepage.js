// src/screens/Homepage.js
import React, { useState, useEffect } from 'react';
import AuthScreen from './AuthScreen';
import { Shield, PhoneIcon, Wifi } from '../components/Icons';
import PulseLogo from '../components/PulseLogo';

function ParentDashboardMockup() {
  const [imgOk, setImgOk] = useState(true);
  if (imgOk) {
    return (
      <div className="hp-screenshot-frame">
        <img
          src="/screenshots/parent-dashboard.png"
          alt="Ouderlijk toezicht dashboard"
          className="hp-screenshot-img"
          onError={() => setImgOk(false)}
        />
      </div>
    );
  }
  // Fallback: CSS mockup
  return (
    <div className="hp-phone">
      <div className="hp-phone-notch" />
      <div className="hp-phone-screen">
        <div className="hp-mock-topbar">
          <span style={{ fontSize: 13 }}>❤️ Ouderlijk toezicht</span>
        </div>
        <div className="hp-mock-child-card">
          <div className="hp-mock-avatar-sm" style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff' }}>Y</div>
          <div style={{ flex: 1 }}>
            <div className="hp-mock-name">Yushua</div>
            <div className="hp-mock-online">● Online</div>
          </div>
          <div className="hp-mock-pause-btn">Pauze</div>
        </div>
        <div className="hp-mock-stats-row">
          <div className="hp-mock-stat"><span>2u 30m</span>Schermtijd</div>
          <div className="hp-mock-stat"><span>8</span>Berichten</div>
          <div className="hp-mock-stat"><span>2</span>Oproepen</div>
        </div>
      </div>
    </div>
  );
}

export default function Homepage({ onParentClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <div className="hp-root">

      {/* ── NAVIGATIE ── */}
      <nav className={`hp-nav${scrolled ? ' hp-nav--scrolled' : ''}`}>
        <button className="hp-nav-logo" onClick={() => scrollTo('hero')}>
          <PulseLogo size={30} textSize={20} color="#fff" />
        </button>

        <div className={`hp-nav-links${menuOpen ? ' hp-nav-links--open' : ''}`}>
          <button onClick={() => scrollTo('waarom')}>Functies</button>
          <button onClick={() => scrollTo('veiligheid')}>Veiligheid</button>
          <button onClick={() => scrollTo('toezicht')}>Ouderlijk toezicht</button>
          <button onClick={() => scrollTo('footer')}>Over Pulse</button>
        </div>

        <button className="hp-nav-ouder" onClick={onParentClick}>
          ❤️ Ouder
        </button>

        <button
          className="hp-nav-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* ── HERO ── */}
      <section className="hp-hero" id="hero">
        <div className="hp-hero-inner">
          <div className="hp-hero-text">
            <div className="hp-hero-badge">🇳🇱 100% Nederlands</div>
            <h1 className="hp-hero-title">
              Veilig communiceren<br />voor elk kind
            </h1>
            <p className="hp-hero-sub">
              Pulse is de enige Nederlandse communicatie-app waarmee kinderen
              zonder smartphone kunnen bellen, videobellen en chatten — zonder
              afleiding, zonder pesterij, volledig onder ouderlijk toezicht.
            </p>
            <div className="hp-hero-features">
              <div className="hp-hero-feature"><Shield size={16} /> E2E versleuteld</div>
              <div className="hp-hero-feature"><PhoneIcon size={16} /> Bellen &amp; video</div>
              <div className="hp-hero-feature"><Wifi size={16} /> Wifi &amp; mobiel</div>
            </div>
          </div>

          <div className="hp-hero-card" id="login">
            <AuthScreen onParentClick={onParentClick} />
          </div>
        </div>
      </section>

      {/* ── WAAROM PULSE ── */}
      <section className="hp-section" id="waarom">
        <div className="hp-section-inner">
          <div className="hp-section-header">
            <h2>Waarom Pulse?</h2>
            <p>Speciaal ontworpen voor de veiligheid van kinderen online.</p>
          </div>
          <div className="hp-why-grid">
            {[
              {
                icon: '🛡️',
                title: 'Geen smartphone nodig',
                text: 'Kinderen loggen in met alleen een gebruikersnaam en wachtwoord. Geen telefoonnummer vereist.',
              },
              {
                icon: '📵',
                title: 'Afleidingsvrij',
                text: "Geen foto's, gifs of algoritmes. Pulse is puur communicatie — bellen, videobellen en chatten.",
              },
              {
                icon: '🚫',
                title: 'Antipesten by design',
                text: 'Pesten via beeldmateriaal is technisch onmogelijk in Pulse. 1 op de 5 kinderen wordt online gepest — niet via Pulse.',
              },
            ].map(c => (
              <div key={c.title} className="hp-why-card">
                <div className="hp-why-icon">{c.icon}</div>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FUNCTIES ── */}
      <section className="hp-section hp-section--gray" id="functies">
        <div className="hp-section-inner">

          {/* Rij 1 */}
          <div className="hp-feature-row" id="veiligheid">
            <div className="hp-feature-text">
              <div className="hp-feature-tag">Communicatie</div>
              <h3>Chatten, Bellen &amp; Videobellen</h3>
              <p>Blijf verbonden met familie en vrienden via chat, bellen en videobellen. Zonder telefoonnummer. Zonder gedoe.</p>
            </div>
            <div className="hp-feature-mockup">
              <div className="hp-phone">
                <div className="hp-phone-notch" />
                <div className="hp-phone-screen">
                  <div className="hp-mock-topbar">
                    <div className="hp-mock-avatar-sm">S</div>
                    <span>Sara</span>
                  </div>
                  <div className="hp-mock-msgs">
                    <div className="hp-mock-msg hp-mock-msg--in">Hoi! Alles goed? 👋</div>
                    <div className="hp-mock-msg hp-mock-msg--out">Ja super! Jij?</div>
                    <div className="hp-mock-msg hp-mock-msg--in">Heel goed 😊 Snel bellen?</div>
                    <div className="hp-mock-msg hp-mock-msg--out">Ja! 📞</div>
                  </div>
                  <div className="hp-mock-inputbar"><span>Bericht…</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Rij 2 */}
          <div className="hp-feature-row hp-feature-row--reverse" id="toezicht">
            <div className="hp-feature-mockup">
              <ParentDashboardMockup />
            </div>
            <div className="hp-feature-text">
              <div className="hp-feature-tag">Ouderlijk toezicht</div>
              <h3>Volledig overzicht voor ouders</h3>
              <p>Ouders hebben volledig toezicht via een eigen dashboard. Chat, bellen of videobellen pauzeren per functie. Direct meldingen bij nieuwe contacten.</p>
            </div>
          </div>

          {/* Rij 3 */}
          <div className="hp-feature-row">
            <div className="hp-feature-text">
              <div className="hp-feature-tag">Privacy &amp; AVG</div>
              <h3>AVG-compliant &amp; volledig Nederlands</h3>
              <p>Pulse is ontworpen voor minderjarigen en voldoet volledig aan de Europese AVG-privacywetgeving. Echt Nederlands. Echt veilig.</p>
            </div>
            <div className="hp-feature-mockup">
              <div className="hp-phone">
                <div className="hp-phone-notch" />
                <div className="hp-phone-screen hp-phone-screen--center">
                  <div className="hp-mock-shield-icon">🔒</div>
                  <div className="hp-mock-shield-title">End-to-end versleuteld</div>
                  <div className="hp-mock-pill">✓ AVG-compliant</div>
                  <div className="hp-mock-pill">✓ 100% Nederlands</div>
                  <div className="hp-mock-pill">✓ Geen telefoonnummer</div>
                  <div className="hp-mock-pill">✓ Geen advertenties</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── HOE WERKT HET ── */}
      <section className="hp-section hp-section--steps">
        <div className="hp-section-inner">
          <div className="hp-section-header">
            <h2>Hoe werkt het?</h2>
            <p>In drie eenvoudige stappen klaar om te communiceren.</p>
          </div>
          <div className="hp-steps">

            <div className="hp-step">
              <div className="hp-step-num">1</div>
              <div className="hp-phone hp-phone--sm">
                <div className="hp-phone-notch" />
                <div className="hp-phone-screen">
                  <div className="hp-mock-logo-sm">💬 Pulse</div>
                  <div className="hp-mock-ouder-highlight">❤️ Ouder ←</div>
                  <div className="hp-mock-field-sm">Gebruikersnaam</div>
                  <div className="hp-mock-field-sm">Wachtwoord</div>
                  <div className="hp-mock-btn-sm">Inloggen →</div>
                </div>
              </div>
              <h3>Ouder registreert</h3>
              <p>Maak een ouderaccount aan via de Ouder knop op het loginscherm.</p>
            </div>

            <div className="hp-step-arrow">→</div>

            <div className="hp-step">
              <div className="hp-step-num">2</div>
              <div className="hp-phone hp-phone--sm">
                <div className="hp-phone-notch" />
                <div className="hp-phone-screen">
                  <div className="hp-mock-tabs">
                    <span className="hp-mock-tab-active">Kind toevoegen</span>
                    <span>Kinderen</span>
                  </div>
                  <div className="hp-mock-field-sm">Naam kind</div>
                  <div className="hp-mock-field-sm">Gebruikersnaam</div>
                  <div className="hp-mock-field-sm">Wachtwoord</div>
                  <div className="hp-mock-btn-sm">Account aanmaken</div>
                </div>
              </div>
              <h3>Kindaccount aanmaken</h3>
              <p>Maak via het ouderportaal een account aan voor je kind met een gebruikersnaam en wachtwoord.</p>
            </div>

            <div className="hp-step-arrow">→</div>

            <div className="hp-step">
              <div className="hp-step-num">3</div>
              <div className="hp-phone hp-phone--sm">
                <div className="hp-phone-notch" />
                <div className="hp-phone-screen">
                  <div className="hp-mock-logo-sm">💬 Pulse</div>
                  <div className="hp-mock-field-sm hp-mock-field-sm--filled">yushua</div>
                  <div className="hp-mock-field-sm hp-mock-field-sm--filled">••••••••</div>
                  <div className="hp-mock-btn-sm hp-mock-btn-sm--active">Inloggen →</div>
                </div>
              </div>
              <h3>Kind logt in</h3>
              <p>Het kind logt in met de gebruikersnaam en wachtwoord. Geen e-mailadres of telefoonnummer nodig.</p>
            </div>

          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="hp-cta">
        <div className="hp-cta-inner">
          <h2>Klaar om te beginnen?</h2>
          <p>Gratis account aanmaken. Beschikbaar op web, iOS en Android.</p>
          <button className="hp-cta-btn" onClick={() => scrollTo('login')}>
            Gratis registreren
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="hp-footer" id="footer">
        <div className="hp-footer-inner">
          <div className="hp-footer-brand">
            <div className="hp-footer-logo">
              <img src="/logo192.png" alt="Pulse" width={28} height={28} />
              <span>Pulse</span>
            </div>
            <p>Veilig communiceren voor elk kind.</p>
          </div>
          <div className="hp-footer-col">
            <h4>Functies</h4>
            <span>Chatten</span>
            <span>Bellen</span>
            <span>Videobellen</span>
            <span>Ouderlijk toezicht</span>
          </div>
          <div className="hp-footer-col">
            <h4>Over Pulse</h4>
            <span>Over ons</span>
            <span>Privacy</span>
            <span>AVG-beleid</span>
            <span>Contact</span>
          </div>
          <div className="hp-footer-col">
            <h4>Downloaden</h4>
            <span>Web app</span>
            <span>iOS</span>
            <span>Android</span>
          </div>
        </div>
        <div className="hp-footer-copy">© 2025 Pulse — Echt Nederlands. Echt veilig.</div>
      </footer>

    </div>
  );
}
