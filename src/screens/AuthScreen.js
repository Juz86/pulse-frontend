// src/screens/AuthScreen.js
import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../firebase';

export default function AuthScreen() {
  const [tab,          setTab]         = useState('login');   // 'login' | 'register'
  const [name,         setName]        = useState('');
  const [email,        setEmail]       = useState('');
  const [password,     setPassword]    = useState('');
  const [error,        setError]       = useState('');
  const [loading,      setLoading]     = useState(false);
  const [showReset,    setShowReset]   = useState(false);
  const [resetEmail,   setResetEmail]  = useState('');
  const [resetMsg,     setResetMsg]    = useState('');
  const [resetLoading, setResetLoading]= useState(false);

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

  async function handlePasswordReset(e) {
    e.preventDefault();
    setResetMsg('');
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetMsg('E-mail verstuurd! Controleer je inbox.');
    } catch (err) {
      const msg = {
        'auth/user-not-found': 'Geen account gevonden met dit e-mailadres.',
        'auth/invalid-email':  'Ongeldig e-mailadres.',
      }[err.code] || err.message;
      setResetMsg('⚠️ ' + msg);
    } finally {
      setResetLoading(false);
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
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <label className="form-label">Wachtwoord</label>
              {tab === 'login' && (
                <button type="button" className="forgot-link" onClick={() => { setShowReset(true); setResetEmail(email); setResetMsg(''); }}>
                  Wachtwoord vergeten?
                </button>
              )}
            </div>
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

      {/* ── WACHTWOORD VERGETEN MODAL ── */}
      {showReset && (
        <div className="modal-overlay" onClick={() => setShowReset(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">🔑 Wachtwoord vergeten</h3>
            <p className="modal-sub">Vul je e-mailadres in en we sturen je een resetlink.</p>
            <form onSubmit={handlePasswordReset}>
              <div className="form-group">
                <input
                  className="form-input" type="email"
                  placeholder="jij@voorbeeld.nl"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  required
                />
              </div>
              {resetMsg && (
                <div className={resetMsg.startsWith('⚠️') ? 'auth-error' : 'auth-success'}>
                  {resetMsg}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowReset(false)}>Annuleren</button>
                <button type="submit" className="btn-primary" style={{ flex:1 }} disabled={resetLoading}>
                  {resetLoading ? 'Versturen…' : 'Stuur resetlink →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
