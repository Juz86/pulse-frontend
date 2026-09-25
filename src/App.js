// src/App.js
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import ErrorBoundary from './components/ErrorBoundary';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, authPersistenceReady, db, messaging } from './firebase';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  connectSocket,
  disconnectSocket,
  BACKEND_URL,
} from './services/socket';
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
import { clearPulseUserStorage, scheduleIdleTask } from './utils';
import { isNativePulseEnvironment } from './lib/platform/runtime';
import { setupPulsePushNotifications } from './services/pushNotifications';
import {
  addUpdateStatusListener,
  completeFlexibleUpdate,
  fetchNativeUpdateStatus,
  fetchUpdatePolicy,
  startFlexibleUpdate,
  startImmediateUpdate,
} from './services/appUpdate';
import { subscribeToFeatureFlags } from './services/featureFlags';
import { FeatureFlagsProvider } from './context/FeatureFlagsContext';
import { markNativeWebBundleHealthy, stageNativeWebUpdate } from './services/nativeWebUpdate';
import {
  clearNativeCallIdentity,
  syncNativeCallIdentity,
} from './services/nativeCall';

const ChatScreen         = lazy(() => import('./screens/ChatScreen'));
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
const PushDiagnosticsScreen = lazy(() => import('./screens/PushDiagnosticsScreen'));

const BACKEND = BACKEND_URL;
const splashFallback = (
  <div className="splash">
    <div className="splash-logo"><PulseLogo size={40} textSize={28} /></div>
    <div className="splash-spinner" />
  </div>
);

function distanceInMeters(from, to) {
  if (!from || !to) return Infinity;
  const toRad = (v) => (v * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function normalizeLocationErrorCode(code) {
  if (code === 1) return 'PERMISSION_DENIED';
  if (code === 2) return 'POSITION_UNAVAILABLE';
  if (code === 3) return 'TIMEOUT';
  return 'UNKNOWN';
}

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
              Log in met je gebruikersnaam of e-mailadres.
            </p>

            <ol className="web-auth-steps" aria-label="Inloggen bij Pulse Web">
              <li><span>1</span> Vul je e-mailadres of gebruikersnaam in</li>
              <li><span>2</span> Vul je wachtwoord in</li>
              <li><span>3</span> Veilig chatten en bestanden delen</li>
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
          <span>Pulse beschermt je persoonlijke berichten met end-to-end versleuteling.</span>
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

  if (pathname === '/dev/push' && process.env.NODE_ENV !== 'production') {
    return <Suspense fallback={splashFallback}><PushDiagnosticsScreen /></Suspense>;
  }

  return <MainApp />;
}

function MainApp() {
  const urlParams = new URLSearchParams(window.location.search);
  const [user,         setUser]         = useState(null);
  const [authReady,    setAuthReady]    = useState(false);
  const [onlineUsers,   setOnlineUsers]   = useState(new Set());
  const [inactiveUsers, setInactiveUsers] = useState(new Set());
  const [userRole,            setUserRole]            = useState(null);
  const [showParentAuth,      setShowParentAuth]      = useState(false);
  const [parentAuthDefaultTab, setParentAuthDefaultTab] = useState('login');
  const [webAuthTab,          setWebAuthTab]          = useState('child');
  const [showParentDashboard, setShowParentDashboard] = useState(false);
  const [parentActivityBadge, setParentActivityBadge] = useState(0);
  const [parentToast,         setParentToast]         = useState(null);
  const [pendingConvId,       setPendingConvId]       = useState(urlParams.get('convId') || null);
  const [serviceTransportReady, setServiceTransportReady] = useState(false);
  const [appUpdate, setAppUpdate] = useState({
    ready: false,
    available: false,
    required: false,
    downloaded: false,
    checking: false,
  });
  const [hideOptionalUpdate, setHideOptionalUpdate] = useState(false);
  const [featureFlags, setFeatureFlags] = useState({});
  const showNativeDirectAuth = isNativePulseEnvironment();
  const toastTimerRef          = useRef(null);
  const pushCleanupRef         = useRef(null);
  const onlineVisibilityRef    = useRef(null);
  const lastSignedInUidRef     = useRef(null);
  const authQueryHandledRef    = useRef(false);
  const updateListenerRef      = useRef(null);

  useEffect(() => {
    let isAndroid = false;
    try {
      isAndroid = isNativePulseEnvironment()
        && (window.Capacitor?.getPlatform?.() === 'android' || window.Capacitor?.platform === 'android');
    } catch {
      isAndroid = false;
    }

    if (!isAndroid) return undefined;

    // Android WebView reports a zero CSS safe-area inset on several devices.
    document.documentElement.classList.add('pulse-platform-android');
    return () => document.documentElement.classList.remove('pulse-platform-android');
  }, []);

  useEffect(() => subscribeToFeatureFlags(BACKEND, setFeatureFlags), []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      // A bundle that reaches a running app is safe to retain. The native side
      // automatically restores the previous bundle if this acknowledgement is
      // never received after activation.
      await markNativeWebBundleHealthy();
      const result = await stageNativeWebUpdate();
      if (!cancelled && result?.staged) {
        console.info('[Pulse][Native web update] Update klaar voor de volgende start.', {
          version: result.version,
        });
      }
    }, 8_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const checkUpdate = async () => {
      setAppUpdate((prev) => ({ ...prev, checking: true }));
      const nativeStatus = await fetchNativeUpdateStatus();
      if (!active || !nativeStatus?.ok || !nativeStatus.installedFromPlay) {
        setAppUpdate((prev) => ({ ...prev, ready: true, checking: false }));
        return;
      }

      const clientVersionCode = Number(nativeStatus.clientVersionCode);
      const policy = await fetchUpdatePolicy(BACKEND, clientVersionCode);
      if (!active) return;

      const availableViaPlay = !!nativeStatus.isUpdateAvailable || !!nativeStatus.isUpdateInProgress;
      const canImmediate = !!nativeStatus.isImmediateAllowed;
      const canFlexible = !!nativeStatus.isFlexibleAllowed;
      // Het backendbeleid bepaalt de urgentie, maar Google Play blijft de enige
      // installatiebron. Toon daarom geen updateknop voordat Play de update
      // daadwerkelijk heeft vrijgegeven voor dit apparaat.
      const updateCanStart = canFlexible || canImmediate;
      const shouldShow = availableViaPlay && updateCanStart;
      const required = !!policy?.updateRequired && shouldShow;

      setAppUpdate((prev) => ({
        ...prev,
        ready: true,
        checking: false,
        available: shouldShow,
        required,
        downloaded: prev.downloaded,
        canImmediate,
        canFlexible,
      }));

      if (required && canImmediate) {
        try {
          await startImmediateUpdate();
        } catch (error) {
          console.warn('[Pulse][Update] Immediate update kon niet starten:', error?.message || error);
        }
      }
    };

    const attachUpdateListener = async () => {
      updateListenerRef.current = await addUpdateStatusListener((event = {}) => {
        if (event?.type === 'installState' && event?.isDownloaded) {
          setAppUpdate((prev) => ({
            ...prev,
            available: true,
            downloaded: true,
          }));
        }
      });
    };

    checkUpdate();
    attachUpdateListener();

    return () => {
      active = false;
      if (updateListenerRef.current?.remove) {
        Promise.resolve(updateListenerRef.current.remove()).catch(() => {});
      }
      updateListenerRef.current = null;
    };
  }, []);

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
      if (event.data?.type !== 'notification_click') return;
      const payload = event.data || {};
      if (payload.convId) setPendingConvId(payload.convId);
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
    let isActive = true;

    authPersistenceReady.finally(() => {
      if (!isActive) return;
      unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        setAuthReady(true);
        if (firebaseUser) {
          if (lastSignedInUidRef.current && lastSignedInUidRef.current !== firebaseUser.uid) {
            clearPulseUserStorage(lastSignedInUidRef.current);
          }
          lastSignedInUidRef.current = firebaseUser.uid;
          localStorage.setItem('pulse_user', '1');
          localStorage.setItem('pulse_last_uid', firebaseUser.uid);
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
          try {
            await syncNativeCallIdentity({ user: firebaseUser, idToken });
          } catch (error) {
            console.warn('[Pulse] Native oproepidentiteit synchroniseren mislukt:', error?.message || error);
          }
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

          if (pushCleanupRef.current) {
            await pushCleanupRef.current();
            pushCleanupRef.current = null;
          }
          pushCleanupRef.current = await setupPulsePushNotifications({
            messaging,
            vapidKey: VAPID_KEY,
            backendUrl: BACKEND,
            authHeader,
            uid: firebaseUser.uid,
            onOpenConversation: (convId) => setPendingConvId(convId),
          });

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
          socket.off('disconnect');
          const markCurrentUserOnline = () => {
            setOnlineUsers(prev => new Set([...prev, firebaseUser.uid]));
          };
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
            // Sommige presence-snapshots bevatten alleen andere gebruikers.
            // De ingelogde gebruiker is online zolang de eigen socket verbonden is.
            setOnlineUsers(new Set(socket.connected ? [...uids, firebaseUser.uid] : uids));
          });
          socket.on('users:inactive', (uids) => {
            setInactiveUsers(new Set(uids));
          });

          // Herverbinding via connect event (reconnect event werkt niet in Socket.IO v4)
          socket.off('connect');
          socket.on('connect', () => {
            markCurrentUserOnline();
            socket.emit('user:online');
            socket.emit('users:online:request');
          });
          socket.on('disconnect', () => {
            setOnlineUsers(prev => {
              const next = new Set(prev);
              next.delete(firebaseUser.uid);
              return next;
            });
            setInactiveUsers(prev => {
              const next = new Set(prev);
              next.delete(firebaseUser.uid);
              return next;
            });
          });
          if (socket.connected) {
            markCurrentUserOnline();
            socket.emit('user:online');
            socket.emit('users:online:request');
          }

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

        } else {
          clearPulseUserStorage(lastSignedInUidRef.current);
          lastSignedInUidRef.current = null;
          localStorage.removeItem('pulse_user');
          localStorage.removeItem('pulse_last_uid');
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
          if (pushCleanupRef.current) {
            Promise.resolve(pushCleanupRef.current()).catch(() => {});
            pushCleanupRef.current = null;
          }
          disconnectSocket();
          clearNativeCallIdentity().catch((error) => {
            console.warn('[Pulse] Native oproepidentiteit wissen mislukt:', error?.message || error);
          });
        }
      });
    });
    return () => {
      isActive = false;
      unsub();
      if (onlineVisibilityRef.current) { document.removeEventListener('visibilitychange', onlineVisibilityRef.current); onlineVisibilityRef.current = null; }
      if (pushCleanupRef.current) {
        Promise.resolve(pushCleanupRef.current()).catch(() => {});
        pushCleanupRef.current = null;
      }
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

  useEffect(() => {
    if (!user || userRole == null || userRole === 'parent') return undefined;
    if (typeof window === 'undefined' || !navigator?.geolocation) return undefined;

    let cancelled = false;
    let lastSentAt = 0;
    let lastKnownCoords = null;
    let lastErrorCode = null;

    const persistLocationState = async (payload) => {
      try {
        await updateDoc(doc(db, 'users', user.uid), payload);
      } catch (error) {
        console.warn('[Pulse] Locatie-updates opslaan mislukt:', error.message);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (cancelled) return;

        const lat = Number(position?.coords?.latitude);
        const lng = Number(position?.coords?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const now = Date.now();
        const nextCoords = { lat, lng };
        const movedMeters = distanceInMeters(lastKnownCoords, nextCoords);
        const shouldSkipUpdate = now - lastSentAt < 15_000 && movedMeters < 20;
        if (shouldSkipUpdate) return;

        lastSentAt = now;
        lastKnownCoords = nextCoords;
        lastErrorCode = null;

        void persistLocationState({
          liveLocation: {
            lat,
            lng,
            accuracy: Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null,
            heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
            speed: Number.isFinite(position.coords.speed) ? position.coords.speed : null,
            updatedAtMs: now,
          },
          liveLocationSharing: true,
          liveLocationErrorCode: null,
          liveLocationErrorMessage: null,
          liveLocationUpdatedAt: serverTimestamp(),
        });
      },
      (error) => {
        if (cancelled) return;
        const normalizedCode = normalizeLocationErrorCode(Number(error?.code || 0));
        if (normalizedCode === lastErrorCode) return;
        lastErrorCode = normalizedCode;

        void persistLocationState({
          liveLocationSharing: false,
          liveLocationErrorCode: normalizedCode,
          liveLocationErrorMessage: error?.message || 'Locatie niet beschikbaar',
          liveLocationUpdatedAt: serverTimestamp(),
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 15_000,
      },
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [user, userRole]);

  if (!authReady) return (
    <div className="splash">
      <div className="splash-logo"><PulseLogo size={40} textSize={28} /></div>
      <div className="splash-spinner" />
    </div>
  );

  return (
    <FeatureFlagsProvider flags={featureFlags}>
    <ErrorBoundary>
    <Suspense fallback={<div className="splash"><div className="splash-logo"><PulseLogo size={40} textSize={28} /></div><div className="splash-spinner" /></div>}>
    <div className="app-root">
      {appUpdate.ready && appUpdate.available && (!hideOptionalUpdate || appUpdate.required) && (
        <div className="pulse-update-overlay" role="presentation">
          <div className="pulse-update-banner" role="status" aria-live="polite">
            <div className="pulse-update-banner-text">
              <strong>{appUpdate.downloaded ? 'Update klaar' : 'Nieuwe update beschikbaar'}</strong>
              <span>
                {appUpdate.downloaded
                  ? 'Update is gedownload. Herstart Pulse om te installeren.'
                  : appUpdate.required
                    ? 'Deze update is nodig om Pulse veilig te blijven gebruiken.'
                    : 'Download op de achtergrond en update wanneer het jou uitkomt.'}
              </span>
            </div>
            <div className={`pulse-update-banner-actions${appUpdate.downloaded ? ' is-downloaded' : ''}`}>
              {!appUpdate.required && !appUpdate.downloaded && (
                <button type="button" className="pulse-update-btn pulse-update-btn-muted" onClick={() => setHideOptionalUpdate(true)}>
                  Later
                </button>
              )}
              {!appUpdate.downloaded && (
                <button
                  type="button"
                  className="pulse-update-btn pulse-update-btn-primary"
                  onClick={async () => {
                    try {
                      if (appUpdate.required) await startImmediateUpdate();
                      else if (appUpdate.canFlexible) await startFlexibleUpdate();
                    } catch (error) {
                      console.warn('[Pulse][Update] Update-flow starten mislukt:', error?.message || error);
                    }
                  }}
                >
                  {appUpdate.required ? 'Nu updaten' : 'Update downloaden'}
                </button>
              )}
              {appUpdate.downloaded && (
                <button
                  type="button"
                  className="pulse-update-btn pulse-update-btn-primary"
                  onClick={async () => {
                    try {
                      await completeFlexibleUpdate();
                    } catch (error) {
                      console.warn('[Pulse][Update] Update afronden mislukt:', error?.message || error);
                    }
                  }}
                >
                  Herstart Pulse
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {!user
        ? (
          <>
            {showNativeDirectAuth ? (
              <AuthScreen inModal />
            ) : (
              <WebAppLoginShell
                activeTab={webAuthTab}
                onTabChange={setWebAuthTab}
                parentDefaultTab={parentAuthDefaultTab}
              />
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
          </>
        )
        : <>
            <ChatScreen user={user} onlineUsers={onlineUsers} inactiveUsers={inactiveUsers} isParent={userRole === 'parent'} parentActivityBadge={parentActivityBadge} parentToast={parentToast} onDismissParentToast={() => setParentToast(null)} onOpenDashboard={() => setShowParentDashboard(true)} showParentDashboard={showParentDashboard} setShowParentDashboard={setShowParentDashboard} onParentActivitiesViewed={() => setParentActivityBadge(0)} initialConvId={pendingConvId} onConvIdHandled={() => setPendingConvId(null)} serviceTransportReady={serviceTransportReady} />
          </>
      }
    </div>
    </Suspense>
    </ErrorBoundary>
    </FeatureFlagsProvider>
  );
}
