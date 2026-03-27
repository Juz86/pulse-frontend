// src/screens/ParentAuthScreen.js
import React, { useState, useRef } from 'react';
import PulseLogo from '../components/PulseLogo';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { BACKEND_URL as BACKEND } from '../services/socket';

const API_BASE = (BACKEND || '').replace(/\/+$/, '');

async function postJson(path, body, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 15000);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
    }

    if (!res.ok) {
      const err = new Error(data.error || 'Er ging iets mis. Probeer het opnieuw.');
      err.status = res.status;
      throw err;
    }

    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('De Pulse-server reageert niet op tijd. Probeer het zo opnieuw.');
    }
    if (err instanceof TypeError && /failed to fetch/i.test(err.message)) {
      throw new Error('Kan geen verbinding maken met de Pulse-server. Controleer je internetverbinding of probeer het later opnieuw.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function ParentAuthScreen({ onBack, defaultTab = 'login', isModal = false }) {
  const [tab,          setTab]          = useState(defaultTab);
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
        await postJson('/api/send-code', { email });
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
      await postJson('/api/verify-code', { email, code });

      // Code klopt → maak account aan
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name.trim() });
      const idToken = await cred.user.getIdToken();
      await postJson(
        '/api/users',
        { uid: cred.user.uid, displayName: name.trim(), email, photoURL: '', role: 'parent' },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
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
      await postJson('/api/send-code', { email });
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
    const verifyInner = (
      <>
          <button type="button" className="parent-auth-back" onClick={() => { setStep('form'); setVerifyCode(['','','','','','']); setVerifyError(''); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Terug
          </button>

          <div className="parent-auth-logo">
            <PulseLogo size={34} textSize={24} color="#1a1a2e" />
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
      </>
    );
    return isModal ? verifyInner : (
      <div className="parent-auth-screen">
        <div className="parent-auth-card">{verifyInner}</div>
      </div>
    );
  }

  // ── Inlog/registratiescherm ──────────────────────────────────────────────────
  const formInner = (
    <>
        {!isModal && (
          <button type="button" className="parent-auth-back" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Terug
          </button>
        )}

        <div className="parent-auth-logo">
          <PulseLogo size={34} textSize={24} color="#1a1a2e" />
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
                id="parent-name"
                name="name"
                className="parent-auth-input"
                type="text"
                placeholder="Jan de Vries"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="parent-auth-field">
            <label className="parent-auth-label">E-mailadres</label>
            <input
              id="parent-email"
              name="email"
              className="parent-auth-input"
              type="email"
              placeholder="ouder@voorbeeld.nl"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="parent-auth-field">
            <label className="parent-auth-label">Wachtwoord</label>
            <div style={{ position: 'relative' }}>
              <input
                id="parent-password"
                name="password"
                className="parent-auth-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Wachtwoord"
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
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
    </>
  );
  return isModal ? formInner : (
    <div className="parent-auth-screen">
      <div className="parent-auth-card">{formInner}</div>
    </div>
  );
}
