// src/App.js
import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, messaging, getToken } from './firebase';

const VAPID_KEY = process.env.REACT_APP_VAPID_KEY;
import { connectSocket, disconnectSocket } from './services/socket';
import AuthScreen         from './screens/AuthScreen';
import ChatScreen         from './screens/ChatScreen';
import CallOverlay        from './components/CallOverlay';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import './App.css';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// Backend alvast wakker maken
fetch(`${BACKEND}/`).catch(() => {});

export default function App() {
  // Wachtwoord reset via Firebase link
  const urlParams = new URLSearchParams(window.location.search);
  const oobCode   = urlParams.get('oobCode');
  const mode      = urlParams.get('mode');
  if (mode === 'resetPassword' && oobCode) {
    return <ResetPasswordScreen oobCode={oobCode} />;
  }

  const wasLoggedIn = localStorage.getItem('pulse_user') === '1';
  const [user,         setUser]         = useState(auth.currentUser);
  const [loading,      setLoading]      = useState(!auth.currentUser);
  const [incomingCall,    setIncomingCall]    = useState(null);
  const [missedCallAlert, setMissedCallAlert] = useState(false);
  const [onlineUsers,  setOnlineUsers]  = useState(new Set());
  const [lightMode,    setLightMode]    = useState(localStorage.getItem('pulse_theme') === 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('light', lightMode);
    localStorage.setItem('pulse_theme', lightMode ? 'light' : 'dark');
  }, [lightMode]);

  useEffect(() => {
    const loadingTimeout = setTimeout(() => setLoading(false), 5000);
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(loadingTimeout);
      if (firebaseUser) {
        localStorage.setItem('pulse_user', '1');
        setUser(firebaseUser);
        const socket = connectSocket(firebaseUser.uid);

        // Notificatie-toestemming + FCM token
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted' && VAPID_KEY) {
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (token) {
              fetch(`${BACKEND}/api/fcm-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: firebaseUser.uid, token }),
              }).catch(() => {});
            }
          }
        } catch {}

        // Profiel opslaan in backend
        fetch(`${BACKEND}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid:         firebaseUser.uid,
            displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            email:       firebaseUser.email,
            photoURL:    localStorage.getItem(`pulse_photo_${firebaseUser.uid}`) || firebaseUser.photoURL || '',
          }),
        }).catch(console.error);

        // Online status
        socket.off('user:status');
        socket.off('users:online');
        socket.on('user:status', ({ uid, online }) => {
          if (online) setOnlineUsers(prev => new Set([...prev, uid]));
          else setOnlineUsers(prev => { const s = new Set(prev); s.delete(uid); return s; });
        });
        socket.on('users:online', (uids) => {
          setOnlineUsers(new Set(uids));
        });

        // Inkomende oproepen
        socket.off('call:incoming');
        socket.off('call:ended');
        socket.on('call:incoming', (data) => {
          setIncomingCall(data);
        });
        // Beller hangt op voor de ontvanger opneemt → gemiste oproep loggen + overlay sluiten
        socket.on('call:ended', () => {
          setIncomingCall(prev => {
            if (prev) {
              const key = `pulse_calls_${firebaseUser.uid}`;
              const log = JSON.parse(localStorage.getItem(key) || '[]');
              const alreadyLogged = log[0]?.uid === prev.from && Date.now() - log[0]?.ts < 3000;
              if (!alreadyLogged) {
                log.unshift({ uid: prev.from, name: prev.callerName, photoURL: '', isVideo: prev.isVideo, direction: 'missed', ts: Date.now() });
                localStorage.setItem(key, JSON.stringify(log.slice(0, 50)));
                setMissedCallAlert(true);
              }
            }
            return null;
          });
        });
      } else {
        localStorage.removeItem('pulse_user');
        setUser(null);
        setOnlineUsers(new Set());
        disconnectSocket();
      }
      setLoading(false);
    });
    return () => { unsub(); clearTimeout(loadingTimeout); };
  }, []);

  if (loading) return (
    <div className="splash">
      <div className="splash-logo">💬 Pulse</div>
      <div className="splash-spinner" />
    </div>
  );

  return (
    <div className="app-root">
      {!user
        ? <AuthScreen />
        : <ChatScreen user={user} onlineUsers={onlineUsers} lightMode={lightMode} onToggleTheme={() => setLightMode(p => !p)} missedCallAlert={missedCallAlert} onCallLogRead={() => setMissedCallAlert(false)} />
      }
      {incomingCall && (
        <CallOverlay
          incoming={incomingCall}
          user={user}
          onClose={(answered) => {
            if (!answered && user) {
              const key = `pulse_calls_${user.uid}`;
              const log = JSON.parse(localStorage.getItem(key) || '[]');
              const alreadyLogged = log[0]?.uid === incomingCall.from && Date.now() - log[0]?.ts < 3000;
              if (!alreadyLogged) {
                log.unshift({ uid: incomingCall.from, name: incomingCall.callerName, photoURL: '', isVideo: incomingCall.isVideo, direction: 'missed', ts: Date.now() });
                localStorage.setItem(key, JSON.stringify(log.slice(0, 50)));
                setMissedCallAlert(true);
              }
            }
            setIncomingCall(null);
          }}
        />
      )}
    </div>
  );
}
