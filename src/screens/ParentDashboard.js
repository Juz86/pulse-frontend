// src/screens/ParentDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

export default function ParentDashboard({ user, onClose }) {
  const [children,    setChildren]    = useState([]);
  const [childEmail,  setChildEmail]  = useState('');
  const [reqError,    setReqError]    = useState('');
  const [reqSuccess,  setReqSuccess]  = useState('');
  const [reqLoading,  setReqLoading]  = useState(false);
  const [loading,     setLoading]     = useState(true);

  async function authFetch(url, options = {}) {
    const token = await user.getIdToken();
    return fetch(url, { ...options, headers: { ...(options.headers || {}), 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
  }

  const loadChildren = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND}/api/parent/children`);
      const data = await res.json();
      setChildren(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => { loadChildren(); }, [loadChildren]);

  async function sendSupervisionRequest(e) {
    e.preventDefault();
    setReqError(''); setReqSuccess(''); setReqLoading(true);
    try {
      const res = await authFetch(`${BACKEND}/api/parent/supervision-request`, {
        method: 'POST',
        body: JSON.stringify({ childEmail: childEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Versturen mislukt.');
      setReqSuccess('Verzoek verstuurd! Het kind ontvangt een melding in de app.');
      setChildEmail('');
    } catch (err) { setReqError(err.message); }
    setReqLoading(false);
  }

  async function pauseChild(childUid) {
    try {
      await authFetch(`${BACKEND}/api/parent/pause/${childUid}`, { method: 'POST' });
      setChildren(prev => prev.map(c => c.uid === childUid ? { ...c, paused: true } : c));
    } catch { alert('Pauzeren mislukt.'); }
  }

  async function resumeChild(childUid) {
    try {
      await authFetch(`${BACKEND}/api/parent/resume/${childUid}`, { method: 'POST' });
      setChildren(prev => prev.map(c => c.uid === childUid ? { ...c, paused: false } : c));
    } catch { alert('Hervatten mislukt.'); }
  }

  function getInitials(name = '') {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  function lastSeenText(lastSeen) {
    if (!lastSeen) return 'Onbekend';
    const secs = lastSeen._seconds || (lastSeen.seconds);
    if (!secs) return 'Onbekend';
    const diff = (Date.now() / 1000) - secs;
    if (diff < 60) return 'Zojuist';
    if (diff < 3600) return `${Math.floor(diff / 60)} min geleden`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} uur geleden`;
    return `${Math.floor(diff / 86400)} dagen geleden`;
  }

  return (
    <div className="parent-root">
      <div className="parent-container">

        {/* Header */}
        <div className="parent-header">
          <div className="parent-logo">
            <span style={{ fontSize:28 }}>👨‍👩‍👧</span>
            <span className="parent-logo-name">Ouderlijk toezicht</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:13, color:'#666' }}>{user.displayName || user.email}</span>
            <button className="parent-btn-outline" onClick={() => signOut(auth)}>Uitloggen</button>
            {onClose && (
              <button className="parent-btn-outline" onClick={onClose} style={{ padding:'8px 10px' }} title="Sluiten">✕</button>
            )}
          </div>
        </div>

        {/* Verzoek sturen */}
        <div className="parent-card">
          <h2 className="parent-section-title">Kind toevoegen</h2>
          <p className="parent-section-sub">Vul het e-mailadres in van uw kind. Het kind ontvangt een verzoek in de Pulse-app.</p>
          <form onSubmit={sendSupervisionRequest} style={{ display:'flex', gap:10, marginTop:12 }}>
            <input
              className="parent-input"
              type="email"
              placeholder="kind@voorbeeld.nl"
              value={childEmail}
              onChange={e => setChildEmail(e.target.value)}
              required
            />
            <button className="parent-btn-primary" type="submit" disabled={reqLoading}>
              {reqLoading ? 'Versturen…' : 'Sturen →'}
            </button>
          </form>
          {reqError   && <div className="parent-error">⚠️ {reqError}</div>}
          {reqSuccess && <div className="parent-success">✅ {reqSuccess}</div>}
        </div>

        {/* Kinderen */}
        <div className="parent-card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h2 className="parent-section-title" style={{ marginBottom:0 }}>Gekoppelde kinderen</h2>
            <button className="parent-btn-outline" onClick={loadChildren} style={{ fontSize:12, padding:'6px 12px' }}>↻ Vernieuwen</button>
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'#999' }}>Laden…</div>
          ) : children.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'#999' }}>
              <div style={{ fontSize:40, marginBottom:8 }}>👦</div>
              <p>Nog geen kinderen gekoppeld.</p>
              <p style={{ fontSize:13, marginTop:4 }}>Stuur een verzoek via het formulier hierboven.</p>
            </div>
          ) : children.map(child => (
            <div key={child.uid} className={`parent-child-row${child.paused ? ' paused' : ''}`}>
              <div className="parent-child-avatar">{getInitials(child.displayName)}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div className="parent-child-name">{child.displayName || child.email}</div>
                <div className="parent-child-meta">
                  <span className={`parent-status-dot ${child.online ? 'online' : 'offline'}`} />
                  <span>{child.online ? 'Online' : `Offline · ${lastSeenText(child.lastSeen)}`}</span>
                  {child.paused && <span className="parent-paused-badge">Gepauzeerd</span>}
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {child.paused ? (
                  <button className="parent-btn-green" onClick={() => resumeChild(child.uid)}>▶ Hervatten</button>
                ) : (
                  <button className="parent-btn-orange" onClick={() => pauseChild(child.uid)}>⏸ Pauzeren</button>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
