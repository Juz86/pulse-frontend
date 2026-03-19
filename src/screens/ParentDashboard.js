// src/screens/ParentDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { getInitials, timeAgo } from '../utils';
import { UserCheck, UserPlus2, UserX, PauseCircle, PlayCircle, KeyRound, Trash2, Activity, Users, UserPlus, EyeOn, EyeOff } from '../components/Icons';
import { BACKEND_URL as BACKEND } from '../services/socket';

export default function ParentDashboard({ user, onClose }) {
  const [activeTab,      setActiveTab]      = useState('add');
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

  // Inline fouten voor pauzeren/hervatten/verwijderen
  const [childError,     setChildError]     = useState(''); // { uid, msg }

  // Submenu voor pauzeren/hervatten
  const [pauseMenuUid,   setPauseMenuUid]   = useState(null);
  const [resumeMenuUid,  setResumeMenuUid]  = useState(null);

  // Kind verwijderen
  const [confirmDelete,  setConfirmDelete]  = useState(null); // { uid, displayName }
  const [deleteError,    setDeleteError]    = useState('');

  // Analytics rapportage
  const [selectedChildUid, setSelectedChildUid] = useState(null);
  const [analytics,        setAnalytics]        = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError,   setAnalyticsError]   = useState('');

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
      setChildren(prev => [...prev, { uid: data.uid, displayName: data.displayName, username: data.username, online: false, pausedFeatures: { chat: false, call: false, video: false } }]);
      setCreateSuccess(`Account voor ${data.displayName} aangemaakt.`);
      setChildName(''); setChildUsername(''); setChildPassword('');
    } catch (err) { setCreateError(err.message); }
    setCreateLoading(false);
  }

  async function pauseChild(childUid, feature) {
    setChildError('');
    setPauseMenuUid(null);
    try {
      const res = await authFetch(`${BACKEND}/api/parent/pause/${childUid}`, {
        method: 'POST',
        body: JSON.stringify({ feature }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Pauzeren mislukt.'); }
      const data = await res.json();
      setChildren(prev => prev.map(c => c.uid === childUid ? { ...c, pausedFeatures: data.pausedFeatures } : c));
    } catch (err) { setChildError(err.message); }
  }

  async function resumeChild(childUid, feature) {
    setChildError('');
    setResumeMenuUid(null);
    try {
      const res = await authFetch(`${BACKEND}/api/parent/resume/${childUid}`, {
        method: 'POST',
        body: JSON.stringify({ feature }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Hervatten mislukt.'); }
      const data = await res.json();
      setChildren(prev => prev.map(c => c.uid === childUid ? { ...c, pausedFeatures: data.pausedFeatures } : c));
    } catch (err) { setChildError(err.message); }
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
    setDeleteError('');
    try {
      const res = await authFetch(`${BACKEND}/api/parent/delete-child/${childUid}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Verwijderen mislukt.'); }
      setChildren(prev => prev.filter(c => c.uid !== childUid));
      setConfirmDelete(null);
    } catch (err) { setDeleteError(err.message); }
  }

  async function loadAnalytics(childUid) {
    if (!childUid) { setAnalytics(null); setSelectedChildUid(null); return; }
    setSelectedChildUid(childUid);
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const res = await authFetch(`${BACKEND}/api/parent/analytics/${childUid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ophalen mislukt.');
      setAnalytics(data);
    } catch (err) { setAnalyticsError(err.message); setAnalytics(null); }
    setAnalyticsLoading(false);
  }

  const TABS = [
    { id: 'add',        icon: <UserPlus  size={16}/>, label: 'Kind toevoegen'       },
    { id: 'children',   icon: <Users     size={16}/>, label: 'Gekoppelde kinderen'  },
    { id: 'activities', icon: <Activity  size={16}/>, label: 'Pulse activiteiten'   },
  ];

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

        {/* Sidebar + content */}
        <div className="pd-layout">
          <div className="pd-sidebar">
            {TABS.map(t => (
              <button key={t.id} className={`pd-sidebar-tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className="pd-content">

            {/* Tab 1 — Kind toevoegen */}
            {activeTab === 'add' && (
              <div>
                <h2 className="parent-section-title">Kind toevoegen</h2>
                <p className="parent-section-sub" style={{ marginBottom: 16 }}>Maak een account aan voor uw kind. Het kind logt in met gebruikersnaam en wachtwoord.</p>
                <form onSubmit={createChild} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    id="child-name"
                    name="childName"
                    className="parent-input"
                    type="text"
                    placeholder="Naam van het kind"
                    aria-label="Naam van het kind"
                    autoComplete="off"
                    value={childName}
                    onChange={e => setChildName(e.target.value)}
                    required
                  />
                  <input
                    id="child-username"
                    name="childUsername"
                    className="parent-input"
                    type="text"
                    placeholder="Gebruikersnaam (bijv. jan_2014)"
                    aria-label="Gebruikersnaam"
                    autoComplete="off"
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
                      id="child-password"
                      name="childPassword"
                      className="parent-input"
                      type={showCreatePw ? 'text' : 'password'}
                      placeholder="Wachtwoord (minimaal 6 tekens)"
                      aria-label="Wachtwoord"
                      autoComplete="new-password"
                      value={childPassword}
                      onChange={e => setChildPassword(e.target.value)}
                      required
                      minLength={6}
                      style={{ paddingRight: 42, width: '100%', boxSizing: 'border-box' }}
                    />
                    <button type="button" aria-label={showCreatePw ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'} onClick={() => setShowCreatePw(p => !p)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex' }}>
                      {showCreatePw ? <EyeOff size={18}/> : <EyeOn size={18}/>}
                    </button>
                  </div>
                  <button className="parent-btn-primary" type="submit" disabled={createLoading}>
                    {createLoading ? 'Aanmaken…' : 'Kindaccount aanmaken →'}
                  </button>
                </form>
                {createError   && <div className="parent-error"   style={{ marginTop: 10 }}>⚠️ {createError}</div>}
                {createSuccess && <div className="parent-success" style={{ marginTop: 10 }}>✓ {createSuccess}</div>}
              </div>
            )}

            {/* Tab 2 — Gekoppelde kinderen */}
            {activeTab === 'children' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h2 className="parent-section-title" style={{ marginBottom: 0 }}>Gekoppelde kinderen</h2>
                  <button className="parent-btn-outline" onClick={loadChildren} style={{ fontSize: 12, padding: '6px 12px' }}>↻ Vernieuwen</button>
                </div>
                {childError && <div className="parent-error" style={{ marginBottom: 12 }}>⚠️ {childError}</div>}

                {loading ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>Laden…</div>
                ) : children.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>
                    <Users size={40} color="#ccc" style={{ marginBottom: 8 }}/>
                    <p>Nog geen kinderen toegevoegd.</p>
                    <p style={{ fontSize: 13, marginTop: 4 }}>Voeg een kind toe via het tabblad "Kind toevoegen".</p>
                  </div>
                ) : children.map(child => (
                  <div key={child.uid}>
                    {(() => {
                      const pf = child.pausedFeatures || { chat: false, call: false, video: false };
                      const anyPaused = pf.chat || pf.call || pf.video;
                      const allPaused = pf.chat && pf.call && pf.video;
                      const menuStyle = { position:'absolute', top:'calc(100% + 4px)', left:0, background:'var(--bg1,#fff)', border:'1px solid #e0e0e8', borderRadius:8, boxShadow:'0 4px 12px rgba(0,0,0,0.12)', zIndex:200, minWidth:190, padding:4 };
                      const menuItemStyle = { display:'block', width:'100%', textAlign:'left', background:'none', border:'none', padding:'8px 14px', cursor:'pointer', fontSize:13, borderRadius:6, color:'var(--text1,#1a1a1a)' };
                      return (
                    <div className={`parent-child-row${anyPaused ? ' paused' : ''}`}>
                      <div className="parent-child-avatar">{getInitials(child.displayName)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="parent-child-name">{child.displayName}</div>
                        <div className="pd-child-meta-row">
                          <div className="parent-child-meta">
                            <span className={`parent-status-dot ${child.online ? 'online' : 'offline'}`} />
                            <span>{child.online ? 'Online' : `Offline · ${timeAgo(child.lastSeen, 'Onbekend')}`}</span>
                            {child.username && <span style={{ marginLeft: 6, color: '#888', fontSize: 12 }}>@{child.username}</span>}
                            {pf.chat  && <span className="parent-paused-badge">Chat</span>}
                            {pf.call  && <span className="parent-paused-badge" style={{ background:'rgba(245,158,11,.12)', color:'#d97706' }}>Bellen</span>}
                            {pf.video && <span className="parent-paused-badge" style={{ background:'rgba(139,92,246,.12)', color:'#7c3aed' }}>Video</span>}
                          </div>
                          <div className="pd-child-actions">
                            {/* Pauzeren knop + submenu */}
                            {!allPaused && (
                              <div style={{ position:'relative' }}>
                                <button className="parent-btn-orange" onClick={() => { setPauseMenuUid(pauseMenuUid === child.uid ? null : child.uid); setResumeMenuUid(null); }} style={{ display:'flex', alignItems:'center', gap:5 }}>
                                  <PauseCircle size={16}/> Pauzeren ▾
                                </button>
                                {pauseMenuUid === child.uid && (
                                  <div style={menuStyle}>
                                    {!pf.chat  && <button style={menuItemStyle} onMouseEnter={e=>e.target.style.background='#f3f4f6'} onMouseLeave={e=>e.target.style.background='none'} onClick={() => pauseChild(child.uid, 'chat')}>💬 Chatten</button>}
                                    {!pf.call  && <button style={menuItemStyle} onMouseEnter={e=>e.target.style.background='#f3f4f6'} onMouseLeave={e=>e.target.style.background='none'} onClick={() => pauseChild(child.uid, 'call')}>📞 Bellen</button>}
                                    {!pf.video && <button style={menuItemStyle} onMouseEnter={e=>e.target.style.background='#f3f4f6'} onMouseLeave={e=>e.target.style.background='none'} onClick={() => pauseChild(child.uid, 'video')}>📹 Videobellen</button>}
                                    {(!pf.chat || !pf.call || !pf.video) && <button style={{ ...menuItemStyle, borderTop:'1px solid #f0f0f0', marginTop:2 }} onMouseEnter={e=>e.target.style.background='#f3f4f6'} onMouseLeave={e=>e.target.style.background='none'} onClick={() => pauseChild(child.uid, 'all')}>⏸ Alles pauzeren</button>}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Hervatten knop + submenu */}
                            {anyPaused && (
                              <div style={{ position:'relative' }}>
                                <button className="parent-btn-green" onClick={() => { setResumeMenuUid(resumeMenuUid === child.uid ? null : child.uid); setPauseMenuUid(null); }} style={{ display:'flex', alignItems:'center', gap:5 }}>
                                  <PlayCircle size={16}/> Hervatten ▾
                                </button>
                                {resumeMenuUid === child.uid && (
                                  <div style={menuStyle}>
                                    {pf.chat  && <button style={menuItemStyle} onMouseEnter={e=>e.target.style.background='#f3f4f6'} onMouseLeave={e=>e.target.style.background='none'} onClick={() => resumeChild(child.uid, 'chat')}>💬 Chatten</button>}
                                    {pf.call  && <button style={menuItemStyle} onMouseEnter={e=>e.target.style.background='#f3f4f6'} onMouseLeave={e=>e.target.style.background='none'} onClick={() => resumeChild(child.uid, 'call')}>📞 Bellen</button>}
                                    {pf.video && <button style={menuItemStyle} onMouseEnter={e=>e.target.style.background='#f3f4f6'} onMouseLeave={e=>e.target.style.background='none'} onClick={() => resumeChild(child.uid, 'video')}>📹 Videobellen</button>}
                                    {(pf.chat || pf.call || pf.video) && <button style={{ ...menuItemStyle, borderTop:'1px solid #f0f0f0', marginTop:2 }} onMouseEnter={e=>e.target.style.background='#f3f4f6'} onMouseLeave={e=>e.target.style.background='none'} onClick={() => resumeChild(child.uid, 'all')}>▶ Alles hervatten</button>}
                                  </div>
                                )}
                              </div>
                            )}
                            <button className="parent-btn-outline" style={{ fontSize: 12, display:'flex', alignItems:'center', gap:5 }}
                              onClick={() => { setChangingPwUid(child.uid); setNewPassword(''); setPwError(''); setShowNewPw(false); }}>
                              <KeyRound size={16} color="#6b7280"/> Wachtwoord
                            </button>
                            <button className="parent-btn-outline" style={{ fontSize: 12, color: '#ef4444', borderColor: '#ef4444', display:'flex', alignItems:'center', gap:5 }}
                              onClick={() => setConfirmDelete({ uid: child.uid, displayName: child.displayName })}>
                              <Trash2 size={16} color="#ef4444"/> Verwijderen
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })()}

                    {/* Wachtwoord wijzigen inline */}
                    {changingPwUid === child.uid && (
                      <div style={{ background: '#f9f9fc', borderRadius: 10, padding: '12px 16px', marginBottom: 8, border: '1px solid #e0e0e8' }}>
                        <p style={{ fontSize: 13, marginBottom: 8, color: '#555' }}>Nieuw wachtwoord voor <strong>{child.displayName}</strong>:</p>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <input
                              className="parent-input"
                              type={showNewPw ? 'text' : 'password'}
                              placeholder="Minimaal 6 tekens"
                              aria-label="Nieuw wachtwoord"
                              value={newPassword}
                              onChange={e => setNewPassword(e.target.value)}
                              minLength={6}
                              style={{ paddingRight: 40, width: '100%', boxSizing: 'border-box' }}
                              autoFocus
                            />
                            <button type="button" aria-label={showNewPw ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'} onClick={() => setShowNewPw(p => !p)}
                              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex' }}>
                              {showNewPw ? <EyeOff size={16}/> : <EyeOn size={16}/>}
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
            )}

            {/* Tab 3 — Pulse activiteiten */}
            {activeTab === 'activities' && (
              <div>
                {/* Header met kind-selector */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
                  <h2 className="parent-section-title" style={{ marginBottom: 0 }}>Pulse activiteiten</h2>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {children.length > 0 && (
                      <select
                        className="parent-input"
                        style={{ fontSize: 13, padding: '6px 10px', width: 'auto', cursor: 'pointer' }}
                        value={selectedChildUid || ''}
                        onChange={e => loadAnalytics(e.target.value || null)}
                      >
                        <option value="">— Selecteer kind —</option>
                        {children.map(c => <option key={c.uid} value={c.uid}>{c.displayName}</option>)}
                      </select>
                    )}
                    <button className="parent-btn-outline" onClick={loadActivities} style={{ fontSize: 12, padding: '6px 12px' }}>↻ Vernieuwen</button>
                  </div>
                </div>

                {/* Analyserapport voor geselecteerd kind */}
                {selectedChildUid && (
                  <div style={{ marginBottom: 24 }}>
                    {analyticsLoading && <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>Rapport laden…</div>}
                    {analyticsError && <div className="parent-error" style={{ marginBottom: 12 }}>⚠️ {analyticsError}</div>}
                    {analytics && !analyticsLoading && (() => {
                      const { profile, contacts, friendRequests, sessions, messaging } = analytics;
                      const fmtSecs = s => { if (!s) return '0m'; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); return h > 0 ? `${h}u ${m}m` : `${m}m`; };
                      const maxBar = Math.max(...sessions.daily.map(d => d.seconds), 1);
                      const dayLabels = { 0:'Zo', 1:'Ma', 2:'Di', 3:'Wo', 4:'Do', 5:'Vr', 6:'Za' };
                      const statusDot = profile.online
                        ? { background: '#22c55e', boxShadow: '0 0 0 2px #dcfce7' }
                        : { background: '#9ca3af' };
                      return (
                        <div className="analytics-report">

                          {/* Profiel */}
                          <div className="analytics-profile-card">
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              {profile.photoURL
                                ? <img src={profile.photoURL} alt={profile.displayName} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid #e9e9f5' }} />
                                : <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700, border: '3px solid #e9e9f5' }}>{getInitials(profile.displayName)}</div>
                              }
                              <span style={{ position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: '50%', border: '2px solid #fff', ...statusDot }} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text1,#1a1a1a)' }}>{profile.displayName}</div>
                              {profile.username && <div style={{ fontSize: 13, color: '#888' }}>@{profile.username}</div>}
                              <div style={{ fontSize: 12, color: profile.online ? '#22c55e' : '#9ca3af', marginTop: 2 }}>{profile.online ? '● Online' : `Offline · ${timeAgo(profile.lastSeen, 'Onbekend')}`}</div>
                            </div>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--text1,#1a1a1a)' }}>{contacts.total}</div>
                                <div style={{ fontSize: 11, color: '#888' }}>Contacten</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--text1,#1a1a1a)' }}>{messaging.topContacts.length}</div>
                                <div style={{ fontSize: 11, color: '#888' }}>Chats</div>
                              </div>
                            </div>
                          </div>

                          {/* Gebruik - sessies */}
                          <div className="analytics-section">
                            <div className="analytics-section-title">📱 App-gebruik (afgelopen 7 dagen)</div>
                            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                              <div className="analytics-stat-box">
                                <div className="analytics-stat-value">{fmtSecs(sessions.totalSecondsLast7Days)}</div>
                                <div className="analytics-stat-label">Totale schermtijd</div>
                              </div>
                              <div className="analytics-stat-box">
                                <div className="analytics-stat-value">{sessions.daily.filter(d => d.seconds > 0).length} / 7</div>
                                <div className="analytics-stat-label">Actieve dagen</div>
                              </div>
                              <div className="analytics-stat-box">
                                <div className="analytics-stat-value">{fmtSecs(sessions.daily.filter(d=>d.seconds>0).length ? Math.round(sessions.totalSecondsLast7Days / Math.max(sessions.daily.filter(d=>d.seconds>0).length,1)) : 0)}</div>
                                <div className="analytics-stat-label">Gem. per dag</div>
                              </div>
                            </div>
                            {/* 7-daagse staafgrafiek */}
                            <div className="analytics-bar-chart">
                              {sessions.daily.map((day, i) => {
                                const dt = new Date(day.date + 'T12:00:00');
                                const label = dayLabels[dt.getDay()];
                                const pct = Math.round((day.seconds / maxBar) * 100);
                                return (
                                  <div key={day.date} className="analytics-bar-col">
                                    <div className="analytics-bar-wrap">
                                      {day.seconds > 0 && <div className="analytics-bar-tooltip">{fmtSecs(day.seconds)}</div>}
                                      <div className="analytics-bar" style={{ height: `${Math.max(pct, day.seconds > 0 ? 4 : 0)}%`, opacity: day.seconds > 0 ? 1 : 0.15 }} />
                                    </div>
                                    <div className="analytics-bar-label">{label}</div>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Piekuren */}
                            {Object.keys(sessions.hourlyPattern).length > 0 && (
                              <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Piekuren</div>
                                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                  {Array.from({length: 24}, (_, h) => {
                                    const mins = sessions.hourlyPattern[h] || 0;
                                    const maxMins = Math.max(...Object.values(sessions.hourlyPattern), 1);
                                    const intensity = Math.round((mins / maxMins) * 100);
                                    return (
                                      <div key={h} title={`${h}:00 — ${mins}m`} style={{ width: 20, height: 20, borderRadius: 4, background: mins > 0 ? `rgba(124,58,237,${0.15 + intensity * 0.0085})` : '#f3f4f6', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: intensity > 60 ? '#7c3aed' : '#aaa', cursor: 'default' }}>{h}</div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Communicatie */}
                          <div className="analytics-section">
                            <div className="analytics-section-title">💬 Communicatie (afgelopen 30 dagen)</div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                              <div className="analytics-stat-box">
                                <div className="analytics-stat-value">{messaging.totalMessagesSent}</div>
                                <div className="analytics-stat-label">Berichten verstuurd</div>
                              </div>
                              <div className="analytics-stat-box">
                                <div className="analytics-stat-value">{fmtSecs(messaging.totalCallSecs)}</div>
                                <div className="analytics-stat-label">📞 Bellen</div>
                              </div>
                              <div className="analytics-stat-box">
                                <div className="analytics-stat-value">{fmtSecs(messaging.totalVideoSecs)}</div>
                                <div className="analytics-stat-label">📹 Videobellen</div>
                              </div>
                            </div>
                          </div>

                          {/* Top contacten */}
                          {messaging.topContacts.length > 0 && (
                            <div className="analytics-section">
                              <div className="analytics-section-title">👥 Meest contact mee</div>
                              {messaging.topContacts.map((c, i) => (
                                <div key={c.uid || i} className="analytics-contact-row">
                                  <div className="analytics-contact-rank">#{i + 1}</div>
                                  <div className="analytics-contact-avatar">{getInitials(c.name)}</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text1,#1a1a1a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}{c.isGroup && <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>(groep)</span>}</div>
                                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                                      {c.messagesSent > 0 && <span style={{ marginRight: 8 }}>💬 {c.messagesSent} berichten</span>}
                                      {c.callCount > 0 && <span style={{ marginRight: 8 }}>📞 {c.callCount}× ({fmtSecs(c.totalCallSecs)})</span>}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    {fmtSecs(c.totalCallSecs + c.messagesSent * 0)}
                                    {c.totalCallSecs > 0 ? fmtSecs(c.totalCallSecs) : `${c.messagesSent} msg`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Vriendschapsverzoeken */}
                          {(friendRequests.sent.length > 0 || friendRequests.received.length > 0) && (
                            <div className="analytics-section">
                              <div className="analytics-section-title">🤝 Vriendschapsverzoeken</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verstuurd naar</div>
                                  {friendRequests.sent.length === 0
                                    ? <div style={{ fontSize: 13, color: '#bbb' }}>Geen</div>
                                    : friendRequests.sent.map((r, i) => (
                                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 13 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.status === 'accepted' ? '#22c55e' : r.status === 'declined' ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
                                        <span style={{ color: 'var(--text1,#1a1a1a)' }}>{r.toName}</span>
                                        <span style={{ fontSize: 11, color: '#aaa', marginLeft: 'auto' }}>{r.status === 'accepted' ? '✓ Geaccepteerd' : r.status === 'declined' ? '✗ Geweigerd' : '⏳ In behandeling'}</span>
                                      </div>
                                    ))
                                  }
                                </div>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ontvangen van</div>
                                  {friendRequests.received.length === 0
                                    ? <div style={{ fontSize: 13, color: '#bbb' }}>Geen</div>
                                    : friendRequests.received.map((r, i) => (
                                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 13 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.status === 'accepted' ? '#22c55e' : r.status === 'declined' ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
                                        <span style={{ color: 'var(--text1,#1a1a1a)' }}>{r.fromName}</span>
                                        <span style={{ fontSize: 11, color: '#aaa', marginLeft: 'auto' }}>{r.status === 'accepted' ? '✓ Geaccepteerd' : r.status === 'declined' ? '✗ Geweigerd' : '⏳ In behandeling'}</span>
                                      </div>
                                    ))
                                  }
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Contactenlijst */}
                          {contacts.list.length > 0 && (
                            <div className="analytics-section">
                              <div className="analytics-section-title">📋 Contacten ({contacts.total})</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {contacts.list.map(c => (
                                  <div key={c.uid} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8f8fc', borderRadius: 20, padding: '4px 10px 4px 4px', fontSize: 13 }}>
                                    {c.photoURL
                                      ? <img src={c.photoURL} alt={c.displayName} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                                      : <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e0e0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#7c3aed' }}>{getInitials(c.displayName)}</div>
                                    }
                                    <span style={{ color: 'var(--text1,#1a1a1a)' }}>{c.displayName}</span>
                                  </div>
                                ))}
                                {contacts.total > contacts.list.length && <div style={{ fontSize: 12, color: '#aaa', display: 'flex', alignItems: 'center' }}>+{contacts.total - contacts.list.length} meer</div>}
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Activiteitenlogboek */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activiteitenlog</div>
                  {activities.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
                      <Activity size={32} color="#ccc" style={{ marginBottom: 8 }}/>
                      <p style={{ fontSize: 13 }}>Nog geen activiteiten.</p>
                    </div>
                  ) : activities.map(a => (
                    <div key={a.id} className="parent-activity-row">
                      <div className="parent-activity-icon">
                        {a.type === 'friend_request_sent'     && <UserPlus2 size={18} color="#3b82f6" />}
                        {a.type === 'friend_request_accepted' && <UserCheck size={18} color="#22c55e" />}
                        {a.type === 'friend_request_rejected' && <UserX     size={18} color="#ef4444" />}
                        {a.type !== 'friend_request_sent' && a.type !== 'friend_request_accepted' && a.type !== 'friend_request_rejected' && <UserCheck size={18} color="#22c55e" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="parent-activity-text">{a.description}</div>
                        <div className="parent-activity-time">{timeAgo(a.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Bevestigingsdialoog verwijderen */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => { setConfirmDelete(null); setDeleteError(''); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h3 className="modal-title">Account verwijderen</h3>
            <p style={{ color: 'var(--text2)', fontSize: 14, margin: '12px 0 24px', lineHeight: 1.6 }}>
              Weet u zeker dat u het account van <strong>{confirmDelete.displayName}</strong> wilt verwijderen?
              Dit kan niet ongedaan worden gemaakt.
            </p>
            {deleteError && <div className="parent-error" style={{ marginBottom: 12 }}>⚠️ {deleteError}</div>}
            <div className="modal-actions">
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setConfirmDelete(null); setDeleteError(''); }}>Annuleren</button>
              <button className="btn-primary" style={{ flex: 1, background: '#ef4444' }} onClick={() => deleteChild(confirmDelete.uid)}>Verwijderen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
