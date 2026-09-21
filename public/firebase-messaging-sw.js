importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "__PULSE_FIREBASE_API_KEY__",
  authDomain:        "__PULSE_FIREBASE_AUTH_DOMAIN__",
  projectId:         "__PULSE_FIREBASE_PROJECT_ID__",
  storageBucket:     "__PULSE_FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__PULSE_FIREBASE_MESSAGING_SENDER_ID__",
  appId:             "__PULSE_FIREBASE_APP_ID__",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { icon, title, body } = payload.notification || {};
  const data = payload.data || {};
  const defaultBody = 'Open Pulse om het bericht veilig te bekijken.';

  self.registration.showNotification(title || data.title || 'Pulse', {
    body: body || data.body || defaultBody,
    icon:  icon  || '/logo192.png',
    badge: '/logo192.png',
    data,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data    = event.notification.data || {};
  const convId  = data.convId;
  const origin  = self.location.origin;
  const url = convId ? `${origin}/?convId=${convId}` : origin;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Als Pulse al open is in een tab → focus die tab en stuur postMessage
      for (const client of clientList) {
        if (client.url.startsWith(origin) && 'focus' in client) {
          client.postMessage({
            type: 'notification_click',
            convId: convId || '',
            notificationType: data.type || '',
          });
          return client.focus();
        }
      }
      // Pulse is gesloten → open nieuwe tab op het juiste gesprek
      return clients.openWindow(url);
    })
  );
});
