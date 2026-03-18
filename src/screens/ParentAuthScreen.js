// src/screens/ParentAuthScreen.js
import React, { useState, useRef } from 'react';
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

  // Verificatiestap
  const [step,          setStep]          = useState('form'); // 'form' | 'verify'
  const [verifyCode,    setVerifyCode]    = useState(['', '', '', '', '', '']);
  const [verifyError,   setVerifyError]   = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendCount,   setResendCount]   = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg,     setResendMsg]     = useState('');

  const codeInputRefs = useRef([]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'register') {
        if (!name.trim()) throw new Error('Vul uw naam in.');
        // Stuur verificatiecode, maak account nog NIET aan
        const res = await fetch(`${BACKEND}/api/send-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'E-mail versturen mislukt.');
        setStep('verify');
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

  function handleCodeInput(index, value) {
    if (!/^\d*$/.test(value)) return;
    const updated = [...verifyCode];
    updated[index] = value.slice(-1);
    setVerifyCode(updated);
    if (value && index < 5) codeInputRefs.current[index + 1]?.focus();
  }

  function handleCodeKeyDown(index, e) {
    if (e.key === 'Backspace' && !verifyCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  }

  function handleCodePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const updated = [...verifyCode];
    pasted.split('').forEach((ch, i) => { updated[i] = ch; });
    setVerifyCode(updated);
    const nextEmpty = Math.min(pasted.length, 5);
    codeInputRefs.current[nextEmpty]?.focus();
  }

  async function handleVerify(e) {
    e.preventDefault();
    const code = verifyCode.join('');
    if (code.length < 6) { setVerifyError('Voer alle 6 cijfers in.'); return; }
    setVerifyError('');
    setVerifyLoading(true);
    try {
      // Verifieer code bij backend
      const res = await fetch(`${BACKEND}/api/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verificatie mislukt.');

      // Code klopt → maak account aan
      localStorage.setItem('pulse_pending_role', 'parent');
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name.trim() });
      const idToken = await cred.user.getIdToken();
      await fetch(`${BACKEND}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ uid: cred.user.uid, displayName: name.trim(), email, photoURL: '', role: 'parent' }),
      });
      // App.js pikt de auth state change automatisch op
    } catch (err) {
      const msg = {
        'auth/email-already-in-use': 'Dit e-mailadres is al in gebruik.',
        'auth/weak-password':        'Wachtwoord moet minimaal 6 tekens zijn.',
      }[err.code] || err.message;
      setVerifyError(msg);
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleResend() {
    if (resendCount >= 3) { setResendMsg('Maximaal 3 keer opnieuw versturen per uur.'); return; }
    setResendLoading(true);
    setResendMsg('');
    try {
      const res = await fetch(`${BACKEND}/api/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Versturen mislukt.');
      setResendCount(c => c + 1);
      setVerifyCode(['', '', '', '', '', '']);
      setResendMsg('Nieuwe code verstuurd.');
      codeInputRefs.current[0]?.focus();
    } catch (err) {
      setResendMsg(err.message);
    } finally {
      setResendLoading(false);
    }
  }

  // ── Verificatiescherm ────────────────────────────────────────────────────────
  if (step === 'verify') {
    return (
      <div className="parent-auth-screen">
        <div className="parent-auth-card">
          <button className="parent-auth-back" onClick={() => { setStep('form'); setVerifyCode(['','','','','','']); setVerifyError(''); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Terug
          </button>

          <div className="parent-auth-logo">
            <div className="parent-auth-shield">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
              </svg>
            </div>
            <div>
              <div className="parent-auth-brand">E-mailverificatie</div>
              <div className="parent-auth-brand-sub">Pulse Gezinsbeheer</div>
            </div>
          </div>

          <h2 className="parent-auth-title">Controleer uw inbox</h2>
          <p className="parent-auth-sub">
            We hebben een 6-cijferige code verstuurd naar <strong>{email}</strong>. Voer de code hieronder in.
          </p>

          <form onSubmit={handleVerify}>
            <div className="parent-verify-boxes" onPaste={handleCodePaste}>
              {verifyCode.map((ch, i) => (
                <input
                  key={i}
                  ref={el => codeInputRefs.current[i] = el}
                  className="parent-verify-box"
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={ch}
                  onChange={e => handleCodeInput(i, e.target.value)}
                  onKeyDown={e => handleCodeKeyDown(i, e)}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {verifyError && (
              <div className="parent-auth-error" style={{ marginBottom: 12 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink:0 }}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                {verifyError}
              </div>
            )}

            <button className="parent-auth-btn" type="submit" disabled={verifyLoading || verifyCode.join('').length < 6}>
              {verifyLoading ? 'Bezig…' : 'Bevestigen →'}
            </button>
          </form>

          <div className="parent-verify-resend">
            <span style={{ color:'#6b7280', fontSize:14 }}>Geen code ontvangen?</span>
            <button
              className="parent-verify-resend-btn"
              onClick={handleResend}
              disabled={resendLoading || resendCount >= 3}
            >
              {resendLoading ? 'Versturen…' : 'Code opnieuw versturen'}
            </button>
            {resendMsg && <span className={resendMsg.includes('verstuurd') ? 'parent-verify-resend-ok' : 'parent-verify-resend-err'}>{resendMsg}</span>}
          </div>

          <p style={{ fontSize:12, color:'#9ca3af', textAlign:'center', marginTop:8 }}>
            Code verloopt na 15 minuten · maximaal 3× opnieuw versturen
          </p>
        </div>
      </div>
    );
  }

  // ── Inlog/registratiescherm ──────────────────────────────────────────────────
  return (
    <div className="parent-auth-screen">
      <div className="parent-auth-card">

        <button className="parent-auth-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Terug
        </button>

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
                placeholder="Wachtwoord"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
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
            {loading
              ? 'Even wachten…'
              : tab === 'login'
                ? 'Inloggen →'
                : 'Code versturen →'}
          </button>
        </form>

        <div className="parent-auth-features">
          <div className="parent-auth-feature">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Veilig portaal</span>
          </div>
          <div className="parent-auth-feature">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/>
            </svg>
            <span>Pauzeren</span>
          </div>
          <div className="parent-auth-feature">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            <span>Meldingen</span>
          </div>
        </div>
      </div>
    </div>
  );
}
