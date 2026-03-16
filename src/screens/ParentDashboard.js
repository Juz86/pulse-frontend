// src/screens/ParentDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { getInitials, timeAgo } from '../utils';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

export default function ParentDashboard({ user, onClose }) {
  const [children,       setChildren]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [activities,     setActivities]     = useState([]);

  // Kindaccount aanmaken
  const [childName,      setChildName]      = useState('');
  const [childUsername,  setChildUsername]  = useState('');
  const [childPassword,  setChildPassword]  = useState('');
  const [createError,    setCreateError]    = useState('');
  const [createSuccess,  setCreateSuccess]  = useState('');
  const [createLoading,  setCreateLoading]  = useState(false);
  const [showCreatePw,   setShowCreatePw]   = useState(false);

  // Wachtwoord wijzigen per kind
  const [changingPwUid,  setChangingPwUid]  = useState(null);
  const [newPassword,    setNewPassword]    = useState('');
  const [pwError,        setPwError]        = useState('');
  const [pwLoading,      setPwLoading]      = useState(false);
  const [showNewPw,      setShowNewPw]      = useState(false);

  // Kind verwijderen
  const [confirmDelete,  setConfirmDelete]  = useState(null); // { uid, displayName }

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

  const loadActivities = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND}/api/parent/activities`);
      const data = await res.json();
      setActivities(Array.isArray(data) ? data : []);
    } catch {}
  }, [user]);

  useEffect(() => { loadChildren(); loadActivities(); }, [loadChildren, loadActivities]);

  async function createChild(e) {
    e.preventDefault();
    setCreateError(''); setCreateSuccess(''); setCreateLoading(true);
    try {
      const res = await authFetch(`${BACKEND}/api/parent/create-child`, {
        method: 'POST',
        body: JSON.stringify({ name: childName.trim(), username: childUsername.trim(), password: childPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aanmaken mislukt.');
      setChildren(prev => [...prev, { uid: data.uid, displayName: data.displayName, username: data.username, online: false, paused: false }]);
      setCreateSuccess(`Account voor ${data.displayName} aangemaakt.`);
      setChildName(''); setChildUsername(''); setChildPassword('');
    } catch (err) { setCreateError(err.message); }
    setCreateLoading(false);
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

  async function changePassword(childUid) {
    setPwError(''); setPwLoading(true);
    try {
      const res = await authFetch(`${BACKEND}/api/parent/change-child-password/${childUid}`, {
        method: 'POST',
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Wijzigen mislukt.');
      setChangingPwUid(null); setNewPassword(''); setShowNewPw(false);
    } catch (err) { setPwError(err.message); }
    setPwLoading(false);
  }

  async function deleteChild(childUid) {
    try {
      const res = await authFetch(`${BACKEND}/api/parent/delete-child/${childUid}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Verwijderen mislukt.'); }
      setChildren(prev => prev.filter(c => c.uid !== childUid));
      setConfirmDelete(null);
    } catch (err) { alert(err.message); }
  }

  return (
    <div className="parent-root">
      <div className="parent-container">

        {/* Header */}
        <div className="parent-header">
          <div className="parent-logo">
            <span style={{ fontSize: 28 }}>❤️</span>
            <span className="parent-logo-name">Ouderlijk toezicht</span>
          </div>
          <div className="parent-header-actions">
            {onClose && (
              <button className="parent-btn-outline" onClick={onClose} style={{ padding: '8px 10px' }} title="Sluiten">✕</button>
            )}
          </div>
        </div>

        {/* Kindaccount aanmaken */}
        <div className="parent-card">
          <h2 className="parent-section-title">Kind toevoegen</h2>
          <p className="parent-section-sub">Maak een account aan voor uw kind. Het kind logt in met gebruikersnaam en wachtwoord.</p>
          <form onSubmit={createChild} className="parent-add-form" style={{ flexDirection: 'column', gap: 10 }}>
            <input
              className="parent-input"
              type="text"
              placeholder="Naam van het kind"
              value={childName}
              onChange={e => setChildName(e.target.value)}
              required
            />
            <input
              className="parent-input"
              type="text"
              placeholder="Gebruikersnaam (bijv. jan_2014)"
              value={childUsername}
              onChange={e => setChildUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              autoCapitalize="none"
              autoCorrect="off"
              required
              minLength={2}
              maxLength={30}
            />
            <div style={{ position: 'relative' }}>
              <input
                className="parent-input"
                type={showCreatePw ? 'text' : 'password'}
                placeholder="Wachtwoord (minimaal 6 tekens)"
                value={childPassword}
                onChange={e => setChildPassword(e.target.value)}
                required
                minLength={6}
                style={{ paddingRight: 42, width: '100%', boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setShowCreatePw(p => !p)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex' }}>
                {showCreatePw
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M2 2l20 20-1.4 1.4L.6 3.4z" opacity=".7"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
                }
              </button>
            </div>
            <button className="parent-btn-primary" type="submit" disabled={createLoading}>
              {createLoading ? 'Aanmaken…' : 'Kindaccount aanmaken →'}
            </button>
          </form>
          {createError   && <div className="parent-error" style={{ marginTop: 10 }}>⚠️ {createError}</div>}
          {createSuccess && <div className="parent-success" style={{ marginTop: 10 }}>✅ {createSuccess}</div>}
        </div>

        {/* Kinderen */}
        <div className="parent-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="parent-section-title" style={{ marginBottom: 0 }}>Gekoppelde kinderen</h2>
            <button className="parent-btn-outline" onClick={loadChildren} style={{ fontSize: 12, padding: '6px 12px' }}>↻ Vernieuwen</button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>Laden…</div>
          ) : children.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>👦</div>
              <p>Nog geen kinderen toegevoegd.</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Maak een account aan via het formulier hierboven.</p>
            </div>
          ) : children.map(child => (
            <div key={child.uid}>
              <div className={`parent-child-row${child.paused ? ' paused' : ''}`}>
                <div className="parent-child-avatar">{getInitials(child.displayName)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="parent-child-name">{child.displayName}</div>
                  <div className="parent-child-meta">
                    <span className={`parent-status-dot ${child.online ? 'online' : 'offline'}`} />
                    <span>{child.online ? 'Online' : `Offline · ${timeAgo(child.lastSeen, 'Onbekend')}`}</span>
                    {child.username && <span style={{ marginLeft: 6, color: '#888', fontSize: 12 }}>@{child.username}</span>}
                    {child.paused && <span className="parent-paused-badge">Gepauzeerd</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {child.paused ? (
                    <button className="parent-btn-green" onClick={() => resumeChild(child.uid)}>▶ Hervatten</button>
                  ) : (
                    <button className="parent-btn-orange" onClick={() => pauseChild(child.uid)}>⏸ Pauzeren</button>
                  )}
                  <button className="parent-btn-outline" style={{ fontSize: 12 }}
                    onClick={() => { setChangingPwUid(child.uid); setNewPassword(''); setPwError(''); setShowNewPw(false); }}>
                    🔑 Wachtwoord
                  </button>
                  <button className="parent-btn-outline" style={{ fontSize: 12, color: '#ef4444', borderColor: '#ef4444' }}
                    onClick={() => setConfirmDelete({ uid: child.uid, displayName: child.displayName })}>
                    🗑 Verwijderen
                  </button>
                </div>
              </div>

              {/* Wachtwoord wijzigen inline */}
              {changingPwUid === child.uid && (
                <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 16px', marginBottom: 8 }}>
                  <p style={{ fontSize: 13, marginBottom: 8, color: 'var(--text2)' }}>Nieuw wachtwoord voor <strong>{child.displayName}</strong>:</p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        className="parent-input"
                        type={showNewPw ? 'text' : 'password'}
                        placeholder="Minimaal 6 tekens"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        minLength={6}
                        style={{ paddingRight: 40, width: '100%', boxSizing: 'border-box' }}
                        autoFocus
                      />
                      <button type="button" onClick={() => setShowNewPw(p => !p)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex' }}>
                        {showNewPw
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M2 2l20 20-1.4 1.4L.6 3.4z" opacity=".7"/></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
                        }
                      </button>
                    </div>
                    <button className="parent-btn-primary" style={{ fontSize: 13 }}
                      onClick={() => changePassword(child.uid)} disabled={pwLoading || newPassword.length < 6}>
                      {pwLoading ? '…' : 'Opslaan'}
                    </button>
                    <button className="parent-btn-outline" style={{ fontSize: 13 }}
                      onClick={() => { setChangingPwUid(null); setNewPassword(''); setPwError(''); }}>
                      Annuleren
                    </button>
                  </div>
                  {pwError && <div className="parent-error" style={{ marginTop: 6, fontSize: 13 }}>⚠️ {pwError}</div>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Activiteiten */}
        <div className="parent-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="parent-section-title" style={{ marginBottom: 0 }}>Pulse activiteiten</h2>
            <button className="parent-btn-outline" onClick={loadActivities} style={{ fontSize: 12, padding: '6px 12px' }}>↻ Vernieuwen</button>
          </div>
          {activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <p style={{ fontSize: 13 }}>Nog geen activiteiten.</p>
            </div>
          ) : activities.map(a => (
            <div key={a.id} className="parent-activity-row">
              <div className="parent-activity-icon">
                {a.type === 'friend_request_sent' ? '📤' : '✅'}
              </div>
              <div style={{ flex: 1 }}>
                <div className="parent-activity-text">{a.description}</div>
                <div className="parent-activity-time">{timeAgo(a.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Bevestigingsdialoog verwijderen */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h3 className="modal-title">Account verwijderen</h3>
            <p style={{ color: 'var(--text2)', fontSize: 14, margin: '12px 0 24px', lineHeight: 1.6 }}>
              Weet u zeker dat u het account van <strong>{confirmDelete.displayName}</strong> wilt verwijderen?
              Dit kan niet ongedaan worden gemaakt.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>Annuleren</button>
              <button className="btn-primary" style={{ flex: 1, background: '#ef4444' }} onClick={() => deleteChild(confirmDelete.uid)}>Verwijderen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
