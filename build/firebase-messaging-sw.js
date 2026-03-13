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
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'Pulse', {
    body:  body  || 'Nieuw bericht',
    icon:  icon  || '/logo192.png',
    badge: '/logo192.png',
    data:  payload.data,
  });
});
