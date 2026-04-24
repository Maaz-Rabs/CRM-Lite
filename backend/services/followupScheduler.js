// ============================================================================
// FOLLOWUP REMINDER SCHEDULER
// Runs every minute, checks for upcoming/missed followups based on
// configurable reminder settings (before, on-time, after missed)
// ============================================================================

const cron = require('node-cron');
const { getPool } = require('../config/database');
const { sendNotification, storeNotification } = require('./notificationService');

/**
 * Get list of client databases to scan
 */
function getClientDatabases() {
  if (process.env.CLIENT_DBS) {
    return process.env.CLIENT_DBS.split(',').map(s => s.trim()).filter(Boolean);
  }
  const defaultDb = process.env.DB_NAME || 'rabsconnect_aarohan';
  return [defaultDb];
}

/**
 * Get active reminder settings from DB
 */
async function getReminderSettings(db) {
  try {
    const [rows] = await db.query(
      'SELECT frs_id, label, minutes_offset FROM followup_reminder_settings WHERE is_active = 1 ORDER BY minutes_offset ASC'
    );
    return rows;
  } catch (err) {
    // Table might not exist yet — fallback to default behavior
    console.log('[CRON] Reminder settings table not found, using defaults');
    return [
      { frs_id: 0, label: '10 minutes before', minutes_offset: -10 },
    ];
  }
}

/**
 * Check a single client database for followups that need reminders
 */
async function checkFollowupsForDb(dbName) {
  try {
    const db = getPool(dbName);

    // 1. Get configured reminder settings
    const settings = await getReminderSettings(db);
    if (settings.length === 0) return;

    // 2. Get all active pending followups with user tokens
    //    We fetch followups in a broad window: from 30 min ago to 30 min ahead
    const [followups] = await db.query(`
      SELECT
        lf.lf_id,
        lf.l_id,
        lf.u_id,
        lf.followup_dt,
        lf.note,
        lf.reminders_sent,
        l.name AS lead_name,
        l.mobile AS lead_mobile,
        u.device_token,
        u.device_platform
      FROM lead_followups lf
      JOIN leads l ON lf.l_id = l.l_id
      JOIN users u ON lf.u_id = u.u_id
      WHERE lf.status = 'pending'
        AND lf.is_active = 1
        AND lf.followup_dt BETWEEN DATE_SUB(NOW(), INTERVAL 30 MINUTE) AND DATE_ADD(NOW(), INTERVAL 30 MINUTE)
        AND u.device_token IS NOT NULL
        AND u.device_token != ''
        AND u.is_active = 1
    `);

    if (followups.length === 0) return;

    for (const fu of followups) {
      const sentIds = (fu.reminders_sent || '').split(',').filter(Boolean);
      const followupTime = new Date(fu.followup_dt);
      const now = new Date();
      const diffMinutes = (followupTime - now) / 60000; // positive = future, negative = past

      for (const setting of settings) {
        const settingIdStr = String(setting.frs_id);

        // Skip if already sent this reminder
        if (sentIds.includes(settingIdStr)) continue;

        // Check if this reminder should fire now
        // For offset -15 (15 min before): fires when diffMinutes <= 15 (i.e. we're within 15 min)
        // For offset 0 (on time): fires when diffMinutes <= 0
        // For offset +10 (10 min after): fires when diffMinutes <= -10
        const shouldFire = diffMinutes <= -setting.minutes_offset;

        if (!shouldFire) continue;

        // Build notification message
        const timeStr = followupTime.toLocaleString('en-IN', {
          hour: '2-digit', minute: '2-digit', hour12: true,
        });

        let title, body;
        if (setting.minutes_offset < 0) {
          title = 'Follow-up Reminder';
          body = `Upcoming follow-up with ${fu.lead_name || 'Lead'} at ${timeStr}`;
        } else if (setting.minutes_offset === 0) {
          title = 'Follow-up Now!';
          body = `Follow-up with ${fu.lead_name || 'Lead'} is due now`;
        } else {
          title = 'Missed Follow-up!';
          body = `You missed a follow-up with ${fu.lead_name || 'Lead'} (was at ${timeStr})`;
        }

        if (fu.note) {
          body += ` - ${fu.note}`;
        }

        const data = {
          type: 'followup_reminder',
          lead_id: String(fu.l_id),
          followup_id: String(fu.lf_id),
        };

        // Store in-app notification
        storeNotification(db, fu.u_id, 'followup', title, body, { lead_id: String(fu.l_id) });

        // Send push notification
        await sendNotification(fu.device_token, title, body, data);

        // Mark this reminder as sent
        sentIds.push(settingIdStr);
        await db.query(
          'UPDATE lead_followups SET reminders_sent = ? WHERE lf_id = ?',
          [sentIds.join(','), fu.lf_id]
        );

        console.log(`[CRON] ${dbName}: Sent "${setting.label}" reminder for followup ${fu.lf_id} (lead: ${fu.lead_name})`);
      }
    }
  } catch (error) {
    console.error(`[CRON] Error checking followups for ${dbName}:`, error.message);
  }
}

/**
 * Main cron function - checks all client databases
 */
async function checkAllFollowups() {
  const databases = getClientDatabases();
  for (const dbName of databases) {
    await checkFollowupsForDb(dbName);
  }
}

/**
 * Start the followup reminder cron scheduler
 */
function startFollowupScheduler() {
  console.log('[CRON] Starting followup reminder scheduler (every minute)');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      await checkAllFollowups();
    } catch (error) {
      console.error('[CRON] Scheduler error:', error.message);
    }
  });

  // Run once on startup after a short delay
  setTimeout(() => {
    checkAllFollowups().catch(err => {
      console.error('[CRON] Initial check error:', err.message);
    });
  }, 10000);
}

module.exports = { startFollowupScheduler };
