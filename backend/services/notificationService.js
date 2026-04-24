// ============================================================================
// NOTIFICATION SERVICE
// Sends FCM push notifications via Firebase Admin SDK
// ============================================================================

const admin = require('../config/firebase');

/**
 * Send a push notification to a single device
 * @param {string} deviceToken - FCM token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Data payload (key-value pairs, all strings)
 * @returns {Promise<boolean>} - true if sent successfully
 */
const sendNotification = async (deviceToken, title, body, data = {}) => {
  if (!deviceToken) {
    console.log('[NOTIFY] No device token, skipping');
    return false;
  }

  // Check if Firebase is initialized
  if (!admin.apps?.length) {
    console.log('[NOTIFY] Firebase not initialized, skipping notification');
    return false;
  }

  try {
    // Pick channel based on notification type
    const channelId = (data.type === 'lead_assigned' || data.type === 'followup_scheduled')
      ? 'lead_updates'
      : 'followup_reminders';

    const message = {
      token: deviceToken,
      notification: {
        title,
        body,
      },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId,
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('[NOTIFY] Sent successfully:', response);
    return true;
  } catch (error) {
    console.error('[NOTIFY] Send error:', error.code, error.message);

    // Invalid token - should be cleared
    if (
      error.code === 'messaging/registration-token-not-registered' ||
      error.code === 'messaging/invalid-registration-token'
    ) {
      console.log('[NOTIFY] Invalid token, should be cleared');
    }

    return false;
  }
};

/**
 * Send notification to multiple devices
 */
const sendMultipleNotifications = async (tokens, title, body, data = {}) => {
  const results = await Promise.allSettled(
    tokens.map(token => sendNotification(token, title, body, data))
  );
  return results;
};

/**
 * Store notification in DB for a user (in-app notification)
 * @param {object} db - Database pool
 * @param {number} userId - Target user ID
 * @param {string} type - Notification type (lead, followup, call, alert, etc.)
 * @param {string} title - Notification title
 * @param {string} body - Notification message
 * @param {object} data - Extra data (lead_id, etc.)
 */
const storeNotification = async (db, userId, type, title, body, data = {}) => {
  try {
    await db.execute(
      `INSERT INTO notifications (u_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)`,
      [userId, type, title, body, JSON.stringify(data)]
    );
  } catch (err) {
    console.error('[NOTIFY] Store notification error:', err.message);
  }
};

/**
 * Send push + store in-app notification for multiple users
 */
const notifyUsers = async (db, users, type, title, body, data = {}) => {
  for (const user of users) {
    // Store in-app notification
    storeNotification(db, user.u_id, type, title, body, data);
    // Send push notification
    if (user.device_token) {
      sendNotification(user.device_token, title, body, data).catch(() => {});
    }
  }
};

module.exports = {
  sendNotification,
  sendMultipleNotifications,
  storeNotification,
  notifyUsers,
};
