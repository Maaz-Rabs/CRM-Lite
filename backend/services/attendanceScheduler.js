// ============================================================================
// ATTENDANCE SCHEDULER
// Runs at 11:59 PM daily — auto-closes open sessions as "forgot_logout"
// ============================================================================

const cron = require('node-cron');
const { getPool } = require('../config/database');

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
 * Close all open sessions (punched in but never punched out) for a given date
 * Sets status = 'forgot_logout', punch_out_time = end of that day (23:59:59)
 */
async function closeOpenSessions(db, dateStr) {
  try {
    // Find all open sessions for the date
    const [openSessions] = await db.query(
      `SELECT att_id, u_id, punch_in_time FROM attendance
       WHERE att_date = ? AND punch_in_time IS NOT NULL AND punch_out_time IS NULL`,
      [dateStr]
    );

    if (openSessions.length === 0) return 0;

    // Ensure ENUM has 'forgot_logout'
    try {
      await db.query(`ALTER TABLE attendance MODIFY COLUMN status ENUM('present','absent','halfday','leave','holiday','weekend','forgot_logout') DEFAULT 'present'`);
    } catch (e) { /* already done */ }

    // Close each session
    const endOfDay = `${dateStr} 23:59:59`;

    const [result] = await db.query(
      `UPDATE attendance SET
        punch_out_time = ?,
        total_hours = TIMESTAMPDIFF(SECOND, punch_in_time, ?) / 3600,
        status = 'forgot_logout'
       WHERE att_date = ? AND punch_in_time IS NOT NULL AND punch_out_time IS NULL`,
      [endOfDay, endOfDay, dateStr]
    );

    return result.affectedRows || 0;
  } catch (err) {
    console.error(`[ATTENDANCE CRON] Error closing sessions for ${dateStr}:`, err.message);
    return 0;
  }
}

/**
 * Process all client databases
 */
async function processAllDatabases() {
  const databases = getClientDatabases();

  for (const dbName of databases) {
    try {
      const pool = getPool(dbName);
      const today = new Date().toISOString().split('T')[0];

      const closed = await closeOpenSessions(pool, today);

      if (closed > 0) {
        console.log(`[ATTENDANCE CRON] [${dbName}] Closed ${closed} open session(s) as forgot_logout`);
      }
    } catch (err) {
      console.error(`[ATTENDANCE CRON] [${dbName}] Error:`, err.message);
    }
  }
}

/**
 * Start the attendance scheduler
 */
function startAttendanceScheduler() {
  console.log('[CRON] Starting attendance scheduler (daily at 11:59 PM)');

  // Run at 11:59 PM every day
  cron.schedule('59 23 * * *', async () => {
    try {
      console.log('[ATTENDANCE CRON] Running end-of-day session cleanup...');
      await processAllDatabases();
    } catch (error) {
      console.error('[ATTENDANCE CRON] Scheduler error:', error.message);
    }
  });
}

module.exports = { startAttendanceScheduler };
