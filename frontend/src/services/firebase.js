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
} catch (e) {}

/**
 * Request notification permission and get FCM token
 */
export const requestNotificationPermission = async () => {
  try {
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: '',
    });

    return token;
  } catch (err) {
    return null;
  }
};

/**
 * Listen for foreground messages
 */
export const onForegroundMessage = (callback) => {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
};

export { messaging };
