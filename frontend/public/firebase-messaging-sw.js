/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAUAZd6ZJSJLHFS_HLRZxZe9FKZ-mdB3eI',
  authDomain: 'rabs-connect-lite.firebaseapp.com',
  projectId: 'rabs-connect-lite',
  storageBucket: 'rabs-connect-lite.appspot.com',
  messagingSenderId: '344010736193',
  appId: '1:344010736193:web:rabsconnect',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message:', payload);
  const { title, body } = payload.notification || {};
  if (title) {
    self.registration.showNotification(title, {
      body: body || '',
      icon: '/logo192.png',
      badge: '/logo192.png',
      data: payload.data,
    });
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new tab
      if (data.lead_id) {
        return clients.openWindow('/leads');
      }
      return clients.openWindow('/');
    })
  );
});
