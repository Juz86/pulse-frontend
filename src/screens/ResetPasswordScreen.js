// src/screens/ResetPasswordScreen.js
import React, { useState } from 'react';
import PulseLogo from '../components/PulseLogo';
import { confirmPasswordReset } from 'firebase/auth';
import { auth } from '../firebase';

export default function ResetPasswordScreen({ oobCode }) {
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [msg,         setMsg]         = useState('');
  const [done,        setDone]        = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 6) { setMsg('Wachtwoord moet minimaal 6 tekens zijn.'); return; }
    setLoading(true); setMsg('');
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setDone(true);
    } catch (err) {
      const msgs = {
        'auth/expired-action-code': 'De resetlink is verlopen. Vraag een nieuwe aan.',
        'auth/invalid-action-code': 'Ongeldige resetlink.',
        'auth/weak-password':       'Wachtwoord moet minimaal 6 tekens zijn.',
      };
      setMsg(msgs[err.code] || 'Er is iets misgegaan.');
    } finally { setLoading(false); }
  }

  return (
    <div className="auth-screen">
      <div className="auth-bg" />
      <div className="auth-card">
        <div className="auth-logo">
          <PulseLogo size={34} textSize={26} />
        </div>

        {done ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:'48px', marginBottom:'16px' }}>✅</div>
            <h2 className="auth-title">Wachtwoord gewijzigd!</h2>
            <p className="auth-sub" style={{ marginBottom:'24px' }}>Je kunt nu inloggen met je nieuwe wachtwoord.</p>
            <a href="/" className="btn-primary" style={{ textDecoration:'none', display:'block', textAlign:'center' }}>
              Naar inloggen →
            </a>
          </div>
        ) : (
          <>
            <h2 className="auth-title">Nieuw wachtwoord</h2>
            <p className="auth-sub">Kies een nieuw wachtwoord voor je account.</p>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nieuw wachtwoord</label>
                <div style={{ position:'relative' }}>
                  <input
                    className="form-input"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Minimaal 6 tekens"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required minLength={6}
                    style={{ paddingRight:'42px' }}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:0, display:'flex' }}>
                    {showPass
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M2 2l20 20-1.4 1.4L.6 3.4z" opacity=".7"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
                    }
                  </button>
                </div>
              </div>
              {msg && <div className="auth-error">⚠️ {msg}</div>}
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Opslaan…' : 'Wachtwoord opslaan →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
