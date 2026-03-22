// src/components/ChatSidebar.js
import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Phone, Video, Delete, Search, Message, Users, Moon, Lightbulb, Bell, BellOff, Shield, Logout, Pin } from '../components/Icons';
import PulseLogo from '../components/PulseLogo';
import UserAvatar from '../components/UserAvatar';
import ConversationList from './ConversationList';
import { getInitials } from '../utils';

export default function ChatSidebar({
  user,
  onlineUsers,
  inactiveUsers,
  dnd,
  onToggleDnd,
  missedCallAlert,
  callLogRead,
  getCallLog,
  onCallLogRead,
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  chatFilter,
  setChatFilter,
  selectedGroupId,
  setSelectedGroupId,
  friendRequests,
  contactSuccess,
  contacts,
  conversations,
  activeConv,
  loadingConvs,
  convLabels,
  pinnedContacts,
  unreadCounts,
  photoPreview,
  isParent,
  parentActivityBadge,
  lightMode,
  onToggleTheme,
  onOpenDashboard,
  setLabelMenuConvId,
  // modal openers
  onNewChat,
  onNewGroup,
  onShowCallModal,
  onShowAddContact,
  onOpenProfile,
  // contact actions
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onTogglePin,
  onViewContact,
  onStartChat,
  onCallContact,
  onRemoveContact,
  // conv actions
  onOpenConversation,
  onCallFromConv,
  onDeleteConversation,
  // helpers
  getConvName,
  getOtherUid,
  getConvPhoto,
  getContactDisplayName,
}) {
  const hasMissedCall = (!callLogRead && getCallLog().some(e => e.direction === 'missed')) || missedCallAlert;

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-top">
          <PulseLogo size={30} textSize={20} />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="icon-btn" onClick={onNewChat} title="Nieuw gesprek"><Message size={18} /></button>
            <button className="icon-btn" onClick={onShowCallModal} title="Oproepen" style={{ position: 'relative' }}>
              <Phone size={18} />
              {hasMissedCall && (
                <span style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', border: '2px solid var(--surface)' }} />
              )}
            </button>
            <button className="icon-btn" onClick={onNewGroup} title="Nieuwe groep"><Users size={18} /></button>
            <button className={`icon-btn${dnd ? ' dnd-active' : ''}`} onClick={onToggleDnd} title={dnd ? 'Meldingen inschakelen' : 'Niet gestoord'}>
              {dnd ? <BellOff size={18} /> : <Bell size={18} />}
            </button>
          </div>
        </div>
        <div className="search-box">
          <Search size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} />
          <input placeholder="Zoeken…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Tabs */}
      <div className="sidebar-tabs">
        <button className={`sidebar-tab ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => { setActiveTab('chats'); setSearchQuery(''); }}>
          <Message size={15} /> Chats
        </button>
        <button className={`sidebar-tab ${activeTab === 'contacts' ? 'active' : ''}`} onClick={() => { setActiveTab('contacts'); setSearchQuery(''); }}>
          <Users size={15} /> Contacten
          {friendRequests.length > 0 && <span className="unread-badge" style={{ marginLeft: '6px', fontSize: '11px', padding: '1px 6px' }}>{friendRequests.length}</span>}
        </button>
      </div>

      {/* Filters */}
      {activeTab === 'chats' && (
        <div className="chat-filters">
          {['all', 'familie', 'vrienden'].map(f => (
            <button key={f} className={`chat-filter-chip${chatFilter === f ? ' active' : ''}`}
              onClick={() => { setChatFilter(f); setSelectedGroupId(null); }}>
              {f === 'all' ? 'Alles' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button className={`chat-filter-chip${chatFilter === 'groepen' ? ' active' : ''}`}
            onClick={() => { setChatFilter('groepen'); setSelectedGroupId(null); }}>
            Groepen
          </button>
        </div>
      )}

      {/* Chats tab */}
      {activeTab === 'chats' && (
        <ConversationList
          conversations={conversations}
          activeConv={activeConv}
          loadingConvs={loadingConvs}
          searchQuery={searchQuery}
          chatFilter={chatFilter}
          selectedGroupId={selectedGroupId}
          convLabels={convLabels}
          pinnedContacts={pinnedContacts}
          unreadCounts={unreadCounts}
          onlineUsers={onlineUsers}
          inactiveUsers={inactiveUsers}
          currentUid={user.uid}
          getConvName={getConvName}
          getOtherUid={getOtherUid}
          getConvPhoto={getConvPhoto}
          onOpen={onOpenConversation}
          onCallVoice={onCallFromConv}
          onCallVideo={onCallFromConv}
          onDelete={onDeleteConversation}
          setLabelMenuConvId={setLabelMenuConvId}
        />
      )}

      {/* Contacten tab */}
      {activeTab === 'contacts' && (
        <div className="conv-list">
          <div style={{ padding: '12px 18px' }}>
            <button className="btn-primary" style={{ padding: '10px', fontSize: '13px' }} onClick={onShowAddContact}>
              + Contact toevoegen
            </button>
            {contactSuccess && (
              <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '8px', color: '#4ade80', fontSize: '13px' }}>
                ✅ {contactSuccess}
              </div>
            )}
          </div>

          {/* Vriendschapsverzoeken */}
          {friendRequests.length > 0 && (
            <div style={{ padding: '0 12px 4px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 6px 8px' }}>
                Verzoeken ({friendRequests.length})
              </div>
              {friendRequests.map(req => (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(124,111,255,0.08)', borderRadius: '10px', marginBottom: '8px', border: '1px solid rgba(124,111,255,0.2)' }}>
                  <div className="avatar-circle sm">{getInitials(req.fromName)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.fromName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.fromEmail}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                    <button className="btn-primary" style={{ padding: '4px 10px', fontSize: '12px', minWidth: 0 }} onClick={() => onAcceptFriendRequest(req.id)}>✓</button>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', minWidth: 0 }} onClick={() => onDeclineFriendRequest(req.id)}>✗</button>
                  </div>
                </div>
              ))}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 6px 12px' }} />
            </div>
          )}

          {contacts.length === 0 && friendRequests.length === 0 && (
            <div className="empty-convs">
              <p>Nog geen contacten.</p>
              <p>Voeg iemand toe via e-mailadres.</p>
            </div>
          )}

          {contacts.filter(c =>
            !searchQuery.trim() ||
            c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchQuery.toLowerCase())
          ).map(contact => (
            <div key={contact.uid} style={{ margin: '0 12px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="avatar-wrap">
                  <UserAvatar photoURL={contact.photoURL} displayName={contact.displayName} />
                  {onlineUsers.has(contact.uid) && <span className={`online-dot${inactiveUsers.has(contact.uid) ? ' inactive' : ''}`} />}
                </div>
                <div className="conv-info" style={{ flex: 1, minWidth: 0 }}>
                  <div className="conv-name">{getContactDisplayName(contact)}</div>
                  <div className="conv-preview">{contact.email}</div>
                </div>
                <button className={`icon-btn${pinnedContacts.includes(contact.uid) ? ' pinned' : ''}`}
                  onClick={() => onTogglePin(contact.uid)}
                  title={pinnedContacts.includes(contact.uid) ? 'Losmaken' : 'Vastzetten'}>
                  <Pin size={17} />
                </button>
              </div>
              <div style={{ height: '1px', background: 'var(--border)' }} />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="icon-btn" onClick={() => onViewContact(contact)} title="Profiel bekijken" style={{ flex: 1, justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4" /><path d="M12 14c-6 0-8 2.5-8 4v1h16v-1c0-1.5-2-4-8-4z" /></svg>
                </button>
                <button className="icon-btn" onClick={() => onStartChat(contact)} title="Stuur bericht" style={{ flex: 1, justifyContent: 'center' }}><Message size={16} /></button>
                <button className="call-btn voice" onClick={() => onCallContact(contact, false)} title="Bellen" style={{ flex: 1 }}><Phone size={16} /></button>
                <button className="call-btn video" onClick={() => onCallContact(contact, true)} title="Videobellen" style={{ flex: 1 }}><Video size={16} /></button>
                <button className="icon-btn" onClick={() => onRemoveContact(contact.uid)} title="Verwijderen" style={{ flex: 1, justifyContent: 'center', color: 'var(--danger)' }}><Delete size={18} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="user-chip" style={{ cursor: 'pointer' }} onClick={onOpenProfile}>
          <div className="avatar-wrap" style={{ flexShrink: 0 }}>
            <UserAvatar photoURL={photoPreview || user.photoURL} displayName={user.displayName || user.email} className="sm" />
          </div>
          <div className="user-chip-info">
            <div className="user-chip-name">{user.displayName || user.email?.split('@')[0] || 'Gebruiker'}</div>
            <div className="user-chip-status">Online</div>
          </div>
        </div>
        {isParent && (
          <button className="icon-btn parent-dashboard-btn" onClick={onOpenDashboard} title="Ouderlijk toezicht" style={{ position: 'relative' }}>
            <Shield size={18} />
            {parentActivityBadge > 0 && <span className="parent-badge">{parentActivityBadge > 9 ? '9+' : parentActivityBadge}</span>}
          </button>
        )}
        <button className="icon-btn" onClick={onToggleTheme} title={lightMode ? 'Donker thema' : 'Licht thema'}>
          {lightMode ? <Moon size={18} /> : <Lightbulb size={18} />}
        </button>
        <button className="icon-btn danger" onClick={() => signOut(auth)} title="Uitloggen"><Logout size={18} /></button>
      </div>
    </aside>
  );
}
