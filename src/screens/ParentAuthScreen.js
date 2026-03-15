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
        if (!name.trim()) throw new Error('Vul je naam in.');
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
    <div className="auth-screen">
      <div className="auth-bg" />
      <div className="auth-card" style={{ position:'relative' }}>
        <button
          onClick={onBack}
          style={{ position:'absolute', top:16, left:16, background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:'13px', display:'flex', alignItems:'center', gap:4 }}
        >
          ← Terug
        </button>

        <div className="auth-logo" style={{ marginTop:8 }}>
          <span className="auth-logo-icon">👨‍👩‍👧</span>
          <span className="auth-logo-name">Ouder</span>
        </div>
        <h2 className="auth-title">{tab === 'login' ? 'Inloggen als ouder' : 'Ouderaccount aanmaken'}</h2>
        <p className="auth-sub">Beheer en bewaak de Pulse-account van uw kind.</p>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`}    onClick={() => setTab('login')}>Inloggen</button>
          <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Registreren</button>
        </div>

        <form onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label">Uw naam</label>
              <input className="form-input" type="text" placeholder="Jan de Vries" value={name} onChange={e => setName(e.target.value)} required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">E-mailadres</label>
            <input className="form-input" type="email" placeholder="ouder@voorbeeld.nl" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Wachtwoord</label>
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
          <div className="auth-feature"><div>🔒</div><div>Veilig portaal</div></div>
          <div className="auth-feature"><div>⏸️</div><div>Pauzeren</div></div>
          <div className="auth-feature"><div>📧</div><div>Meldingen</div></div>
        </div>
      </div>
    </div>
  );
}
