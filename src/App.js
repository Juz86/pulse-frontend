// src/App.js
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import ErrorBoundary from './components/ErrorBoundary';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, authPersistenceReady, db, messaging, getToken } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { connectSocket, disconnectSocket, BACKEND_URL } from './services/socket';
import './App.css';
import PulseLogo from './components/PulseLogo';
import AuthModal from './components/AuthModal';
import ParentAuthModal from './components/ParentAuthModal';
import AuthScreen from './screens/AuthScreen';
import ParentAuthScreen from './screens/ParentAuthScreen';
import { Lock } from './components/Icons';
import { bootstrapDevice } from './lib/e2ee/deviceBootstrap';
import { MARKETING_AUTH_EVENT } from './lib/marketingAuthEvents';
import { VAPID_KEY } from './config/runtimeConfig';
import {
  probeE2EEServiceReady,
  shouldBootstrapE2EEDevice,
} from './lib/e2ee/config';
import { importLegacyE2EEStateIfNeeded } from './lib/e2ee/originStorageMigration';
import { clearPulseUserStorage, readStoredHistoryRules, scheduleIdleTask } from './utils';

const ChatScreen         = lazy(() => import('./screens/ChatScreen'));
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
const SitemapPagina      = lazy(() => import('./screens/SitemapPagina'));
const PrivacyFirstPagina = lazy(() => import('./screens/PrivacyFirstPagina'));

const BACKEND = BACKEND_URL;
const splashFallback = (
  <div className="splash">
    <div className="splash-logo"><PulseLogo size={40} textSize={28} /></div>
    <div className="splash-spinner" />
  </div>
);

function MarketingRoute({ Page, pageProps = {} }) {
  const [showChildAuth, setShowChildAuth] = useState(false);
  const [showParentAuth, setShowParentAuth] = useState(false);
  const [parentAuthDefaultTab, setParentAuthDefaultTab] = useState('login');

  const openParentAuth = (tab = 'login') => {
    setParentAuthDefaultTab(tab);
    setShowParentAuth(true);
  };

  useEffect(() => {
    const openAuth = ({ role = 'parent', mode = 'login' } = {}) => {
      if (role === 'child') {
        setShowChildAuth(true);
        return;
      }

      openParentAuth(mode === 'register' ? 'register' : 'login');
    };

    const handleAuthRequest = (event) => openAuth(event.detail);
    window.addEventListener(MARKETING_AUTH_EVENT, handleAuthRequest);

    const params = new URLSearchParams(window.location.search);
    const role = params.get('role');
    const mode = params.get('mode');
    if (role || mode) {
      openAuth({ role: role || 'parent', mode: mode || 'login' });
      params.delete('role');
      params.delete('mode');
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', nextUrl);
    }

    return () => window.removeEventListener(MARKETING_AUTH_EVENT, handleAuthRequest);
  }, []);

  return (
    <Suspense fallback={splashFallback}>
      <Page {...pageProps} onParentClick={openParentAuth} />
      {showChildAuth && (
        <AuthModal onClose={() => setShowChildAuth(false)} />
      )}
      {showParentAuth && (
        <ParentAuthModal
          onClose={() => {
            setShowParentAuth(false);
            setParentAuthDefaultTab('login');
          }}
          defaultTab={parentAuthDefaultTab}
        />
      )}
    </Suspense>
  );
}

function WebAppLoginShell({ activeTab = 'child', onTabChange, parentDefaultTab = 'login' }) {
  const isParentTab = activeTab === 'parent';

  return (
    <div className="web-auth-shell">
      <main className="web-auth-main" aria-labelledby="web-auth-title">
        <section className="web-auth-card" role="dialog" aria-modal="false" aria-labelledby="web-auth-title" aria-describedby="web-auth-description">
          <div className="web-auth-info">
            <div className="web-auth-info-logo" aria-hidden="true">
              <PulseLogo size={48} textSize={30} color="#5b5cff" gap={12} />
            </div>
            <h1 id="web-auth-title">Meld je aan</h1>
            <p id="web-auth-description">
              Kinderen gebruiken hun Pulse-gebruikersnaam, ouders beheren alles via het ouderportaal.
            </p>

            <ol className="web-auth-steps" aria-label="Inloggen bij Pulse Web">
              <li><span>1</span> Vul je gebruikersnaam in</li>
              <li><span>2</span> Vul je wachtwoord in</li>
              <li><span>3</span> Ga veilig verder met chatten</li>
            </ol>

            <p className="web-auth-help">
              Geen account? Vraag je ouder om een kindaccount voor je aan te maken.
            </p>
          </div>

          <div className="web-auth-form-card">
            <div className="web-auth-tabs" role="tablist" aria-label="Pulse Web login">
              <button
                type="button"
                id="web-auth-tab-child"
                className={`web-auth-tab${!isParentTab ? ' active' : ''}`}
                role="tab"
                aria-selected={!isParentTab}
                aria-controls="web-auth-panel-child"
                tabIndex={!isParentTab ? 0 : -1}
                onClick={() => onTabChange('child')}
              >
                Kind
              </button>
              <button
                type="button"
                id="web-auth-tab-parent"
                className={`web-auth-tab${isParentTab ? ' active' : ''}`}
                role="tab"
                aria-selected={isParentTab}
                aria-controls="web-auth-panel-parent"
                tabIndex={isParentTab ? 0 : -1}
                onClick={() => onTabChange('parent')}
              >
                Ouder
              </button>
            </div>

            {!isParentTab ? (
              <div
                id="web-auth-panel-child"
                role="tabpanel"
                aria-labelledby="web-auth-tab-child"
              >
                <AuthScreen isModal />
              </div>
            ) : (
              <div
                id="web-auth-panel-parent"
                role="tabpanel"
                aria-labelledby="web-auth-tab-parent"
                className="web-auth-parent-panel"
              >
                <ParentAuthScreen
                  key={parentDefaultTab}
                  isModal
                  defaultTab={parentDefaultTab}
                />
              </div>
            )}
          </div>
        </section>

        <p className="web-auth-privacy">
          <Lock size={15} aria-hidden="true" />
          Pulse beschermt je persoonlijke berichten met end-to-end versleuteling.
        </p>
      </main>
    </div>
  );
}

export default function App() {
  const pathname = window.location.pathname;

  // Wachtwoord reset via Firebase link
  const urlParams = new URLSearchParams(window.location.search);
  const oobCode   = urlParams.get('oobCode');
  const mode      = urlParams.get('mode');
  if (mode === 'resetPassword' && oobCode) {
    return <Suspense fallback={null}><ResetPasswordScreen oobCode={oobCode} /></Suspense>;
  }

  // /functies route
  if (pathname === '/functies') {
    return <MarketingRoute Page={FunctiePagina} />;
  }

  if (pathname === '/ouderlijk-toezicht') {
    return <MarketingRoute Page={OuderlijkToezichtPagina} />;
  }

  if (pathname === '/hoe-werkt-het') {
    return <MarketingRoute Page={HoeWerktHetPagina} />;
  }

  if (pathname === '/over-pulse') {
    return <MarketingRoute Page={OverPulsePagina} />;
  }

  if (pathname === '/privacybeleid') {
    return <MarketingRoute Page={PrivacybeleidPagina} />;
  }

  if (pathname === '/avg-beleid-elektronische-communicatie') {
    return <MarketingRoute Page={ElektronischeCommunicatieBeleidPagina} />;
  }

  if (pathname === '/contact') {
    return <MarketingRoute Page={ContactPagina} />;
  }

  if (pathname === '/sitemap') {
    return <MarketingRoute Page={SitemapPagina} />;
  }

  if (pathname === '/privacy-first') {
    return <MarketingRoute Page={PrivacyFirstPagina} />;
  }

  return <MainApp />;
}

function MainApp() {
  const urlParams = new URLSearchParams(window.location.search);
  const [user,         setUser]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [incomingCall,    setIncomingCall]    = useState(null);
  const [missedCallAlert, setMissedCallAlert] = useState(false);
  const [onlineUsers,   setOnlineUsers]   = useState(new Set());
  const [inactiveUsers, setInactiveUsers] = useState(new Set());
  const [userRole,            setUserRole]            = useState(null);
  const [showParentAuth,      setShowParentAuth]      = useState(false);
  const [parentAuthDefaultTab, setParentAuthDefaultTab] = useState('login');
  const [webAuthTab,          setWebAuthTab]          = useState('child');
  const [showParentDashboard, setShowParentDashboard] = useState(false);
  const [dashboardFading,     setDashboardFading]     = useState(false);
  const [parentActivityBadge, setParentActivityBadge] = useState(0);
  const [parentToast,         setParentToast]         = useState(null);
  const [pendingConvId,       setPendingConvId]       = useState(urlParams.get('convId') || null);
  const [serviceTransportReady, setServiceTransportReady] = useState(false);
  const toastTimerRef          = useRef(null);
  const fcmVisibilityRef       = useRef(null);
  const onlineVisibilityRef    = useRef(null);
  const lastSignedInUidRef     = useRef(null);
  const authQueryHandledRef    = useRef(false);

  useEffect(() => scheduleIdleTask(() => {
    fetch(`${BACKEND}/`, { method: 'GET', keepalive: true }).catch((e) => {
      console.warn('[Pulse] Backend fout:', e.message);
    });
  }), []);

  useEffect(() => {
    if (authQueryHandledRef.current || user) return;
    authQueryHandledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const role = params.get('role');
    const modeParam = params.get('mode');

    if (role === 'parent' || modeParam === 'register') {
      setParentAuthDefaultTab(modeParam === 'register' ? 'register' : 'login');
      setWebAuthTab('parent');
    } else if (role === 'child') {
      setWebAuthTab('child');
    }

    if (role || modeParam) {
      params.delete('role');
      params.delete('mode');
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', nextUrl);
    }
  }, [user]);

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
    const isTextEditingElement = (element) => {
      if (!element) return false;
      if (element.tagName === 'TEXTAREA') return !element.readOnly && !element.disabled;
      if (element.tagName === 'INPUT') {
        const type = String(element.type || 'text').toLowerCase();
        if (['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(type)) {
          return false;
        }
        return !element.readOnly && !element.disabled;
      }
      return Boolean(element.isContentEditable);
    };
    let stableHeight = vv.height;
    let stableWidth = vv.width;
    const update = () => {
      const activeElement = document.activeElement;
      const isEditing = isTextEditingElement(activeElement);
      if (Math.abs(vv.width - stableWidth) > 1) {
        stableWidth = vv.width;
        stableHeight = vv.height;
      }
      if (!isEditing) {
        stableHeight = vv.height;
      }
      document.documentElement.style.setProperty('--vvh', `${isEditing ? stableHeight : vv.height}px`);
    };
    update();
    vv.addEventListener('resize', update);
    window.addEventListener('focusin', update);
    window.addEventListener('focusout', update);
    return () => {
      vv.removeEventListener('resize', update);
      window.removeEventListener('focusin', update);
      window.removeEventListener('focusout', update);
    };
  }, []);

  useEffect(() => {
    let unsub = () => {};
    let loadingTimeout;
    let isActive = true;

    authPersistenceReady.finally(() => {
      if (!isActive) return;
      loadingTimeout = setTimeout(() => setLoading(false), 5000);
      unsub = onAuthStateChanged(auth, async (firebaseUser) => {
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
          let username = null;
          try {
            const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (snap.exists()) {
              role = snap.data()?.role || 'user';
              username = snap.data()?.username || null;
            }
            else {
              // Nieuw account — controleer of ouderregistratie bezig is (race condition met /api/users)
              const pendingRole = localStorage.getItem('pulse_pending_role');
              if (pendingRole === 'parent') role = 'parent';
            }
          } catch (e) { console.warn('[Pulse] Fout:', e.message); }
          setUserRole(role);
          const ready = await probeE2EEServiceReady(BACKEND);
          setServiceTransportReady(ready);
          if (shouldBootstrapE2EEDevice) {
            try {
              await importLegacyE2EEStateIfNeeded(firebaseUser.uid);
              await bootstrapDevice(firebaseUser);
            } catch (e) {
              console.warn('[Pulse] Device bootstrap mislukt:', e.message);
            }
          }
          const idToken = await firebaseUser.getIdToken();
          const socket = connectSocket(firebaseUser.uid, idToken);
          const authHeader = { 'Authorization': `Bearer ${idToken}` };

          try {
            await fetch(`${BACKEND}/api/users/sync-self`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...authHeader,
              },
              body: JSON.stringify({
                displayName: firebaseUser.displayName || firebaseUser.email || firebaseUser.uid,
                email: firebaseUser.email || null,
                photoURL: firebaseUser.photoURL || null,
                username,
                role,
              }),
            });
          } catch (e) {
            console.warn('[Pulse] Zelfregistratie backend mislukt:', e.message);
          }

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

          socket.off('coparent:accepted');
          socket.on('coparent:accepted', ({ childName, coparentName }) => {
            setParentActivityBadge(prev => prev + 1);
            setParentToast({
              type: 'coparent_accepted',
              description: `${coparentName || 'Een ouder'} heeft de uitnodiging voor ${childName || 'dit kind'} geaccepteerd.`,
            });
            clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => setParentToast(null), 4000);
          });

          socket.off('coparent:declined');
          socket.on('coparent:declined', ({ childName, coparentName }) => {
            setParentActivityBadge(prev => prev + 1);
            setParentToast({
              type: 'coparent_declined',
              description: `${coparentName || 'Een ouder'} heeft de uitnodiging voor ${childName || 'dit kind'} geweigerd.`,
            });
            clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => setParentToast(null), 4000);
          });

          // Firebase token verloopt na 1 uur — refresh bij connect_error
          socket.off('connect_error');
          socket.on('connect_error', async () => {
            try {
              const newToken = await firebaseUser.getIdToken(true);
              socket.auth.token = newToken;
              if (!socket.connected) {
                socket.connect();
              }
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
          socket.off('call:offer');
          socket.off('call:ended');
          const onIncomingCall = (data = {}) => {
            setIncomingCall({
              ...data,
              from: data.from || data.fromUid || null,
            });
          };
          socket.on('call:incoming', onIncomingCall);
          socket.on('call:offer', onIncomingCall);
          // Beller hangt op voor de ontvanger opneemt → gemiste oproep loggen + overlay sluiten
          socket.on('call:ended', () => {
            setIncomingCall(prev => {
              if (prev) {
                const key = `pulse_calls_${firebaseUser.uid}`;
                const log = JSON.parse(localStorage.getItem(key) || '[]');
                const historyRules = readStoredHistoryRules(firebaseUser.uid);
                const retentionDays = prev.isVideo ? historyRules.videoRetentionDays : historyRules.callRetentionDays;
                if (retentionDays === 0) {
                  return null;
                }
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
          setServiceTransportReady(false);
          setShowParentDashboard(false);
          // Oude builds konden ouder-auth na een redirect openen. Toon dit nu als modal.
          const pendingParentTab = localStorage.getItem('pulse_parent_default_tab');
          if (pendingParentTab) {
            localStorage.removeItem('pulse_parent_default_tab');
            localStorage.removeItem('pulse_parent_referrer');
            setParentAuthDefaultTab(pendingParentTab);
            setWebAuthTab('parent');
            setShowParentAuth(false);
          } else {
            setShowParentAuth(false);
          }
          if (onlineVisibilityRef.current) { document.removeEventListener('visibilitychange', onlineVisibilityRef.current); onlineVisibilityRef.current = null; }
          if (fcmVisibilityRef.current)    { document.removeEventListener('visibilitychange', fcmVisibilityRef.current);    fcmVisibilityRef.current = null; }
          disconnectSocket();
        }
        setLoading(false);
      });
    });
    return () => {
      isActive = false;
      unsub();
      clearTimeout(loadingTimeout);
      if (onlineVisibilityRef.current) { document.removeEventListener('visibilitychange', onlineVisibilityRef.current); onlineVisibilityRef.current = null; }
      if (fcmVisibilityRef.current)    { document.removeEventListener('visibilitychange', fcmVisibilityRef.current);    fcmVisibilityRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    let cancelled = false;

    const refreshServiceTransportReady = async () => {
      const ready = await probeE2EEServiceReady(BACKEND);
      if (!cancelled) {
        setServiceTransportReady(ready);
      }
    };

    refreshServiceTransportReady();

    const intervalId = window.setInterval(refreshServiceTransportReady, 30_000);
    const onVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        refreshServiceTransportReady();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityRefresh);
    };
  }, [user]);

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
        ? (
          <>
            <WebAppLoginShell
              activeTab={webAuthTab}
              onTabChange={setWebAuthTab}
              parentDefaultTab={parentAuthDefaultTab}
            />
            {showParentAuth && (
              <ParentAuthModal
                onClose={() => {
                  setShowParentAuth(false);
                  setParentAuthDefaultTab('login');
                }}
                defaultTab={parentAuthDefaultTab}
              />
            )}
          </>
        )
        : <>
            <ChatScreen user={user} onlineUsers={onlineUsers} inactiveUsers={inactiveUsers} missedCallAlert={missedCallAlert} onCallLogRead={() => setMissedCallAlert(false)} isParent={userRole === 'parent'} parentActivityBadge={parentActivityBadge} parentToast={parentToast} onOpenDashboard={() => { setDashboardFading(true); setShowParentDashboard(true); setTimeout(() => setDashboardFading(false), 10); }} initialConvId={pendingConvId} onConvIdHandled={() => setPendingConvId(null)} serviceTransportReady={serviceTransportReady} />
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
              const historyRules = readStoredHistoryRules(user.uid);
              const retentionDays = incomingCall.isVideo ? historyRules.videoRetentionDays : historyRules.callRetentionDays;
              if (retentionDays === 0) {
                setIncomingCall(null);
                return;
              }
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
