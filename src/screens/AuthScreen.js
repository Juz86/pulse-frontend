// src/screens/AuthScreen.js
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

export default function AuthScreen({ onParentClick }) {
  const [username,     setUsername]     = useState('');
  const [password,     setPassword]     = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const input = username.trim();
      let email = input;

      // Als het geen e-mailadres is: zoek intern e-mailadres op via gebruikersnaam
      if (!input.includes('@')) {
        const res = await fetch(`${BACKEND}/api/users/lookup-username?username=${encodeURIComponent(input)}`);
        const data = await res.json();
        if (!res.ok) throw new Error('Gebruikersnaam of wachtwoord klopt niet.');
        email = data.email;
      }

      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const msg = {
        'auth/user-not-found':     'Gebruikersnaam of wachtwoord klopt niet.',
        'auth/wrong-password':     'Gebruikersnaam of wachtwoord klopt niet.',
        'auth/invalid-credential': 'Gebruikersnaam of wachtwoord klopt niet.',
        'auth/invalid-email':      'Gebruikersnaam of wachtwoord klopt niet.',
        'auth/too-many-requests':  'Te veel pogingen. Probeer het later opnieuw.',
      }[err.code] || err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-bg" />

      <div className="auth-card" style={{ position: 'relative' }}>
        {onParentClick && (
          <button
            onClick={onParentClick}
            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.4)', color: 'var(--accent)', borderRadius: '10px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.3px' }}
          >
            ❤️ Ouder
          </button>
        )}

        <div className="auth-logo">
          <span className="auth-logo-icon">💬</span>
          <span className="auth-logo-name">Pulse</span>
        </div>

        <h2 className="auth-title">Welkom terug</h2>
        <p className="auth-sub">Log in met je gebruikersnaam en wachtwoord.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Gebruikersnaam</label>
            <input
              className="form-input"
              type="text"
              placeholder="jouw_naam"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Wachtwoord</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Wachtwoord"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ paddingRight: '42px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0, display: 'flex' }}
              >
                {showPassword
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M2 2l20 20-1.4 1.4L.6 3.4z" opacity=".7"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
                }
              </button>
            </div>
          </div>

          {error && <div className="auth-error">⚠️ {error}</div>}

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Even wachten…' : 'Inloggen →'}
          </button>
        </form>

        <div className="auth-features">
          <div className="auth-feature"><div>🔒</div><div>E2E versleuteld</div></div>
          <div className="auth-feature"><div>📞</div><div>Bellen & video</div></div>
          <div className="auth-feature"><div>📶</div><div>Wifi & mobiel</div></div>
        </div>
      </div>
    </div>
  );
}
