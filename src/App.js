// src/App.js
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import ErrorBoundary from './components/ErrorBoundary';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, messaging, getToken } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { connectSocket, disconnectSocket, BACKEND_URL } from './services/socket';
import './App.css';
import PulseLogo from './components/PulseLogo';
import { bootstrapDevice } from './lib/e2ee/deviceBootstrap';
import { shouldBootstrapE2EEDevice } from './lib/e2ee/config';
import { clearPulseUserStorage, getSafeInternalPath, scheduleIdleTask } from './utils';

const Homepage           = lazy(() => import('./screens/Homepage'));
const ChatScreen         = lazy(() => import('./screens/ChatScreen'));
const ParentAuthScreen   = lazy(() => import('./screens/ParentAuthScreen'));
const ParentDashboard    = lazy(() => import('./screens/ParentDashboard'));
const CallOverlay        = lazy(() => import('./components/CallOverlay'));
const ResetPasswordScreen = lazy(() => import('./screens/ResetPasswordScreen'));
const FunctiePagina       = lazy(() => import('./screens/FunctiePagina'));
const OuderlijkToezichtPagina = lazy(() => import('./screens/OuderlijkToezichtPagina'));
const HoeWerktHetPagina  = lazy(() => import('./screens/HoeWerktHetPagina'));
const OverPulsePagina    = lazy(() => import('./screens/OverPulsePagina'));
const PrivacybeleidPagina = lazy(() => import('./screens/PrivacybeleidPagina'));
const ElektronischeCommunicatieBeleidPagina = lazy(() => import('./screens/ElektronischeCommunicatieBeleidPagina'));
const ContactPagina      = lazy(() => import('./screens/ContactPagina'));

const VAPID_KEY = process.env.REACT_APP_VAPID_KEY;

const BACKEND = BACKEND_URL;
const ROUTE_PARENT_REFERRERS = {
  '/functies': '/functies',
  '/ouderlijk-toezicht': '/ouderlijk-toezicht',
  '/hoe-werkt-het': '/hoe-werkt-het',
  '/over-pulse': '/over-pulse',
};
const splashFallback = (
  <div className="splash">
    <div className="splash-logo"><PulseLogo size={40} textSize={28} /></div>
    <div className="splash-spinner" />
  </div>
);

export default function App() {
  const pathname = window.location.pathname;
  const goToHomepageForParentAuth = (tab = 'login', referrer = pathname) => {
    if (tab !== 'login') localStorage.setItem('pulse_parent_default_tab', tab);
    localStorage.setItem('pulse_parent_referrer', getSafeInternalPath(referrer));
    window.location.assign('/');
  };

  // Wachtwoord reset via Firebase link
  const urlParams = new URLSearchParams(window.location.search);
  const oobCode   = urlParams.get('oobCode');
  const mode      = urlParams.get('mode');
  if (mode === 'resetPassword' && oobCode) {
    return <Suspense fallback={null}><ResetPasswordScreen oobCode={oobCode} /></Suspense>;
  }

  // /functies route
  if (pathname === '/functies') {
    return (
      <Suspense fallback={splashFallback}>
        <FunctiePagina onParentClick={(tab = 'login') => goToHomepageForParentAuth(tab, ROUTE_PARENT_REFERRERS['/functies'])} />
      </Suspense>
    );
  }

  if (pathname === '/ouderlijk-toezicht') {
    return (
      <Suspense fallback={splashFallback}>
        <OuderlijkToezichtPagina onParentClick={(tab = 'login') => goToHomepageForParentAuth(tab, ROUTE_PARENT_REFERRERS['/ouderlijk-toezicht'])} />
      </Suspense>
    );
  }

  if (pathname === '/hoe-werkt-het') {
    return (
      <Suspense fallback={splashFallback}>
        <HoeWerktHetPagina onParentClick={(tab = 'login') => goToHomepageForParentAuth(tab, ROUTE_PARENT_REFERRERS['/hoe-werkt-het'])} />
      </Suspense>
    );
  }

  if (pathname === '/over-pulse') {
    return (
      <Suspense fallback={splashFallback}>
        <OverPulsePagina onParentClick={(tab = 'login') => goToHomepageForParentAuth(tab, ROUTE_PARENT_REFERRERS['/over-pulse'])} />
      </Suspense>
    );
  }

  if (pathname === '/privacybeleid') {
    return (
      <Suspense fallback={splashFallback}>
        <PrivacybeleidPagina />
      </Suspense>
    );
  }

  if (pathname === '/avg-beleid-elektronische-communicatie') {
    return (
      <Suspense fallback={splashFallback}>
        <ElektronischeCommunicatieBeleidPagina />
      </Suspense>
    );
  }

  if (pathname === '/contact') {
    return (
      <Suspense fallback={splashFallback}>
        <ContactPagina />
      </Suspense>
    );
  }

  return <MainApp />;
}

function MainApp() {
  const urlParams = new URLSearchParams(window.location.search);
  const [user,         setUser]         = useState(auth.currentUser);
  const [loading,      setLoading]      = useState(!auth.currentUser);
  const [incomingCall,    setIncomingCall]    = useState(null);
  const [missedCallAlert, setMissedCallAlert] = useState(false);
  const [onlineUsers,   setOnlineUsers]   = useState(new Set());
  const [inactiveUsers, setInactiveUsers] = useState(new Set());
  const [lightMode,    setLightMode]    = useState(localStorage.getItem('pulse_theme') === 'light');
  const [userRole,            setUserRole]            = useState(null);
  const [showParentAuth,      setShowParentAuth]      = useState(false);
  const [parentAuthDefaultTab, setParentAuthDefaultTab] = useState('login');
  const [parentAuthReferrer,   setParentAuthReferrer]   = useState(null);
  const [showParentDashboard, setShowParentDashboard] = useState(false);
  const [dashboardFading,     setDashboardFading]     = useState(false);
  const [parentActivityBadge, setParentActivityBadge] = useState(0);
  const [parentToast,         setParentToast]         = useState(null);
  const [pendingConvId,       setPendingConvId]       = useState(urlParams.get('convId') || null);
  const toastTimerRef          = useRef(null);
  const fcmVisibilityRef       = useRef(null);
  const onlineVisibilityRef    = useRef(null);
  const lastSignedInUidRef     = useRef(auth.currentUser?.uid || null);

  useEffect(() => {
    document.documentElement.classList.toggle('light', lightMode);
    localStorage.setItem('pulse_theme', lightMode ? 'light' : 'dark');
  }, [lightMode]);

  useEffect(() => scheduleIdleTask(() => {
    fetch(`${BACKEND}/`, { method: 'GET', keepalive: true }).catch((e) => {
      console.warn('[Pulse] Backend fout:', e.message);
    });
  }), []);

  // Fix iOS Safari keyboard: sync visual viewport height to CSS variable
  // Service worker → deep-link naar gesprek via notificatie-tik (één keer registreren)
  useEffect(() => {
    if (!navigator.serviceWorker) return;
    const handler = (event) => {
      if (event.data?.type === 'notification_click' && event.data.convId) {
        setPendingConvId(event.data.convId);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
    };
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const loadingTimeout = setTimeout(() => setLoading(false), 5000);
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(loadingTimeout);
      if (firebaseUser) {
        if (lastSignedInUidRef.current && lastSignedInUidRef.current !== firebaseUser.uid) {
          clearPulseUserStorage(lastSignedInUidRef.current);
        }
        lastSignedInUidRef.current = firebaseUser.uid;
        localStorage.setItem('pulse_user', '1');
        setUser(firebaseUser);
        Sentry.setUser({ id: firebaseUser.uid });
        // Controleer ouder-rol — localStorage flag heeft prioriteit over Firestore
        let role = 'user';
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (snap.exists()) role = snap.data()?.role || 'user';
          else {
            // Nieuw account — controleer of ouderregistratie bezig is (race condition met /api/users)
            const pendingRole = localStorage.getItem('pulse_pending_role');
            if (pendingRole === 'parent') role = 'parent';
          }
        } catch (e) { console.warn('[Pulse] Fout:', e.message); }
        setUserRole(role);
        if (shouldBootstrapE2EEDevice) {
          try {
            await bootstrapDevice(firebaseUser);
          } catch (e) {
            console.warn('[Pulse] Device bootstrap mislukt:', e.message);
          }
        }
        const idToken = await firebaseUser.getIdToken();
        const socket = connectSocket(firebaseUser.uid, idToken);
        const authHeader = { 'Authorization': `Bearer ${idToken}` };

        // Notificatie-toestemming + FCM token
        const registerFcmToken = async (authHdr) => {
          try {
            if (!messaging || typeof Notification === 'undefined') return;
            if (Notification.permission !== 'granted' && Notification.permission !== 'default') return;
            const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
            if (permission !== 'granted' || !VAPID_KEY || !navigator.serviceWorker) return;
            // Registreer de firebase messaging SW expliciet en wacht tot hij actief is
            const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            if (!swReg.active) {
              await new Promise((resolve, reject) => {
                const sw = swReg.installing ?? swReg.waiting;
                if (!sw) { resolve(); return; }
                sw.addEventListener('statechange', function handler(e) {
                  if (e.target.state === 'activated') { sw.removeEventListener('statechange', handler); resolve(); }
                  else if (e.target.state === 'redundant') { sw.removeEventListener('statechange', handler); reject(new Error('SW kon niet activeren')); }
                });
              });
            }
            const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
            if (!token) return;
            for (let attempt = 1; attempt <= 3; attempt += 1) {
              try {
                const res = await fetch(`${BACKEND}/api/fcm-token`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHdr },
                  body: JSON.stringify({ uid: firebaseUser.uid, token }),
                });
                if (res.ok) break;
              } catch (e) { console.warn('[Pulse] Fout:', e.message); }
              await new Promise(r => setTimeout(r, 1000 * attempt));
            }
          } catch (e) { console.warn('[Pulse] Fout:', e.message); }
        };
        await registerFcmToken(authHeader);
        // Herregistreer token wanneer app focus krijgt na lange afwezigheid
        let lastTokenRefresh = Date.now();
        const onVisibilityChange = () => {
          if (document.visibilityState === 'visible' && Date.now() - lastTokenRefresh > 3_600_000) {
            lastTokenRefresh = Date.now();
            firebaseUser.getIdToken().then(t => registerFcmToken({ 'Authorization': `Bearer ${t}` })).catch(e => { console.warn('[Pulse] Fout:', e.message); });
          }
        };
        if (fcmVisibilityRef.current) document.removeEventListener('visibilitychange', fcmVisibilityRef.current);
        fcmVisibilityRef.current = onVisibilityChange;
        document.addEventListener('visibilitychange', onVisibilityChange);

        // Profiel opslaan in backend
        fetch(`${BACKEND}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            uid:         firebaseUser.uid,
            displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            email:       firebaseUser.email,
            photoURL:    localStorage.getItem(`pulse_photo_${firebaseUser.uid}`) || firebaseUser.photoURL || '',
            role,
          }),
        }).catch(e => { console.warn('[Pulse] Fout:', e.message); });

        // Online status
        socket.off('user:status');
        socket.off('users:online');
        socket.off('users:inactive');
        socket.on('user:status', ({ uid, online, inactive }) => {
          if (online) {
            setOnlineUsers(prev => new Set([...prev, uid]));
            setInactiveUsers(prev => { const s = new Set(prev); if (inactive) s.add(uid); else s.delete(uid); return s; });
          } else {
            setOnlineUsers(prev => { const s = new Set(prev); s.delete(uid); return s; });
            setInactiveUsers(prev => { const s = new Set(prev); s.delete(uid); return s; });
          }
        });
        socket.on('users:online', (uids) => {
          setOnlineUsers(new Set(uids));
        });
        socket.on('users:inactive', (uids) => {
          setInactiveUsers(new Set(uids));
        });

        // Herverbinding via connect event (reconnect event werkt niet in Socket.IO v4)
        socket.off('connect');
        socket.on('connect', () => {
          socket.emit('user:online');
          socket.emit('users:online:request');
        });

        // Ouder realtime activiteitsnotificaties
        socket.off('parent:activity');
        socket.on('parent:activity', (data) => {
          setParentActivityBadge(prev => prev + 1);
          setParentToast(data);
          clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setParentToast(null), 4000);
        });

        // Firebase token verloopt na 1 uur — refresh bij connect_error
        socket.off('connect_error');
        socket.on('connect_error', async () => {
          try {
            const newToken = await firebaseUser.getIdToken(true);
            socket.auth.token = newToken;
          } catch (e) { console.warn('[Pulse] Fout:', e.message); }
        });

        // Tab-focus: haal actuele online lijst opnieuw op
        // Verwijder eventuele vorige listener via een stabiele referentie
        if (onlineVisibilityRef.current) document.removeEventListener('visibilitychange', onlineVisibilityRef.current);
        onlineVisibilityRef.current = () => {
          if (document.visibilityState === 'visible') socket.emit('users:online:request');
        };
        document.addEventListener('visibilitychange', onlineVisibilityRef.current);

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
        clearPulseUserStorage(lastSignedInUidRef.current);
        lastSignedInUidRef.current = null;
        localStorage.removeItem('pulse_user');
        setUser(null);
        Sentry.setUser(null);
        setOnlineUsers(new Set());
        setInactiveUsers(new Set());
        setUserRole(null);
        setShowParentDashboard(false);
        // Controleer of we direct ouder-auth moeten openen na redirect
        const pendingParentTab = localStorage.getItem('pulse_parent_default_tab');
        const pendingReferrer  = localStorage.getItem('pulse_parent_referrer');
        if (pendingParentTab) {
          localStorage.removeItem('pulse_parent_default_tab');
          localStorage.removeItem('pulse_parent_referrer');
          setParentAuthDefaultTab(pendingParentTab);
          setParentAuthReferrer(pendingReferrer || null);
          setShowParentAuth(true);
        } else {
          setShowParentAuth(false);
          setParentAuthReferrer(null);
        }
        if (onlineVisibilityRef.current) { document.removeEventListener('visibilitychange', onlineVisibilityRef.current); onlineVisibilityRef.current = null; }
        if (fcmVisibilityRef.current)    { document.removeEventListener('visibilitychange', fcmVisibilityRef.current);    fcmVisibilityRef.current = null; }
        disconnectSocket();
      }
      setLoading(false);
    });
    return () => {
      unsub();
      clearTimeout(loadingTimeout);
      if (onlineVisibilityRef.current) { document.removeEventListener('visibilitychange', onlineVisibilityRef.current); onlineVisibilityRef.current = null; }
      if (fcmVisibilityRef.current)    { document.removeEventListener('visibilitychange', fcmVisibilityRef.current);    fcmVisibilityRef.current = null; }
    };
  }, []);

  if (loading) return (
    <div className="splash">
      <div className="splash-logo"><PulseLogo size={40} textSize={28} /></div>
      <div className="splash-spinner" />
    </div>
  );

  return (
    <ErrorBoundary>
    <Suspense fallback={<div className="splash"><div className="splash-logo"><PulseLogo size={40} textSize={28} /></div><div className="splash-spinner" /></div>}>
    <div className="app-root">
      {!user
        ? showParentAuth
          ? <ParentAuthScreen defaultTab={parentAuthDefaultTab} onBack={() => { if (parentAuthReferrer) { window.location.assign(getSafeInternalPath(parentAuthReferrer)); } else { setShowParentAuth(false); setParentAuthDefaultTab('login'); setParentAuthReferrer(null); } }} />
          : <Homepage onParentClick={(tab = 'login') => { setParentAuthDefaultTab(tab); setShowParentAuth(true); }} />
        : <>
            <ChatScreen user={user} onlineUsers={onlineUsers} inactiveUsers={inactiveUsers} lightMode={lightMode} onToggleTheme={() => setLightMode(p => !p)} missedCallAlert={missedCallAlert} onCallLogRead={() => setMissedCallAlert(false)} isParent={userRole === 'parent'} parentActivityBadge={parentActivityBadge} parentToast={parentToast} onOpenDashboard={() => { setDashboardFading(true); setShowParentDashboard(true); setTimeout(() => setDashboardFading(false), 10); }} initialConvId={pendingConvId} onConvIdHandled={() => setPendingConvId(null)} />
            {userRole === 'parent' && showParentDashboard && (
              <div className={`parent-dashboard-overlay${dashboardFading ? ' fading' : ''}`} onClick={e => { if (e.target === e.currentTarget) { setDashboardFading(true); setTimeout(() => { setShowParentDashboard(false); setDashboardFading(false); }, 150); } }}>
                <ParentDashboard user={user} parentActivityBadge={parentActivityBadge} onActivitiesViewed={() => setParentActivityBadge(0)} onClose={() => { setDashboardFading(true); setTimeout(() => { setShowParentDashboard(false); setDashboardFading(false); }, 150); }} />
              </div>
            )}
          </>
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
    </Suspense>
    </ErrorBoundary>
  );
}
