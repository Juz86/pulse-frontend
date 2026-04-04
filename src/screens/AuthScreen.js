// src/screens/AuthScreen.js
import { lazy, Suspense, useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { User, Lock, EyeOn, EyeOff, Shield, Heart, Users } from '../components/Icons';
import PulseLogo from '../components/PulseLogo';
import { BACKEND_URL as BACKEND } from '../services/socket';
import { normalizeUsername } from '../utils';

const LOGIN_LOOKUP_TIMEOUT_MS = 10000;
const ParentAuthScreen = lazy(() => import('./ParentAuthScreen'));

export default function AuthScreen({ isModal, inModal, onClose }) {
  const [username,     setUsername]     = useState('');
  const [password,     setPassword]     = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [flipped,      setFlipped]      = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const input = username.trim();
      if (!input || !password.trim()) {
        throw new Error('Vul uw gebruikersnaam en wachtwoord in.');
      }

      let email = input;

      // Als het geen e-mailadres is: zoek intern e-mailadres op via gebruikersnaam
      if (!input.includes('@')) {
        const cleanUsername = normalizeUsername(input);
        if (cleanUsername.length < 3) {
          throw new Error('Gebruikersnaam moet minimaal 3 tekens hebben.');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), LOGIN_LOOKUP_TIMEOUT_MS);
        const res = await fetch(`${BACKEND}/api/users/lookup-username?username=${encodeURIComponent(cleanUsername)}`, {
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));
        const data = await res.json();
        if (!res.ok) throw new Error('Gebruikersnaam of wachtwoord klopt niet.');
        email = data.email;
      }

      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (err) {
      const msg = {
        'auth/user-not-found':     'Gebruikersnaam of wachtwoord klopt niet.',
        'auth/wrong-password':     'Gebruikersnaam of wachtwoord klopt niet.',
        'auth/invalid-credential': 'Gebruikersnaam of wachtwoord klopt niet.',
        'auth/invalid-email':      'Gebruikersnaam of wachtwoord klopt niet.',
        'auth/too-many-requests':  'Te veel pogingen. Probeer het later opnieuw.',
      }[err.code] || (err.name === 'AbortError'
        ? 'De inlogcontrole duurt te lang. Probeer het opnieuw.'
        : err.message);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const formContent = (
    <>
      <form onSubmit={handleSubmit} aria-busy={loading}>
        <div className="form-group">
          <label className="form-label" htmlFor="username">Gebruikersnaam</label>
          <div style={{ position: 'relative' }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', display: 'flex', pointerEvents: 'none' }}>
              <User size={16} />
            </span>
            <input
              id="username"
              name="username"
              className="form-input"
              type="text"
              placeholder="jouw_naam"
              value={username}
              onChange={e => setUsername(e.target.value.slice(0, 80))}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              enterKeyHint="next"
              aria-describedby={error ? 'child-auth-error' : undefined}
              aria-errormessage={error ? 'child-auth-error' : undefined}
              aria-invalid={error ? 'true' : undefined}
              required
              style={{ paddingLeft: 38 }}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Wachtwoord</label>
          <div style={{ position: 'relative' }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', display: 'flex', pointerEvents: 'none' }}>
              <Lock size={16} />
            </span>
            <input
              id="password"
              name="password"
              className="form-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Wachtwoord"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="current-password"
              enterKeyHint="done"
              spellCheck={false}
              aria-describedby={error ? 'child-auth-error' : undefined}
              aria-errormessage={error ? 'child-auth-error' : undefined}
              aria-invalid={error ? 'true' : undefined}
              required
              minLength={6}
              style={{ paddingLeft: 38, paddingRight: 42 }}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(p => !p)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0, display: 'flex' }}
            >
              <span aria-hidden="true">{showPassword ? <EyeOff size={18} /> : <EyeOn size={18} />}</span>
            </button>
          </div>
        </div>

        {error && (
          <div id="child-auth-error" className="auth-error" role="alert" aria-live="assertive">
            <span aria-hidden="true">⚠️ </span>
            {error}
          </div>
        )}

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Even wachten…' : <>Inloggen <span aria-hidden="true">→</span></>}
        </button>
      </form>

      <p className="auth-no-account">
        Geen account? Vraag je ouder om een account voor je aan te maken.
      </p>

      <ul className="auth-features" aria-label="Belangrijkste voordelen">
        <li className="auth-feature"><span aria-hidden="true"><Shield size={18} color="var(--text3)" /></span><div>Versleuteld</div></li>
        <li className="auth-feature"><span aria-hidden="true"><Users size={18} color="var(--text3)" /></span><div>Toezicht</div></li>
        <li className="auth-feature"><span aria-hidden="true"><span style={{ fontSize: 18, lineHeight: 1 }}>🇳🇱</span></span><div>100% Nederlands</div></li>
      </ul>
    </>
  );

  if (isModal) return formContent;

  const flipCards = (
    <div className="auth-flip-wrapper">
      <div className={`auth-flip-inner${flipped ? ' auth-flip-inner--flipped' : ''}`}>

        {/* ── Voorkant: kind-login ── */}
        <div
          className="auth-card auth-card-front"
          style={{ position: 'relative' }}
          aria-labelledby="child-auth-title"
          aria-describedby="child-auth-subtitle"
        >
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setFlipped(true)}
              aria-label="Open ouder login of registratie"
              style={{ background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.4)', color: 'var(--accent)', borderRadius: '10px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Users size={14} aria-hidden="true" /> Ouder
            </button>
            {inModal && onClose && (
              <button type="button" onClick={onClose} aria-label="Sluiten" className="modal-close-btn" style={{ position: 'static' }}>
                <span aria-hidden="true">✕</span>
              </button>
            )}
          </div>

          <div className="auth-logo" aria-hidden="true">
            <PulseLogo size={34} textSize={26} />
          </div>

          <h2 id="child-auth-title" className="auth-title">Welkom terug</h2>
          <p id="child-auth-subtitle" className="auth-sub">Log in met je gebruikersnaam en wachtwoord.</p>

          {formContent}
        </div>

        {/* ── Achterkant: ouder-login ── */}
        <div className="auth-card-back" aria-label="Ouder inloggen of registreren">
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setFlipped(false)}
              aria-label="Terug naar kind inloggen"
              className="hp-nav-kind"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <Heart size={14} aria-hidden="true" /> Kind
            </button>
            {inModal && onClose && (
              <button type="button" onClick={onClose} aria-label="Sluiten" className="modal-close-btn modal-close-btn--light" style={{ position: 'static' }}>
                <span aria-hidden="true">✕</span>
              </button>
            )}
          </div>
          <Suspense fallback={<div className="auth-sub" style={{ marginBottom: 0 }}>Ouderportaal laden…</div>}>
            <ParentAuthScreen isModal defaultTab="login" />
          </Suspense>
        </div>

      </div>
    </div>
  );

  if (inModal) return flipCards;

  return (
    <div className="auth-screen">
      <div className="auth-bg" aria-hidden="true" />
      {flipCards}
    </div>
  );
}
