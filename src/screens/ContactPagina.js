import React, { useEffect, useRef, useState } from 'react';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import PageMeta from '../components/PageMeta';
import { Mail, Shield, Check, Send } from '../components/Icons';

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
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Pulse Messenger</span>
          </div>
          <p style={{ color: 'var(--text2)', fontSize: 15, lineHeight: 1.7 }}>
            Veilige communicatie voor kinderen en gezinnen. Wij helpen je graag verder.
          </p>
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

          {/* Adresgegevens — volgt later */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '14px 18px',
            opacity: 0.55,
          }}>
            <span style={{
              width: 36, height: 36,
              background: 'rgba(108,99,255,0.08)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text3)', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Vestigingsadres</div>
              <span style={{ color: 'var(--text3)', fontSize: 14 }}>Wordt binnenkort aangevuld</span>
            </div>
          </div>

          {/* KVK — volgt later */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '14px 18px',
            opacity: 0.55,
          }}>
            <span style={{
              width: 36, height: 36,
              background: 'rgba(108,99,255,0.08)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text3)', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>KVK-nummer</div>
              <span style={{ color: 'var(--text3)', fontSize: 14 }}>Wordt binnenkort aangevuld</span>
            </div>
          </div>
        </div>

        {/* Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
          <Shield size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>AVG-compliant · 100% Nederlands</span>
        </div>
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
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Stuur ons een bericht</h2>
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
                <label htmlFor="contact-onderwerp" style={labelStyle}>Onderwerp</label>
                <select
                  id="contact-onderwerp"
                  value={form.onderwerp}
                  onChange={e => set('onderwerp', e.target.value)}
                  style={{ ...inputStyle(errors.onderwerp), cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239090b0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 40 }}
                >
                  {ONDERWERPEN.map(o => (
                    <option key={o} value={o === ONDERWERPEN[0] ? '' : o} disabled={o === ONDERWERPEN[0]}>
                      {o}
                    </option>
                  ))}
                </select>
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

  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navItems = [
    { key: 'functies',           label: 'Functies',           href: '/functies' },
    { key: 'hoe-werkt-het',      label: 'Hoe werkt het',      href: '/hoe-werkt-het' },
    { key: 'ouderlijk-toezicht', label: 'Ouderlijk toezicht', href: '/ouderlijk-toezicht' },
    { key: 'over-pulse',         label: 'Over Pulse',         href: '/over-pulse' },
  ];

  return (
    <div className="hp-root legal-root">
      <PageMeta
        title="Contact — Pulse Messenger"
        description="Neem contact op met Pulse Messenger. Stuur ons een bericht voor vragen over de app, ouderlijk toezicht, privacy of samenwerking."
        canonical="https://pulse-frontend-elt.pages.dev/contact"
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
            <h1 className="legal-hero-title" style={{ maxWidth: 560 }}>
              Hoe kunnen we je helpen?
            </h1>
            <p className="legal-hero-intro" style={{ maxWidth: 520 }}>
              Heb je een vraag over Pulse, ouderlijk toezicht, privacy of samenwerking?
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
        <section className="ot-final-cta" style={{ marginTop: 0 }}>
          <h2>Veilig verbonden.<br className="ot-final-cta-break" />{' '}Met wie echt telt.</h2>
          <p>Pulse helpt gezinnen communiceren op een manier die vertrouwd, veilig en rustig voelt.</p>
          <a href="/" className="hp-cta-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <Shield size={18} />
            Naar de homepage
          </a>
        </section>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .contact-grid { grid-template-columns: 1fr !important; }
        }
        select option { background: var(--surface2); color: var(--text); }
        input::placeholder, textarea::placeholder { color: var(--text3); }
        input:focus, textarea:focus, select:focus {
          border-color: var(--accent) !important;
          outline: none;
        }
      `}</style>

      <MarketingFooter />
    </div>
  );
}
