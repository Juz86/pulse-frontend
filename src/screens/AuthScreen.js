// src/screens/AuthScreen.js
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { User, Lock, EyeOn, EyeOff, Shield, PhoneIcon, Wifi, Heart } from '../components/Icons';
import PulseLogo from '../components/PulseLogo';
import { BACKEND_URL as BACKEND } from '../services/socket';

export default function AuthScreen({ onParentClick, isModal }) {
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

  const formContent = (
    <>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Gebruikersnaam</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', display: 'flex', pointerEvents: 'none' }}>
              <User size={16} />
            </span>
            <input
              id="username"
              name="username"
              className="form-input"
              type="text"
              placeholder="jouw_naam"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              required
              style={{ paddingLeft: 38 }}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Wachtwoord</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', display: 'flex', pointerEvents: 'none' }}>
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
              autoComplete="current-password"
              required
              minLength={6}
              style={{ paddingLeft: 38, paddingRight: 42 }}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
              onClick={() => setShowPassword(p => !p)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0, display: 'flex' }}
            >
              {showPassword ? <EyeOff size={18} /> : <EyeOn size={18} />}
            </button>
          </div>
        </div>

        {error && <div className="auth-error">⚠️ {error}</div>}

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Even wachten…' : 'Inloggen →'}
        </button>
      </form>

      <p className="auth-no-account">
        Geen account? Vraag je ouder om een account voor je aan te maken.
      </p>

      <div className="auth-features">
        <div className="auth-feature"><Shield size={18} color="var(--text3)" /><div>Versleuteld</div></div>
        <div className="auth-feature"><PhoneIcon size={18} color="var(--text3)" /><div>Bellen &amp; video</div></div>
        <div className="auth-feature"><Wifi size={18} color="var(--text3)" /><div>Wifi &amp; mobiel</div></div>
      </div>
    </>
  );

  if (isModal) return formContent;

  return (
    <div className="auth-screen">
      <div className="auth-bg" />

      <div className="auth-card" style={{ position: 'relative' }}>
        {onParentClick && (
          <button
            onClick={onParentClick}
            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.4)', color: 'var(--accent)', borderRadius: '10px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Heart size={14} color="#ef4444" /> Ouder
          </button>
        )}

        <div className="auth-logo">
          <PulseLogo size={34} textSize={26} />
        </div>

        <h2 className="auth-title">Welkom terug</h2>
        <p className="auth-sub">Log in met je gebruikersnaam en wachtwoord.</p>

        {formContent}
      </div>
    </div>
  );
}
