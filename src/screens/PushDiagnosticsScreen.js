import React, { useCallback, useEffect, useState } from 'react';
import { auth, messaging, getToken } from '../firebase';
import { VAPID_KEY } from '../config/runtimeConfig';
import { BACKEND_URL } from '../services/socket';
import { isNativePulseEnvironment } from '../lib/platform/runtime';

const cardStyle = {
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 12,
  padding: 12,
  background: 'rgba(255,255,255,.04)',
};

function Row({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 10, marginBottom: 8 }}>
      <strong style={{ color: 'var(--text2)' }}>{label}</strong>
      <span style={{ overflowWrap: 'anywhere' }}>{String(value ?? '-')}</span>
    </div>
  );
}

export default function PushDiagnosticsScreen() {
  const [state, setState] = useState({
    platform: isNativePulseEnvironment() ? 'native' : 'web',
    notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    nativeReceivePermission: 'unknown',
    token: '',
    tokenSource: '',
    backendRegistration: 'not_started',
    lastError: '',
    lastUpdatedAt: '',
  });

  const uid = auth.currentUser?.uid || '';
  const setPartial = useCallback((patch) => {
    setState((prev) => ({
      ...prev,
      ...patch,
      lastUpdatedAt: new Date().toISOString(),
    }));
  }, []);

  const registerTokenInBackend = useCallback(async ({ token, transport, idToken }) => {
    if (!uid || !token || !idToken) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/fcm-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          uid,
          token,
          transport,
          platform: isNativePulseEnvironment() ? 'android' : 'web',
        }),
      });

      if (!response.ok) {
        setPartial({ backendRegistration: `failed_status_${response.status}` });
        return;
      }

      const payload = await response.json().catch(() => ({}));
      setPartial({ backendRegistration: payload?.stored ? 'stored' : 'ok_no_store_flag' });
    } catch (error) {
      setPartial({ backendRegistration: 'request_failed', lastError: error?.message || String(error) });
    }
  }, [setPartial, uid]);

  const runDiagnostics = useCallback(async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setPartial({ lastError: 'Niet ingelogd. Log eerst in.' });
        return;
      }

      const idToken = await currentUser.getIdToken();

      if (isNativePulseEnvironment()) {
        const [{ PushNotifications }, { Capacitor }] = await Promise.all([
          import('@capacitor/push-notifications'),
          import('@capacitor/core'),
        ]);

        if (!Capacitor.isNativePlatform()) {
          setPartial({ lastError: 'Native omgeving niet bevestigd.' });
          return;
        }

        const permission = await PushNotifications.checkPermissions();
        setPartial({ nativeReceivePermission: permission?.receive || 'unknown' });

        if (permission.receive !== 'granted') {
          const requested = await PushNotifications.requestPermissions();
          setPartial({ nativeReceivePermission: requested?.receive || 'unknown' });
          if (requested.receive !== 'granted') {
            setPartial({ lastError: 'Native push permissie geweigerd.' });
            return;
          }
        }

        await PushNotifications.createChannel({
          id: 'pulse_messages',
          name: 'Pulse berichten',
          description: 'Meldingen voor nieuwe chatberichten',
          importance: 5,
          visibility: 1,
          sound: 'default',
        }).catch(() => {});

        const tokenValue = await new Promise(async (resolve, reject) => {
          let done = false;
          const timeoutId = setTimeout(() => {
            if (done) return;
            done = true;
            reject(new Error('Native token timeout')); 
          }, 12000);

          const regHandle = await PushNotifications.addListener('registration', ({ value }) => {
            if (done) return;
            done = true;
            clearTimeout(timeoutId);
            resolve(value);
            regHandle.remove();
            errHandle.remove();
          });

          const errHandle = await PushNotifications.addListener('registrationError', (error) => {
            if (done) return;
            done = true;
            clearTimeout(timeoutId);
            reject(new Error(error?.error || 'Native registration error'));
            regHandle.remove();
            errHandle.remove();
          });

          await PushNotifications.register();
        });

        setPartial({ token: tokenValue, tokenSource: 'fcm_native' });
        await registerTokenInBackend({ token: tokenValue, transport: 'fcm_native', idToken });
        return;
      }

      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        setPartial({ notificationPermission: permission });
        if (permission !== 'granted') {
          setPartial({ lastError: 'Web notificatie-permissie niet verleend.' });
          return;
        }
      }

      if (!messaging || !VAPID_KEY || !navigator.serviceWorker) {
        setPartial({ lastError: 'Web messaging/VAPID/service worker niet beschikbaar.' });
        return;
      }

      const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const tokenValue = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
      if (!tokenValue) {
        setPartial({ lastError: 'Geen web token ontvangen.' });
        return;
      }

      setPartial({ token: tokenValue, tokenSource: 'fcm_web' });
      await registerTokenInBackend({ token: tokenValue, transport: 'fcm_web', idToken });
    } catch (error) {
      setPartial({ lastError: error?.message || String(error) });
    }
  }, [registerTokenInBackend, setPartial]);

  useEffect(() => {
    setPartial({
      notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    });
  }, [setPartial]);

  return (
    <div className="app-screen" style={{ minHeight: '100dvh', padding: '16px', overflowY: 'auto' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 12 }}>
        <div style={cardStyle}>
          <h2 style={{ marginBottom: 10 }}>Push Diagnostics (Dev)</h2>
          <p style={{ color: 'var(--text2)', marginBottom: 8 }}>
            Route: <code>/dev/push</code>
          </p>
          <button className="btn" type="button" onClick={runDiagnostics}>Run Diagnostics</button>
        </div>

        <div style={cardStyle}>
          <Row label="Platform" value={state.platform} />
          <Row label="UID" value={uid || 'niet ingelogd'} />
          <Row label="Notification perm" value={state.notificationPermission} />
          <Row label="Native receive perm" value={state.nativeReceivePermission} />
          <Row label="Token source" value={state.tokenSource || '-'} />
          <Row label="Token" value={state.token || '-'} />
          <Row label="Backend registratie" value={state.backendRegistration} />
          <Row label="Laatste fout" value={state.lastError || '-'} />
          <Row label="Last updated" value={state.lastUpdatedAt || '-'} />
        </div>
      </div>
    </div>
  );
}
