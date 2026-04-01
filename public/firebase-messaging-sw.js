importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyC91LqqIw8z8NH7e1ChCKD3zUo_VXQeyRY",
  authDomain:        "pulse-messenger-3cb9d.firebaseapp.com",
  projectId:         "pulse-messenger-3cb9d",
  storageBucket:     "pulse-messenger-3cb9d.firebasestorage.app",
  messagingSenderId: "764605255111",
  appId:             "1:764605255111:web:7cecff60d89c64f08e5de2",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { icon } = payload.notification || {};
  self.registration.showNotification('Pulse', {
    body: 'Open Pulse om het bericht veilig te bekijken.',
    icon:  icon  || '/logo192.png',
    badge: '/logo192.png',
    data:  payload.data,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data    = event.notification.data || {};
  const convId  = data.convId;
  const origin  = self.location.origin;
  const url     = convId ? `${origin}/?convId=${convId}` : origin;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Als Pulse al open is in een tab → focus die tab en stuur postMessage
      for (const client of clientList) {
        if (client.url.startsWith(origin) && 'focus' in client) {
          if (convId) client.postMessage({ type: 'notification_click', convId });
          return client.focus();
        }
      }
      // Pulse is gesloten → open nieuwe tab op het juiste gesprek
      return clients.openWindow(url);
    })
  );
});
