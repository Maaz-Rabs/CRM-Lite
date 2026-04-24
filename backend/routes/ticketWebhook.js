const express = require('express');
const router = express.Router();
const response = require('../utils/response');
const {sendNotification, storeNotification} = require('../services/notificationService');
const {getDefaultPool} = require('../config/database');

// Background processor — don't block the HTTP response
const processInBackground = (fn) => {
  setImmediate(async () => {
    try { await fn(); } catch (e) { console.error('[TICKET-WEBHOOK] Background error:', e.message); }
  });
};

/**
 * Webhook: Ticket Reply Notification
 * POST /api/ticket-webhook/reply
 */
router.post('/reply', (req, res) => {
  console.log('[TICKET-WEBHOOK] ✅ /reply HIT — body:', JSON.stringify(req.body));

  const {ticket_id, ticket_title, message, client_code, user_id, user_email, replied_by} = req.body;

  if (!ticket_id || !client_code) {
    console.log('[TICKET-WEBHOOK] ❌ /reply — missing ticket_id or client_code');
    return response.error(res, 'ticket_id and client_code are required', 400);
  }

  // Respond immediately
  res.json({success: true, message: 'Webhook received'});

  // Process notification in background
  processInBackground(async () => {
    const db = getDefaultPool();
    if (!db) return;

    let targetUsers = [];
    if (user_id) {
      const [rows] = await db.query('SELECT u_id, username, email, device_token FROM users WHERE u_id = ? AND is_active = 1', [user_id]);
      targetUsers = rows;
    } else if (user_email) {
      const [rows] = await db.query('SELECT u_id, username, email, device_token FROM users WHERE LOWER(email) = ? AND is_active = 1', [user_email.toLowerCase()]);
      targetUsers = rows;
    }

    if (targetUsers.length === 0) {
      const [rows] = await db.query(
        `SELECT u.u_id, u.username, u.email, u.device_token FROM users u JOIN roles r ON u.r_id = r.r_id WHERE r.level <= 2 AND u.is_active = 1 AND u.device_token IS NOT NULL`
      );
      targetUsers = rows;
    }

    const title = '💬 Ticket Reply';
    const body = `${replied_by || 'Support'} replied to: ${ticket_title || `#${ticket_id}`}`;
    const preview = message ? (message.length > 80 ? message.slice(0, 80) + '...' : message) : '';
    const notifBody = preview ? `${body}\n"${preview}"` : body;

    for (const user of targetUsers) {
      storeNotification(db, user.u_id, 'ticket', title, notifBody, {ticket_id: String(ticket_id), type: 'ticket_reply'}).catch(() => {});
      if (user.device_token) {
        sendNotification(user.device_token, title, notifBody, {type: 'ticket_reply', ticket_id: String(ticket_id)}).catch(() => {});
      }
    }
    console.log(`[TICKET-WEBHOOK] Reply: notified ${targetUsers.length} users for ticket #${ticket_id}`);
  });
});

/**
 * Webhook: Ticket Status Changed
 * POST /api/ticket-webhook/status
 */
router.post('/status', (req, res) => {
  console.log('[TICKET-WEBHOOK] ✅ /status HIT — body:', JSON.stringify(req.body));

  const {ticket_id, ticket_title, new_status, client_code, user_id, user_email} = req.body;

  if (!ticket_id || !client_code) {
    console.log('[TICKET-WEBHOOK] ❌ /status — missing ticket_id or client_code');
    return response.error(res, 'ticket_id and client_code are required', 400);
  }

  // Respond immediately
  res.json({success: true, message: 'Webhook received'});

  // Process notification in background
  processInBackground(async () => {
    const db = getDefaultPool();
    if (!db) return;

    let targetUsers = [];
    if (user_id) {
      const [rows] = await db.query('SELECT u_id, username, email, device_token FROM users WHERE u_id = ? AND is_active = 1', [user_id]);
      targetUsers = rows;
    } else if (user_email) {
      const [rows] = await db.query('SELECT u_id, username, email, device_token FROM users WHERE LOWER(email) = ? AND is_active = 1', [user_email.toLowerCase()]);
      targetUsers = rows;
    }

    const statusLabel = {
      resolved: '✅ Resolved', closed: '🔒 Closed', in_progress: '🔄 In Progress', reopened: '🔁 Reopened',
    }[String(new_status).toLowerCase()] || new_status;

    const title = `Ticket ${statusLabel}`;
    const body = `Your ticket "${ticket_title || `#${ticket_id}`}" is now ${statusLabel}`;

    for (const user of targetUsers) {
      storeNotification(db, user.u_id, 'ticket', title, body, {ticket_id: String(ticket_id), type: 'ticket_status'}).catch(() => {});
      if (user.device_token) {
        sendNotification(user.device_token, title, body, {type: 'ticket_status', ticket_id: String(ticket_id)}).catch(() => {});
      }
    }
    console.log(`[TICKET-WEBHOOK] Status: notified ${targetUsers.length} users for ticket #${ticket_id} → ${new_status}`);
  });
});

module.exports = router;
