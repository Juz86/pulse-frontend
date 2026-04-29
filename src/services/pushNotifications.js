import { isNativePulseEnvironment } from '../lib/platform/runtime';

function logInfo(...args) {
  console.info('[Pulse][Push]', ...args);
}

function logWarn(...args) {
  console.warn('[Pulse][Push]', ...args);
}

async function postToken({ backendUrl, authHeader, uid, token, transport }) {
  if (!backendUrl || !authHeader?.Authorization || !uid || !token) return false;

  try {
    const response = await fetch(`${backendUrl}/api/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify({
        uid,
        token,
        transport,
        platform: isNativePulseEnvironment() ? 'android' : 'web',
      }),
    });

    if (!response.ok) {
      logWarn('Token registratie mislukt met status', response.status);
      return false;
    }

    return true;
  } catch (error) {
    logWarn('Token registratie request fout:', error?.message || error);
    return false;
  }
}

async function registerWebPush({ messaging, vapidKey, backendUrl, authHeader, uid }) {
  if (!messaging || typeof window === 'undefined' || typeof Notification === 'undefined') {
    return null;
  }

  if (!vapidKey || !navigator.serviceWorker) {
    logWarn('Web push overgeslagen: VAPID key of serviceWorker ontbreekt.');
    return null;
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  if (permission !== 'granted') {
    logInfo('Web notificatie-toestemming niet verleend:', permission);
    return null;
  }

  const { getToken } = await import('firebase/messaging');
  const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swReg,
  });

  if (!token) {
    logWarn('Web FCM token leeg ontvangen.');
    return null;
  }

  await postToken({ backendUrl, authHeader, uid, token, transport: 'fcm_web' });
  logInfo('Web FCM token geregistreerd.');
  return { token, transport: 'fcm_web' };
}

async function registerNativePush({ backendUrl, authHeader, uid, onOpenConversation }) {
  const [{ Capacitor }, { PushNotifications }] = await Promise.all([
    import('@capacitor/core'),
    import('@capacitor/push-notifications'),
  ]);

  if (!Capacitor.isNativePlatform()) return null;

  const listeners = [];

  const addListener = async (eventName, callback) => {
    const handle = await PushNotifications.addListener(eventName, callback);
    listeners.push(handle);
  };

  await addListener('registration', async ({ value }) => {
    if (!value) return;
    logInfo('Native push token ontvangen.');
    await postToken({ backendUrl, authHeader, uid, token: value, transport: 'fcm_native' });
  });

  await addListener('registrationError', (error) => {
    logWarn('Native push registratie fout:', error?.error || error);
  });

  await addListener('pushNotificationReceived', (notification) => {
    logInfo('Push ontvangen (foreground):', notification?.id || 'no-id');
  });

  await addListener('pushNotificationActionPerformed', (event) => {
    const convId = event?.notification?.data?.convId;
    if (convId && typeof onOpenConversation === 'function') {
      onOpenConversation(convId);
    }
  });

  const permission = await PushNotifications.checkPermissions();
  if (permission.receive !== 'granted') {
    const requestResult = await PushNotifications.requestPermissions();
    if (requestResult.receive !== 'granted') {
      logInfo('Native push toestemming geweigerd.');
      return {
        cleanup: async () => {
          await Promise.all(listeners.map((handle) => handle?.remove?.() || Promise.resolve()));
        },
      };
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

  await PushNotifications.register();

  return {
    cleanup: async () => {
      await Promise.all(listeners.map((handle) => handle?.remove?.() || Promise.resolve()));
    },
  };
}

export async function setupPulsePushNotifications({
  messaging,
  vapidKey,
  backendUrl,
  authHeader,
  uid,
  onOpenConversation,
}) {
  if (!uid || !authHeader?.Authorization) return () => {};

  if (isNativePulseEnvironment()) {
    try {
      const nativeSetup = await registerNativePush({
        backendUrl,
        authHeader,
        uid,
        onOpenConversation,
      });
      return async () => {
        await nativeSetup?.cleanup?.();
      };
    } catch (error) {
      logWarn('Native push setup mislukt, fallback naar web push:', error?.message || error);
    }
  }

  try {
    await registerWebPush({ messaging, vapidKey, backendUrl, authHeader, uid });
  } catch (error) {
    logWarn('Web push setup mislukt:', error?.message || error);
  }

  return () => {};
}
