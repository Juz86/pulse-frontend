import React, { useEffect, useRef, useState } from 'react';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import PageMeta from '../components/PageMeta';
import AuthModal from '../components/AuthModal';
import ParentAuthModal from '../components/ParentAuthModal';
import { Mail, Shield, Check, Send, Message, Phone, Video, Users, Login, PhoneIcon } from '../components/Icons';

function useFadeIn() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

const BADGES = [
  { icon: <Shield size={16} />,   label: 'Versleuteld & privé' },
  { icon: <PhoneIcon size={16} />, label: 'Chatten & (video)bellen' },
  { icon: <Users size={16} />,    label: 'Ouderlijk toezicht' },
];

function BadgeStrip() {
  const [active, setActive] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setActive(i => (i + 1) % BADGES.length), 2500);
    return () => clearInterval(timerRef.current);
  }, []);

  return (
    <>
      {/* Desktop: naast elkaar */}
      <div className="badge-strip--desktop">
        {BADGES.map(({ icon, label }) => (
          <div key={label} className="contact-badge-desktop-item">
            {icon}
            <span className="contact-badge-desktop-label">{label}</span>
          </div>
        ))}
      </div>
      {/* Mobiel: auto-slide */}
      <div className="badge-strip--mobile">
        <div
          className="contact-badge-mobile-slider"
          style={{
            transform: `translateX(${-active * 100}%)`,
            transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {BADGES.map(({ icon, label }) => (
            <div key={label} className="contact-badge-mobile-slide">
              {icon}
              <span className="contact-badge-mobile-label">{label}</span>
            </div>
          ))}
        </div>
        <div className="contact-badge-dots">
          {BADGES.map((badge, i) => (
            <button
              key={badge.label}
              type="button"
              onClick={() => {
                setActive(i);
                clearInterval(timerRef.current);
                timerRef.current = setInterval(() => setActive(j => (j + 1) % BADGES.length), 2500);
              }}
              className={`contact-badge-dot ${i === active ? 'contact-badge-dot--active' : 'contact-badge-dot--inactive'}`}
              aria-label={BADGES[i].label}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function ContactInfoCard() {
  const [ref, visible] = useFadeIn();
  return (
    <div
      ref={ref}
      className={`ot-row${visible ? ' fp-visible' : ''}`}
      style={{ display: 'block' }}
    >
      <div className="contact-info-card">
        {/* Brand */}
        <div>
          <div className="contact-brand-header">
            <img src="/logo192.png" alt="" aria-hidden="true" width={32} height={32} className="contact-brand-logo" />
            <span className="contact-brand-name">Pulse</span>
          </div>
          <p style={{ color: 'var(--text2)', fontSize: 15, lineHeight: 1.7 }}>
            Veilige communicatie voor kinderen en gezinnen. Wij helpen je graag verder.
          </p>

          {/* Feature strip */}
          <div className="contact-feature-list">
            {[
              { icon: <Message size={18} />, label: 'Chatten', sub: 'Veilig berichten sturen' },
              { icon: <Phone size={18} />,   label: 'Bellen',  sub: 'Zonder telefoonnummer' },
              { icon: <Video size={18} />,   label: 'Videobellen', sub: 'Met vertrouwde contacten' },
            ].map(({ icon, label, sub }) => (
              <div key={label} className="contact-feature-item">
                <span className="contact-feature-icon">{icon}</span>
                <div>
                  <div className="contact-feature-label">{label}</div>
                  <div className="contact-feature-sub">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* E-mail */}
        <div className="contact-email-block">
          <div className="contact-email-row">
            <span className="contact-email-icon">
              <Mail size={18} />
            </span>
            <div>
              <div className="contact-email-eyebrow">E-mail</div>
              <a href="mailto:info@pulse-messenger.com" className="contact-email-link">
                info@pulse-messenger.com
              </a>
            </div>
          </div>
        </div>

        {/* Badge */}
        <BadgeStrip />
      </div>
    </div>
  );
}

const ONDERWERPEN = [
  'Selecteer een onderwerp',
  'Algemene vraag',
  'Technische ondersteuning',
  'Ouderlijk toezicht',
  'Privacy of AVG',
  'Samenwerking of partnership',
  'Pers & media',
  'Anders',
];

function ContactForm() {
  const [ref, visible] = useFadeIn();
  const [form, setForm] = useState({ naam: '', email: '', onderwerp: '', bericht: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  }

  function validate() {
    const e = {};
    if (!form.naam.trim()) e.naam = 'Vul je naam in.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Vul een geldig e-mailadres in.';
    if (!form.onderwerp || form.onderwerp === ONDERWERPEN[0]) e.onderwerp = 'Kies een onderwerp.';
    if (!form.bericht.trim() || form.bericht.trim().length < 10) e.bericht = 'Vul een bericht in (minimaal 10 tekens).';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'}/api/contact`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            naam: form.naam.trim(),
            email: form.email.trim().toLowerCase(),
            onderwerp: form.onderwerp,
            bericht: form.bericht.trim(),
          }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSuccess(true);
    } catch {
      setErrors({ form: 'Er is iets misgegaan. Probeer het opnieuw of stuur een e-mail naar info@pulse-messenger.com.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      ref={ref}
      className={`ot-row${visible ? ' fp-visible' : ''}`}
      style={{ display: 'block' }}
    >
      <div className="contact-form-card">
        {success ? (
          <div className="contact-success">
            <div className="contact-success-icon">
              <Check size={32} style={{ color: 'var(--success)' }} />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Bericht ontvangen!</h3>
            <p style={{ color: 'var(--text2)', fontSize: 15, lineHeight: 1.7 }}>
              Bedankt voor je bericht. We nemen zo snel mogelijk contact met je op via <strong>{form.email}</strong>.
            </p>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: '#fff' }}>Stuur ons een bericht</h2>
            <p style={{ color: 'var(--text2)', fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
              We reageren doorgaans binnen één werkdag.
            </p>

            {errors.form && (
              <div className="contact-form-error">{errors.form}</div>
            )}

            <form onSubmit={handleSubmit} noValidate className="contact-form">
              <div className="contact-form-grid">
                <div>
                  <label htmlFor="contact-naam" className="contact-label">Naam</label>
                  <input
                    id="contact-naam"
                    type="text"
                    placeholder="Je naam"
                    value={form.naam}
                    onChange={e => set('naam', e.target.value)}
                    className={`contact-input${errors.naam ? ' contact-input--error' : ''}`}
                    autoComplete="name"
                  />
                  {errors.naam && <div className="contact-error">{errors.naam}</div>}
                </div>
                <div>
                  <label htmlFor="contact-email" className="contact-label">E-mailadres</label>
                  <input
                    id="contact-email"
                    type="email"
                    placeholder="je@email.com"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    className={`contact-input${errors.email ? ' contact-input--error' : ''}`}
                    autoComplete="email"
                  />
                  {errors.email && <div className="contact-error">{errors.email}</div>}
                </div>
              </div>

              <div>
                <label className="contact-label">Onderwerp</label>
                <div ref={dropdownRef} className="contact-dropdown-wrapper">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(o => !o)}
                    className={`contact-input contact-dropdown-trigger${!form.onderwerp ? ' contact-dropdown-trigger--placeholder' : ''}${errors.onderwerp ? ' contact-input--error' : ''}`}
                  >
                    <span>{form.onderwerp || 'Selecteer een onderwerp'}</span>
                    <svg
                      width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                      className={`contact-dropdown-chevron${dropdownOpen ? ' contact-dropdown-chevron--open' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {dropdownOpen && (
                    <div className="contact-dropdown-menu">
                      {ONDERWERPEN.slice(1).map((o, i, arr) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => { set('onderwerp', o); setDropdownOpen(false); }}
                          className={`contact-dropdown-item${form.onderwerp === o ? ' contact-dropdown-item--selected' : ''}${i < arr.length - 1 ? ' contact-dropdown-item--bordered' : ''}`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.onderwerp && <div className="contact-error">{errors.onderwerp}</div>}
              </div>

              <div>
                <label htmlFor="contact-bericht" className="contact-label">Bericht</label>
                <textarea
                  id="contact-bericht"
                  placeholder="Hoe kunnen we je helpen?"
                  value={form.bericht}
                  onChange={e => set('bericht', e.target.value)}
                  rows={5}
                  className={`contact-input${errors.bericht ? ' contact-input--error' : ''}`}
                  style={{ resize: 'vertical', minHeight: 130 }}
                />
                {errors.bericht && <div className="contact-error">{errors.bericht}</div>}
              </div>

              <button
                type="submit"
                className="hp-cta-btn contact-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="contact-spinner" />
                    Versturen…
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Bericht versturen
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function ContactPagina() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
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
    <div className="hp-root legal-root">
      <PageMeta
        title="Contact — Pulse Messenger"
        description="Neem contact op met Pulse Messenger. Stuur ons een bericht voor vragen over de app, ouderlijk toezicht, privacy of samenwerking."
        canonical="https://pulse-messenger.com/contact"
      />

      <MarketingNavbar
        items={navItems}
        activeKey="contact"
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        scrolled={scrolled}
      />

      <main id="main-content">
        {/* ── HERO ── */}
        <section className="legal-hero contact-hero-section">
          <div className="legal-hero-inner">
            <div className="fp-hero-badge legal-hero-badge">Contact</div>
            <h1 className="legal-hero-title">
              Hoe kunnen we je helpen?
            </h1>
            <p className="legal-hero-intro" style={{ maxWidth: 640 }}>
              Heb je een vraag over Pulse, ouderlijk toezicht, privacy of samenwerking?
            </p>
            <p className="legal-hero-intro" style={{ maxWidth: 640, marginTop: 8 }}>
              Stuur ons een bericht — we reageren zo snel mogelijk.
            </p>
          </div>
        </section>

        {/* ── CONTENT ── */}
        <section className="hp-section contact-content-section">
          <div className="hp-section-inner">
            <div className="contact-grid">
              <ContactInfoCard />
              <ContactForm />
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="ot-final-cta">
          <h2>Veilig verbonden.<br className="ot-final-cta-break" />{' '}Met wie echt telt.</h2>
          <p>Pulse helpt gezinnen om in contact te blijven op een manier die vertrouwd, veilig en rustig voelt. Voor kinderen. Voor ouders. Voor iedereen die erom geeft.</p>
          <div className="contact-cta-row">
            <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>
              Ouderaccount aanmaken
            </button>
            <button
              type="button"
              className="hp-cta-btn contact-cta-btn-login"
              onClick={() => setShowAuthModal(true)}
            >
              <Login size={18} /> Inloggen
            </button>
          </div>
        </section>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder, textarea::placeholder { color: var(--text3); }
        input:focus, textarea:focus {
          border-color: var(--accent) !important;
          outline: none;
        }
      `}</style>

      <MarketingFooter />

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
      {showParentModal && (
        <ParentAuthModal onClose={() => setShowParentModal(false)} defaultTab="register" />
      )}
    </div>
  );
}
