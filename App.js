// src/App.js
import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { connectSocket, disconnectSocket, getSocket } from './services/socket';
import AuthScreen   from './screens/AuthScreen';
import ChatScreen   from './screens/ChatScreen';
import CallOverlay  from './components/CallOverlay';
import './App.css';

export default function App() {
  const [user,        setUser]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [incomingCall, setIncomingCall] = useState(null); // { fromUid, callerName, offer, isVideo }

  // ── Firebase auth listener ──────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const socket = connectSocket(firebaseUser.uid);

        // Profiel opslaan in backend
        fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL || '',
          }),
        }).catch(console.error);

        // Luister naar inkomende gesprekken
        socket.on('call:incoming', (data) => setIncomingCall(data));
      } else {
        setUser(null);
        disconnectSocket();
      }
      setLoading(false);
    });
    return unsub;
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
        : <ChatScreen user={user} />
      }

      {/* Inkomend gesprek */}
      {incomingCall && (
        <CallOverlay
          incoming={incomingCall}
          user={user}
          onClose={() => setIncomingCall(null)}
        />
      )}
    </div>
  );
}
