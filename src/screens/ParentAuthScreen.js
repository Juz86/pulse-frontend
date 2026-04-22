// src/screens/ParentAuthScreen.js
import React, { useEffect, useState, useRef } from 'react';
import PulseLogo from '../components/PulseLogo';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { BACKEND_URL as BACKEND } from '../services/socket';
import { isValidEmail, normalizeEmail, sanitizeDisplayName } from '../utils';

const API_BASE = (BACKEND || '').replace(/\/+$/, '');
const PARENT_AUTH_FEATURES = [
  {
    label: 'Veilig portaal',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
  },
  {
    label: 'Pauzeren',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/>
      </svg>
    ),
  },
  {
    label: 'Meldingen',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
];

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
  const [activeFeature, setActiveFeature] = useState(0);

  const codeInputRefs = useRef([]);
  const loginTabRef = useRef(null);
  const registerTabRef = useRef(null);
  const featureTimerRef = useRef(null);
  const verifyDescriptionIds = verifyError
    ? 'parent-verify-instructions parent-verify-error'
    : 'parent-verify-instructions';

  useEffect(() => {
    if (step === 'verify') codeInputRefs.current[0]?.focus();
  }, [step]);

  useEffect(() => {
    featureTimerRef.current = setInterval(() => {
      setActiveFeature((index) => (index + 1) % PARENT_AUTH_FEATURES.length);
    }, 2500);

    return () => clearInterval(featureTimerRef.current);
  }, []);

  const activateFeature = (index) => {
    setActiveFeature(index);
    clearInterval(featureTimerRef.current);
    featureTimerRef.current = setInterval(() => {
      setActiveFeature((nextIndex) => (nextIndex + 1) % PARENT_AUTH_FEATURES.length);
    }, 2500);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cleanEmail = normalizeEmail(email);
      const cleanName = sanitizeDisplayName(name);

      if (!isValidEmail(cleanEmail)) throw new Error('Vul een geldig e-mailadres in.');
      if (password.trim().length < 6) throw new Error('Wachtwoord moet minimaal 6 tekens zijn.');

      if (tab === 'register') {
        if (cleanName.length < 2) throw new Error('Vul uw naam in.');
        // Stuur verificatiecode, maak account nog NIET aan
        await postJson('/api/send-code', { email: cleanEmail });
        setName(cleanName);
        setEmail(cleanEmail);
        setStep('verify');
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
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
      await postJson('/api/verify-code', { email: normalizeEmail(email), code });

      // Code klopt → maak account aan
      const cleanName = sanitizeDisplayName(name);
      const cleanEmail = normalizeEmail(email);
      // Sla rol op vóór account aanmaken — onAuthStateChanged vuurt voor de /api/users call klaar is
      localStorage.setItem('pulse_pending_role', 'parent');
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await updateProfile(cred.user, { displayName: cleanName });
      const idToken = await cred.user.getIdToken();
      await postJson(
        '/api/users',
        { uid: cred.user.uid, displayName: cleanName, email: cleanEmail, photoURL: '', role: 'parent' },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      localStorage.removeItem('pulse_pending_role');
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
      await postJson('/api/send-code', { email: normalizeEmail(email) });
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

  function handleTabKeyDown(event, nextTab) {
    if (event.key === 'Home') {
      event.preventDefault();
      setTab('login');
      setError('');
      loginTabRef.current?.focus();
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setTab('register');
      setError('');
      registerTabRef.current?.focus();
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setTab(nextTab);
    setError('');
    if (nextTab === 'login') loginTabRef.current?.focus();
    if (nextTab === 'register') registerTabRef.current?.focus();
  }

  // ── Verificatiescherm ────────────────────────────────────────────────────────
  if (step === 'verify') {
    const verifyInner = (
      <>
          <button type="button" className="parent-auth-back" onClick={() => { setStep('form'); setVerifyCode(['','','','','','']); setVerifyError(''); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Terug
          </button>

          <div className="parent-auth-logo" aria-hidden="true">
            <PulseLogo size={34} textSize={24} color="#1a1a2e" />
          </div>

          <h2 id="parent-verify-title" className="parent-auth-title">Controleer uw inbox</h2>
          <p id="parent-verify-instructions" className="parent-auth-sub">
            We hebben een 6-cijferige code verstuurd naar <strong>{email}</strong>. Voer de code hieronder in.
          </p>

          <form onSubmit={handleVerify} aria-busy={verifyLoading}>
            <div
              className="parent-verify-boxes"
              onPaste={handleCodePaste}
              role="group"
              aria-label="6-cijferige verificatiecode"
              aria-describedby={verifyDescriptionIds}
            >
              {verifyCode.map((ch, i) => (
                <input
                  key={i}
                  ref={el => codeInputRefs.current[i] = el}
                  className="parent-verify-box"
                  type="text"
                  aria-label={`Verificatiecode cijfer ${i + 1}`}
                  aria-describedby={verifyError ? 'parent-verify-error' : undefined}
                  aria-errormessage={verifyError ? 'parent-verify-error' : undefined}
                  aria-invalid={verifyError ? 'true' : undefined}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint={i === verifyCode.length - 1 ? 'done' : 'next'}
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={1}
                  value={ch}
                  onChange={e => handleCodeInput(i, e.target.value)}
                  onKeyDown={e => handleCodeKeyDown(i, e)}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {verifyError && (
              <div id="parent-verify-error" className="parent-auth-error" style={{ marginBottom: 12 }} role="alert" aria-live="assertive">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink:0 }} aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                {verifyError}
              </div>
            )}

            <button className="parent-auth-btn" type="submit" disabled={verifyLoading || verifyCode.join('').length < 6}>
              {verifyLoading ? 'Bezig…' : <>Bevestigen <span aria-hidden="true">→</span></>}
            </button>
          </form>

          <div className="parent-verify-resend">
            <span style={{ color:'#6b7280', fontSize:14 }}>Geen code ontvangen?</span>
            <button
              type="button"
              className="parent-verify-resend-btn"
              onClick={handleResend}
              disabled={resendLoading || resendCount >= 3}
            >
              {resendLoading ? 'Versturen…' : 'Code opnieuw versturen'}
            </button>
            {resendMsg && <span className={resendMsg.includes('verstuurd') ? 'parent-verify-resend-ok' : 'parent-verify-resend-err'} aria-live="polite">{resendMsg}</span>}
          </div>

          <p style={{ fontSize:12, color:'#9ca3af', textAlign:'center', marginTop:8 }}>
            Code verloopt na 15 minuten · maximaal 3× opnieuw versturen
          </p>
      </>
    );
    return isModal ? verifyInner : (
      <div className="parent-auth-screen">
        <div
          className="parent-auth-card"
          aria-labelledby="parent-verify-title"
          aria-describedby="parent-verify-instructions"
        >
          {verifyInner}
        </div>
      </div>
    );
  }

  // ── Inlog/registratiescherm ──────────────────────────────────────────────────
  const formInner = (
    <>
        {!isModal && (
          <button type="button" className="parent-auth-back" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Terug
          </button>
        )}

        <div className="parent-auth-logo" aria-hidden="true">
          <PulseLogo size={34} textSize={24} color="#1a1a2e" />
        </div>

        <h2 id="parent-auth-title" className="parent-auth-title">
          {tab === 'login' ? 'Welkom terug' : 'Account aanmaken'}
        </h2>
        <p id="parent-auth-subtitle" className="parent-auth-sub">
          {tab === 'login'
            ? 'Log in om de Pulse-activiteit van uw kind te bekijken en beheren.'
            : 'Maak een ouderaccount aan om een kindaccount te beheren.'}
        </p>

        <div className="parent-auth-tabs" role="tablist" aria-label="Ouderaccount tabs" aria-orientation="horizontal">
          <button
            ref={loginTabRef}
            type="button"
            id="parent-auth-tab-login"
            className={`parent-auth-tab ${tab === 'login' ? 'active' : ''}`}
            role="tab"
            aria-selected={tab === 'login'}
            aria-controls="parent-auth-panel"
            tabIndex={tab === 'login' ? 0 : -1}
            onClick={() => { setTab('login'); setError(''); }}
            onKeyDown={(event) => handleTabKeyDown(event, 'register')}
          >Inloggen</button>
          <button
            ref={registerTabRef}
            type="button"
            id="parent-auth-tab-register"
            className={`parent-auth-tab ${tab === 'register' ? 'active' : ''}`}
            role="tab"
            aria-selected={tab === 'register'}
            aria-controls="parent-auth-panel"
            tabIndex={tab === 'register' ? 0 : -1}
            onClick={() => { setTab('register'); setError(''); }}
            onKeyDown={(event) => handleTabKeyDown(event, 'login')}
          >Registreren</button>
        </div>

        <form
          id="parent-auth-panel"
          role="tabpanel"
          aria-labelledby={tab === 'login' ? 'parent-auth-tab-login' : 'parent-auth-tab-register'}
          aria-busy={loading}
          tabIndex={0}
          onSubmit={handleSubmit}
          style={{ marginTop: 20 }}
        >
          {tab === 'register' && (
            <div className="parent-auth-field">
              <label className="parent-auth-label" htmlFor="parent-name">Uw naam</label>
              <input
                id="parent-name"
                name="name"
                className="parent-auth-input"
                type="text"
                placeholder="Jan de Vries"
                value={name}
                onChange={e => setName(e.target.value.slice(0, 80))}
                autoComplete="name"
                enterKeyHint="next"
                aria-describedby={error ? 'parent-auth-error' : undefined}
                aria-errormessage={error ? 'parent-auth-error' : undefined}
                aria-invalid={error ? 'true' : undefined}
                required
              />
            </div>
          )}

          <div className="parent-auth-field">
            <label className="parent-auth-label" htmlFor="parent-email">E-mailadres</label>
            <input
              id="parent-email"
              name="email"
              className="parent-auth-input"
              type="email"
              placeholder="ouder@voorbeeld.nl"
              value={email}
              onChange={e => setEmail(e.target.value.slice(0, 120))}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="email"
              enterKeyHint="next"
              spellCheck={false}
              aria-describedby={error ? 'parent-auth-error' : undefined}
              aria-errormessage={error ? 'parent-auth-error' : undefined}
              aria-invalid={error ? 'true' : undefined}
              required
            />
          </div>

          <div className="parent-auth-field">
            <label className="parent-auth-label" htmlFor="parent-password">Wachtwoord</label>
            <div style={{ position: 'relative' }}>
              <input
                id="parent-password"
                name="password"
                className="parent-auth-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Wachtwoord"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                enterKeyHint={tab === 'login' ? 'done' : 'go'}
                spellCheck={false}
                value={password}
                onChange={e => setPassword(e.target.value)}
                aria-describedby={error ? 'parent-auth-error' : undefined}
                aria-errormessage={error ? 'parent-auth-error' : undefined}
                aria-invalid={error ? 'true' : undefined}
                required
                minLength={6}
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(p => !p)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:0, display:'flex' }}
              >
                <span aria-hidden="true">
                  {showPassword
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M2 2l20 20-1.4 1.4L.6 3.4z" opacity=".7"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
                  }
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div id="parent-auth-error" className="parent-auth-error" role="alert" aria-live="assertive">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink:0 }} aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              {error}
            </div>
          )}

          <button className="parent-auth-btn" type="submit" disabled={loading}>
            {loading
              ? 'Even wachten…'
              : tab === 'login'
                ? <>Inloggen <span aria-hidden="true">→</span></>
                : <>Code versturen <span aria-hidden="true">→</span></>}
          </button>
        </form>

        <ul className="parent-auth-features parent-auth-features--desktop" aria-label="Belangrijkste voordelen">
          {PARENT_AUTH_FEATURES.map(({ label, icon }) => (
            <li key={label} className="parent-auth-feature">
              {icon}
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <div className="parent-auth-features-mobile" aria-label="Belangrijkste voordelen">
          <div
            className="parent-auth-feature-mobile-slider"
            style={{
              transform: `translateX(${-activeFeature * 100}%)`,
              transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {PARENT_AUTH_FEATURES.map(({ label, icon }) => (
              <div key={label} className="parent-auth-feature-mobile-slide">
                {icon}
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="parent-auth-feature-dots">
            {PARENT_AUTH_FEATURES.map(({ label }, index) => (
              <button
                key={label}
                type="button"
                onClick={() => activateFeature(index)}
                className={`parent-auth-feature-dot ${index === activeFeature ? 'parent-auth-feature-dot--active' : 'parent-auth-feature-dot--inactive'}`}
                aria-label={label}
              />
            ))}
          </div>
        </div>
    </>
  );
  return isModal ? formInner : (
    <div className="parent-auth-screen">
      <div
        className="parent-auth-card"
        aria-labelledby="parent-auth-title"
        aria-describedby="parent-auth-subtitle"
      >
        {formInner}
      </div>
    </div>
  );
}
