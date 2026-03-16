// src/screens/ParentAuthScreen.js
import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

export default function ParentAuthScreen({ onBack }) {
  const [tab,          setTab]          = useState('login');
  const [name,         setName]         = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'register') {
        if (!name.trim()) throw new Error('Vul uw naam in.');
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name.trim() });
        const idToken = await cred.user.getIdToken();
        await fetch(`${BACKEND}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
          body: JSON.stringify({ uid: cred.user.uid, displayName: name.trim(), email, photoURL: '', role: 'parent' }),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const msg = {
        'auth/user-not-found':       'Geen account gevonden met dit e-mailadres.',
        'auth/wrong-password':       'Verkeerd wachtwoord.',
        'auth/invalid-credential':   'Verkeerd e-mailadres of wachtwoord.',
        'auth/email-already-in-use': 'Dit e-mailadres is al in gebruik.',
        'auth/weak-password':        'Wachtwoord moet minimaal 6 tekens zijn.',
        'auth/invalid-email':        'Ongeldig e-mailadres.',
      }[err.code] || err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="parent-auth-screen">
      <div className="parent-auth-card">

        {/* Terug-knop */}
        <button className="parent-auth-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Terug
        </button>

        {/* Logo */}
        <div className="parent-auth-logo">
          <div className="parent-auth-shield">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
            </svg>
          </div>
          <div>
            <div className="parent-auth-brand">Ouderportaal</div>
            <div className="parent-auth-brand-sub">Pulse Gezinsbeheer</div>
          </div>
        </div>

        <h2 className="parent-auth-title">
          {tab === 'login' ? 'Welkom terug' : 'Account aanmaken'}
        </h2>
        <p className="parent-auth-sub">
          {tab === 'login'
            ? 'Log in om de Pulse-activiteit van uw kind te bekijken en beheren.'
            : 'Maak een ouderaccount aan om uw kind te begeleiden.'}
        </p>

        {/* Tabs */}
        <div className="parent-auth-tabs">
          <button
            className={`parent-auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); }}
          >Inloggen</button>
          <button
            className={`parent-auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setError(''); }}
          >Registreren</button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          {tab === 'register' && (
            <div className="parent-auth-field">
              <label className="parent-auth-label">Uw naam</label>
              <input
                className="parent-auth-input"
                type="text"
                placeholder="Jan de Vries"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="parent-auth-field">
            <label className="parent-auth-label">E-mailadres</label>
            <input
              className="parent-auth-input"
              type="email"
              placeholder="ouder@voorbeeld.nl"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="parent-auth-field">
            <label className="parent-auth-label">Wachtwoord</label>
            <div style={{ position: 'relative' }}>
              <input
                className="parent-auth-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimaal 6 tekens"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:0, display:'flex' }}
              >
                {showPassword
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M2 2l20 20-1.4 1.4L.6 3.4z" opacity=".7"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
                }
              </button>
            </div>
          </div>

          {error && (
            <div className="parent-auth-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink:0 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              {error}
            </div>
          )}

          <button className="parent-auth-btn" type="submit" disabled={loading}>
            {loading ? 'Even wachten…' : (tab === 'login' ? 'Inloggen →' : 'Account aanmaken →')}
          </button>
        </form>

        {/* Features */}
        <div className="parent-auth-features">
          <div className="parent-auth-feature">
            <span>🔒</span>
            <span>Veilig portaal</span>
          </div>
          <div className="parent-auth-feature">
            <span>⏸️</span>
            <span>Pauzeren</span>
          </div>
          <div className="parent-auth-feature">
            <span>📧</span>
            <span>Meldingen</span>
          </div>
        </div>
      </div>
    </div>
  );
}
