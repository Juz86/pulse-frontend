// src/screens/AuthScreen.js
import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../firebase';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

export default function AuthScreen() {
  const [tab,          setTab]         = useState('login');   // 'login' | 'register'
  const [name,         setName]        = useState('');
  const [email,        setEmail]       = useState('');
  const [password,     setPassword]    = useState('');
  const [error,        setError]       = useState('');
  const [loading,      setLoading]     = useState(false);
  const [showPassword, setShowPassword]= useState(false);
  const [otpScreen,    setOtpScreen]   = useState(false);
  const [otpCode,      setOtpCode]     = useState('');
  const [otpLoading,   setOtpLoading]  = useState(false);
  const [otpError,     setOtpError]    = useState('');
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
        // Stuur OTP eerst — voordat account wordt aangemaakt
        const sendRes = await fetch(`${BACKEND}/api/send-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const sendData = await sendRes.json();
        if (!sendRes.ok) throw new Error(sendData.error || 'E-mail versturen mislukt.');
        setOtpScreen(true);
        return;
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

  async function handlePasswordReset(e) {
    e.preventDefault();
    setResetMsg('');
    setResetLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/send-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim(), actionUrl: window.location.origin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Versturen mislukt.');
      setResetMsg('E-mail verstuurd! Controleer je inbox.');
    } catch (err) {
      setResetMsg('⚠️ ' + err.message);
    } finally {
      setResetLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setOtpError(''); setOtpLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verificatie mislukt.');
      // Code correct → account aanmaken
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name.trim() });
      await signOut(auth);
      setOtpScreen(false);
      setTab('login');
      setEmail(''); setPassword(''); setName(''); setOtpCode('');
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  }

  if (otpScreen) return (
    <div className="auth-screen">
      <div className="auth-bg" />
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">💬</span>
          <span className="auth-logo-name">Pulse</span>
        </div>
        <div style={{ fontSize:'40px', textAlign:'center', margin:'8px 0' }}>📧</div>
        <h2 className="auth-title" style={{ textAlign:'center' }}>Verificatiecode</h2>
        <p className="auth-sub" style={{ textAlign:'center', marginBottom:'20px' }}>
          We hebben een 6-cijferige code gestuurd naar<br /><strong>{email}</strong>
        </p>
        <form onSubmit={handleVerifyOtp}>
          <div className="form-group">
            <input
              className="form-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
              style={{ textAlign:'center', fontSize:'28px', letterSpacing:'10px', fontWeight:'bold' }}
              autoFocus
              required
            />
          </div>
          {otpError && <div className="auth-error">⚠️ {otpError}</div>}
          <button className="btn-primary" type="submit" disabled={otpLoading || otpCode.length !== 6}>
            {otpLoading ? 'Controleren…' : 'Bevestigen →'}
          </button>
        </form>
        <p style={{ textAlign:'center', marginTop:'14px', fontSize:'13px', color:'var(--text-muted)' }}>
          Geen code ontvangen?{' '}
          <button style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:'13px' }}
            onClick={async () => {
              setOtpError('');
              const r = await fetch(`${BACKEND}/api/send-code`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) });
              if (!r.ok) setOtpError('Opnieuw versturen mislukt.');
            }}>
            Opnieuw versturen
          </button>
        </p>
      </div>
    </div>
  );

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
            <div style={{ position:'relative' }}>
              <input className="form-input" type={showPassword ? 'text' : 'password'} placeholder="Minimaal 6 tekens" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={{ paddingRight:'42px' }} />
              <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:0, display:'flex' }}>
                {showPassword
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M2 2l20 20-1.4 1.4L.6 3.4z" opacity=".7"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
                }
              </button>
            </div>
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
