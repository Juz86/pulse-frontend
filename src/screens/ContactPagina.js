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
      <div className="badge-strip--desktop" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around', gap: 4, paddingTop: 4 }}>
        {BADGES.map(({ icon, label }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, color: 'var(--accent)' }}>
            {icon}
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.4 }}>{label}</span>
          </div>
        ))}
      </div>
      {/* Mobiel: auto-slide */}
      <div className="badge-strip--mobile" style={{ paddingTop: 4, overflow: 'hidden', textAlign: 'center' }}>
        <div style={{
          display: 'flex',
          transform: `translateX(${-active * 100}%)`,
          transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {BADGES.map(({ icon, label }) => (
            <div key={label} style={{
              minWidth: '100%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
              color: 'var(--accent)',
            }}>
              {icon}
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)' }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 8, justifyContent: 'center' }}>
          {BADGES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setActive(i); clearInterval(timerRef.current); timerRef.current = setInterval(() => setActive(j => (j + 1) % BADGES.length), 2500); }}
              style={{
                width: i === active ? 16 : 6, height: 6, borderRadius: 3,
                background: i === active ? 'var(--accent)' : 'var(--border)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'width 0.3s, background 0.3s',
              }}
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
      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '36px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}>
        {/* Brand */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <img src="/logo192.png" alt="" aria-hidden="true" width={32} height={32} style={{ borderRadius: 8 }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Pulse</span>
          </div>
          <p style={{ color: 'var(--text2)', fontSize: 15, lineHeight: 1.7 }}>
            Veilige communicatie voor kinderen en gezinnen. Wij helpen je graag verder.
          </p>

          {/* Feature strip */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {[
              { icon: <Message size={18} />, label: 'Chatten', sub: 'Veilig berichten sturen' },
              { icon: <Phone size={18} />,   label: 'Bellen',  sub: 'Zonder telefoonnummer' },
              { icon: <Video size={18} />,   label: 'Videobellen', sub: 'Met vertrouwde contacten' },
            ].map(({ icon, label, sub }, i, arr) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 16px',
                background: 'var(--surface)',
                borderRadius: 12,
                border: '1px solid var(--border)',
              }}>
                <span style={{
                  width: 36, height: 36, flexShrink: 0, borderRadius: 10,
                  background: 'rgba(108,99,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent)',
                }}>
                  {icon}
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* E-mail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '14px 18px',
          }}>
            <span style={{
              width: 36, height: 36,
              background: 'rgba(108,99,255,0.12)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent)', flexShrink: 0,
            }}>
              <Mail size={18} />
            </span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>E-mail</div>
              <a
                href="mailto:info@pulse-messenger.com"
                style={{ color: 'var(--text)', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}
              >
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
      // Contactformulier — backend-koppeling wordt later toegevoegd
      await new Promise(r => setTimeout(r, 900));
      setSuccess(true);
    } catch {
      setErrors({ form: 'Er is iets misgegaan. Probeer het opnieuw of stuur een e-mail naar info@pulse-messenger.com.' });
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (hasError) => ({
    width: '100%',
    background: 'var(--surface)',
    border: `1.5px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`,
    borderRadius: 12,
    padding: '12px 16px',
    color: 'var(--text)',
    fontSize: 15,
    fontFamily: 'var(--font-primary)',
    outline: 'none',
    transition: 'border-color 0.2s',
  });

  const labelStyle = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text2)',
    marginBottom: 7,
  };

  const errorStyle = {
    fontSize: 12,
    color: 'var(--danger)',
    marginTop: 5,
  };

  return (
    <div
      ref={ref}
      className={`ot-row${visible ? ' fp-visible' : ''}`}
      style={{ display: 'block' }}
    >
      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '36px 32px',
      }}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(67,233,123,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
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
              <div style={{
                background: 'rgba(255,71,87,0.1)',
                border: '1px solid rgba(255,71,87,0.3)',
                borderRadius: 10,
                padding: '12px 16px',
                fontSize: 14,
                color: 'var(--danger)',
                marginBottom: 20,
              }}>
                {errors.form}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label htmlFor="contact-naam" style={labelStyle}>Naam</label>
                  <input
                    id="contact-naam"
                    type="text"
                    placeholder="Je naam"
                    value={form.naam}
                    onChange={e => set('naam', e.target.value)}
                    style={inputStyle(errors.naam)}
                    autoComplete="name"
                  />
                  {errors.naam && <div style={errorStyle}>{errors.naam}</div>}
                </div>
                <div>
                  <label htmlFor="contact-email" style={labelStyle}>E-mailadres</label>
                  <input
                    id="contact-email"
                    type="email"
                    placeholder="je@email.com"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    style={inputStyle(errors.email)}
                    autoComplete="email"
                  />
                  {errors.email && <div style={errorStyle}>{errors.email}</div>}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Onderwerp</label>
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(o => !o)}
                    style={{
                      ...inputStyle(errors.onderwerp),
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', textAlign: 'left',
                      color: form.onderwerp ? 'var(--text)' : 'var(--text3)',
                    }}
                  >
                    <span>{form.onderwerp || 'Selecteer een onderwerp'}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--text3)' }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {dropdownOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
                      background: 'var(--surface2)',
                      border: '1.5px solid var(--border)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    }}>
                      {ONDERWERPEN.slice(1).map((o, i, arr) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => { set('onderwerp', o); setDropdownOpen(false); }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '11px 16px', fontSize: 15,
                            background: form.onderwerp === o ? 'rgba(108,99,255,0.12)' : 'transparent',
                            color: form.onderwerp === o ? 'var(--accent)' : 'var(--text)',
                            border: 'none', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                            cursor: 'pointer', fontFamily: 'var(--font-primary)',
                          }}
                          onMouseEnter={e => { if (form.onderwerp !== o) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                          onMouseLeave={e => { if (form.onderwerp !== o) e.currentTarget.style.background = 'transparent'; }}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.onderwerp && <div style={errorStyle}>{errors.onderwerp}</div>}
              </div>

              <div>
                <label htmlFor="contact-bericht" style={labelStyle}>Bericht</label>
                <textarea
                  id="contact-bericht"
                  placeholder="Hoe kunnen we je helpen?"
                  value={form.bericht}
                  onChange={e => set('bericht', e.target.value)}
                  rows={5}
                  style={{ ...inputStyle(errors.bericht), resize: 'vertical', minHeight: 130 }}
                />
                {errors.bericht && <div style={errorStyle}>{errors.bericht}</div>}
              </div>

              <button
                type="submit"
                className="hp-cta-btn"
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
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
        <section className="legal-hero" style={{ paddingBottom: 48 }}>
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
        <section className="hp-section" style={{ paddingTop: 0 }}>
          <div className="hp-section-inner">
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.6fr',
              gap: 28,
              alignItems: 'start',
            }}
              className="contact-grid"
            >
              <ContactInfoCard />
              <ContactForm />
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="ot-final-cta">
          <h2>Veilig verbonden.<br className="ot-final-cta-break" />{' '}Met wie echt telt.</h2>
          <p>Pulse helpt gezinnen om in contact te blijven op een manier die vertrouwd, veilig en rustig voelt. Voor kinderen. Voor ouders. Voor iedereen die erom geeft.</p>
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .badge-strip--mobile { display: none; }
        @media (max-width: 768px) {
          .contact-grid { grid-template-columns: 1fr !important; }
          .badge-strip--desktop { display: none !important; }
          .badge-strip--mobile { display: block; }
        }
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
