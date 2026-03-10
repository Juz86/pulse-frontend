// src/screens/AuthScreen.js
import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';

export default function AuthScreen() {
  const [tab,      setTab]      = useState('login');   // 'login' | 'register'
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (tab === 'register') {
        if (!name.trim()) throw new Error('Vul je naam in');
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const msg = {
        'auth/user-not-found':     'Geen account gevonden met dit e-mailadres.',
        'auth/wrong-password':     'Verkeerd wachtwoord.',
        'auth/email-already-in-use': 'Dit e-mailadres is al in gebruik.',
        'auth/weak-password':      'Wachtwoord moet minimaal 6 tekens zijn.',
        'auth/invalid-email':      'Ongeldig e-mailadres.',
      }[err.code] || err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-bg" />

      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">💬</span>
          <span className="auth-logo-name">Pulse</span>
        </div>

        <h2 className="auth-title">{tab === 'login' ? 'Welkom terug' : 'Account aanmaken'}</h2>
        <p className="auth-sub">Geen telefoonnummer nodig — alleen je e-mail.</p>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`}    onClick={() => setTab('login')}>Inloggen</button>
          <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Registreren</button>
        </div>

        <form onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label">Je naam</label>
              <input className="form-input" type="text" placeholder="Jan de Vries" value={name} onChange={e => setName(e.target.value)} required />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">E-mailadres</label>
            <input className="form-input" type="email" placeholder="jij@voorbeeld.nl" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Wachtwoord</label>
            <input className="form-input" type="password" placeholder="Minimaal 6 tekens" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>

          {error && <div className="auth-error">⚠️ {error}</div>}

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Even wachten…' : (tab === 'login' ? 'Inloggen →' : 'Account aanmaken →')}
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
