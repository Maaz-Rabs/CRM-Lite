import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyAUAZd6ZJSJLHFS_HLRZxZe9FKZ-mdB3eI',
  authDomain: 'rabs-connect-lite.firebaseapp.com',
  projectId: 'rabs-connect-lite',
  storageBucket: 'rabs-connect-lite.appspot.com',
  messagingSenderId: '344010736193',
  appId: '1:344010736193:web:rabsconnect',
};

const app = initializeApp(firebaseConfig);

let messaging = null;
try {
  messaging = getMessaging(app);
} catch (e) {
  console.log('[FCM] Messaging not supported in this browser');
}

/**
 * Request notification permission and get FCM token
 */
export const requestNotificationPermission = async () => {
  try {
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM] Permission denied');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: '', // Add VAPID key from Firebase console if needed
    });

    console.log('[FCM] Token:', token?.substring(0, 20) + '...');
    return token;
  } catch (err) {
    console.log('[FCM] Token error:', err);
    return null;
  }
};

/**
 * Listen for foreground messages
 */
export const onForegroundMessage = (callback) => {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    console.log('[FCM] Foreground message:', payload);
    callback(payload);
  });
};

export { messaging };
