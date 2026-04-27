/**
 * Attendance Model
 * Supports multiple punch in/out sessions per day
 */

class Attendance {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get all today's sessions for a user
   */
  async getTodaySessions(userId) {
    const today = new Date().toISOString().split('T')[0];

    const [rows] = await this.db.query(
      `SELECT * FROM attendance WHERE u_id = ? AND att_date = ? ORDER BY att_id ASC`,
      [userId, today]
    );

    return rows;
  }

  /**
   * Get active session (punched in but not out)
   */
  async getActiveSession(userId) {
    const today = new Date().toISOString().split('T')[0];

    const [rows] = await this.db.query(
      `SELECT * FROM attendance WHERE u_id = ? AND att_date = ? AND punch_in_time IS NOT NULL AND punch_out_time IS NULL ORDER BY att_id DESC LIMIT 1`,
      [userId, today]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Ensure 'forgot_logout' exists in status ENUM (runs once)
   */
  async ensureForgotLogoutEnum() {
    if (Attendance._enumFixed) return;
    try {
      await this.db.query(
        `ALTER TABLE attendance MODIFY COLUMN status ENUM('present','absent','halfday','leave','holiday','weekend','forgot_logout') DEFAULT 'present'`
      );
    } catch (e) {
      // Already has it or can't alter — ignore
    }
    Attendance._enumFixed = true;
  }

  /**
   * Ensure `is_late` boolean column exists on attendance.
   * Checks INFORMATION_SCHEMA first so we only ALTER when actually needed,
   * and surfaces real failures (e.g. permission errors) instead of swallowing them.
   */
  async ensureLateColumn() {
    if (Attendance._lateColumnFixed) return;
    try {
      const [cols] = await this.db.query(`SHOW COLUMNS FROM attendance LIKE 'is_late'`);
      if (cols.length === 0) {
        await this.db.query(
          `ALTER TABLE attendance ADD COLUMN is_late TINYINT(1) NOT NULL DEFAULT 0`
        );
        console.log('[LATE-MARK] added is_late column to attendance');
      }
      Attendance._lateColumnFixed = true;
    } catch (e) {
      console.error('[LATE-MARK] could not add is_late column:', e.message);
    }
  }

  /**
   * Make sure attendance_policies.type ENUM includes all 5 valid values.
   * Older schemas may have only ('full_day','half_day') — saving a 'late_mark'
   * policy on those would silently drop it, which is why no LATE flag ever appears.
   */
  async ensurePolicyTypeEnum() {
    if (Attendance._policyEnumFixed) return;
    try {
      await this.db.query(
        `ALTER TABLE attendance_policies
           MODIFY COLUMN type ENUM('full_day','half_day','late_mark','intime','week_off') NOT NULL`
      );
    } catch (e) { /* already correct or no permission */ }
    Attendance._policyEnumFixed = true;
  }

  /**
   * Build a map of `u_id -> Set(weekday)` (0 = Sunday … 6 = Saturday) from
   * active `week_off` policies. Per-user overrides in
   * `attendance_policy_user_week_offs` REPLACE the policy default for that user;
   * otherwise users inherit the union of week_offs across all active policies.
   */
  async getUserWeekOffMap() {
    const parseCsv = (csv) => {
      const set = new Set();
      if (!csv) return set;
      String(csv).split(',').forEach(d => {
        const n = parseInt(String(d).trim(), 10);
        if (!isNaN(n) && n >= 0 && n <= 6) set.add(n);
      });
      return set;
    };

    const [policies] = await this.db.query(
      `SELECT ap_id, week_offs FROM attendance_policies WHERE is_active = 1 AND type = 'week_off'`
    );

    // Default applied to every user that isn't explicitly overridden
    const defaultOff = new Set();
    for (const p of policies) parseCsv(p.week_offs).forEach(d => defaultOff.add(d));

    const [users] = await this.db.query(`SELECT u_id FROM users WHERE is_active = 1`);
    const map = {};
    for (const u of users) map[u.u_id] = new Set(defaultOff);

    // Per-user overrides — read once across all active policies.
    // Auto-create the override table on first use; absent tables would otherwise
    // throw and silently disable the week-off feature (we wrap callers in try/catch).
    if (!Attendance._uwoTableEnsured) {
      try {
        await this.db.query(
          `CREATE TABLE IF NOT EXISTS attendance_policy_user_week_offs (
             apuwo_id INT AUTO_INCREMENT PRIMARY KEY,
             ap_id INT NOT NULL,
             u_id INT NOT NULL,
             week_offs VARCHAR(50),
             is_active TINYINT(1) NOT NULL DEFAULT 1,
             created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
             updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
             UNIQUE KEY uniq_ap_user (ap_id, u_id),
             KEY idx_user (u_id)
           )`
        );
      } catch (e) { /* permission or already-exists — ignore */ }
      Attendance._uwoTableEnsured = true;
    }
    const [overrides] = await this.db.query(
      `SELECT u_id, week_offs FROM attendance_policy_user_week_offs WHERE is_active = 1`
    );
    for (const o of overrides) map[o.u_id] = parseCsv(o.week_offs);

    return map;
  }

  /**
   * Close any open sessions from previous days as 'forgot_logout'
   */
  async closeStaleSessions(userId) {
    const today = new Date().toISOString().split('T')[0];

    const [stale] = await this.db.query(
      `SELECT att_id, att_date, punch_in_time FROM attendance
       WHERE u_id = ? AND att_date < ? AND punch_in_time IS NOT NULL AND punch_out_time IS NULL`,
      [userId, today]
    );

    if (stale.length === 0) return 0;

    // Ensure ENUM is updated before using 'forgot_logout'
    await this.ensureForgotLogoutEnum();

    for (const session of stale) {
      const endOfDay = `${new Date(session.att_date).toISOString().split('T')[0]} 23:59:59`;
      await this.db.query(
        `UPDATE attendance SET
          punch_out_time = ?,
          total_hours = TIMESTAMPDIFF(SECOND, punch_in_time, ?) / 3600,
          status = 'forgot_logout'
         WHERE att_id = ?`,
        [endOfDay, endOfDay, session.att_id]
      );
    }

    return stale.length;
  }

  /**
   * Punch In — creates a new session
   */
  async punchIn(userId, data) {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Auto-close any open sessions from previous days as forgot_logout
    await this.closeStaleSessions(userId);

    // Check if there's already an active session today (punched in but not out)
    const active = await this.getActiveSession(userId);
    if (active) {
      throw new Error('Please punch out from current session first');
    }

    // Determine next session number for today
    const [[{ max_session }]] = await this.db.query(
      `SELECT COALESCE(MAX(session_no), 0) AS max_session FROM attendance WHERE u_id = ? AND att_date = ?`,
      [userId, today]
    );
    const nextSessionNo = (max_session || 0) + 1;

    const [result] = await this.db.query(
      `INSERT INTO attendance (u_id, att_date, session_no, punch_in_time, punch_in_image, punch_in_lat, punch_in_lng, punch_in_address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'present')`,
      [
        userId,
        today,
        nextSessionNo,
        now,
        data.image || null,
        data.lat || null,
        data.lng || null,
        data.address || null
      ]
    );

    // Late-mark enforcement — only on the first session of the day, since that's
    // the actual "arrival" event. Re-punches later in the day don't re-evaluate.
    // Prefer an active `late_mark` policy; fall back to `intime`.
    if (nextSessionNo === 1) {
      try {
        await this.ensureLateColumn();
        await this.ensurePolicyTypeEnum();
        const [policy] = await this.db.query(
          `SELECT type, threshold_time FROM attendance_policies
           WHERE is_active = 1 AND threshold_time IS NOT NULL
             AND type IN ('late_mark', 'intime')
           ORDER BY (type = 'late_mark') DESC, ap_id DESC
           LIMIT 1`
        );
        if (policy.length === 0 || !policy[0].threshold_time) {
          console.log(`[LATE-MARK] u_id=${userId} session=1 → no active late_mark/intime policy; is_late=0`);
        } else {
          await this.db.query(
            `UPDATE attendance SET is_late = (TIME(punch_in_time) > ?) WHERE att_id = ?`,
            [policy[0].threshold_time, result.insertId]
          );
          const [[row]] = await this.db.query(
            `SELECT TIME(punch_in_time) AS pin, is_late FROM attendance WHERE att_id = ?`,
            [result.insertId]
          );
          console.log(
            `[LATE-MARK] u_id=${userId} att_id=${result.insertId} policy=${policy[0].type} ` +
            `threshold=${policy[0].threshold_time} punched_at=${row?.pin} → is_late=${row?.is_late}`
          );
        }
      } catch (e) {
        console.error('[LATE-MARK] check failed:', e.message);
      }
    }

    return result.insertId;
  }

  /**
   * Punch Out — closes the active session
   */
  async punchOut(userId, data) {
    const now = new Date();

    const active = await this.getActiveSession(userId);

    if (!active) {
      throw new Error('Please punch in first');
    }

    // Calculate hours for this session
    const punchInTime = new Date(active.punch_in_time);
    const diffMs = now - punchInTime;
    const sessionHours = (diffMs / (1000 * 60 * 60)).toFixed(2);

    // First: close this session
    await this.db.query(
      `UPDATE attendance SET
        punch_out_time = ?,
        punch_out_image = ?,
        punch_out_lat = ?,
        punch_out_lng = ?,
        punch_out_address = ?,
        total_hours = ?
      WHERE att_id = ?`,
      [
        now,
        data.image || null,
        data.lat || null,
        data.lng || null,
        data.address || null,
        sessionHours,
        active.att_id
      ]
    );

    // Recompute day's total hours across ALL sessions (excluding forgot_logout)
    const today = active.att_date;
    const [[{ day_total }]] = await this.db.query(
      `SELECT COALESCE(SUM(total_hours), 0) AS day_total
       FROM attendance
       WHERE u_id = ? AND att_date = ? AND (status IS NULL OR status != 'forgot_logout')`,
      [userId, today]
    );

    // Load thresholds from attendance_policies
    const [policies] = await this.db.query(
      `SELECT type, threshold_hours FROM attendance_policies
       WHERE is_active = 1 AND type IN ('full_day','half_day')`
    );
    let fullDayHrs = 9;
    let halfDayHrs = 4;
    for (const p of policies) {
      if (p.type === 'full_day' && p.threshold_hours != null) fullDayHrs = Number(p.threshold_hours);
      if (p.type === 'half_day' && p.threshold_hours != null) halfDayHrs = Number(p.threshold_hours);
    }

    // Decide day status based on total hours
    let dayStatus;
    if (day_total >= fullDayHrs) dayStatus = 'present';
    else if (day_total >= halfDayHrs) dayStatus = 'halfday';
    else dayStatus = 'absent';

    // Apply same status to all of today's sessions (keep forgot_logout untouched)
    await this.db.query(
      `UPDATE attendance SET status = ?
       WHERE u_id = ? AND att_date = ? AND (status IS NULL OR status != 'forgot_logout')`,
      [dayStatus, userId, today]
    );

    return active.att_id;
  }

  /**
   * Get attendance history for a user (date range)
   */
  async getHistory(userId, startDate, endDate) {
    let query = `SELECT * FROM attendance WHERE u_id = ?`;
    const params = [userId];

    if (startDate && endDate) {
      query += ` AND att_date >= ? AND att_date <= ?`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY att_date DESC, att_id ASC LIMIT 100`;

    const [rows] = await this.db.query(query, params);
    return rows;
  }

  /**
   * Admin: Daily attendance records for ALL active users on a given date.
   * Returns per-user summary (first/last punch, totals, status) with nested sessions.
   */
  async getAdminDailyRecords(date) {
    const [users] = await this.db.query(
      `SELECT u.u_id, u.username, u.is_active, r.name AS role_name, r.slug AS role_slug
       FROM users u
       LEFT JOIN roles r ON u.r_id = r.r_id
       WHERE u.is_active = 1
       ORDER BY r.level ASC, u.username ASC`
    );

    const [rows] = await this.db.query(
      `SELECT * FROM attendance WHERE att_date = ? ORDER BY u_id, att_id ASC`,
      [date]
    );

    const sessionsByUser = {};
    for (const r of rows) {
      if (!sessionsByUser[r.u_id]) sessionsByUser[r.u_id] = [];
      sessionsByUser[r.u_id].push(r);
    }

    const records = users.map(u => {
      const sessions = sessionsByUser[u.u_id] || [];
      const first = sessions.find(s => s.punch_in_time) || null;
      const lastOut = [...sessions].reverse().find(s => s.punch_out_time) || null;
      const validHours = sessions
        .filter(s => s.status !== 'forgot_logout')
        .reduce((sum, s) => sum + (parseFloat(s.total_hours) || 0), 0);

      // Derive a single day-level status: prefer present > halfday > forgot_logout > absent
      let status = 'absent';
      if (sessions.some(s => s.status === 'present')) status = 'present';
      else if (sessions.some(s => s.status === 'halfday')) status = 'halfday';
      else if (sessions.some(s => s.status === 'forgot_logout')) status = 'forgot_logout';
      else if (sessions.some(s => s.status === 'leave')) status = 'leave';
      else if (sessions.length === 0) status = 'absent';

      return {
        u_id: u.u_id,
        username: u.username,
        role_name: u.role_name,
        role_slug: u.role_slug,
        first_punch_in: first?.punch_in_time
          ? new Date(first.punch_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
          : null,
        last_punch_out: lastOut?.punch_out_time
          ? new Date(lastOut.punch_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
          : null,
        total_hours: parseFloat(validHours.toFixed(2)),
        total_hours_fmt: validHours > 0
          ? `${Math.floor(validHours)}h ${Math.round((validHours % 1) * 60)}m`
          : null,
        total_sessions: sessions.length,
        // Day is "late" if the FIRST session was flagged at punch-in
        // (this matches first_punch_in shown next to it).
        is_late: !!first?.is_late,
        status,
        sessions: sessions.map(s => ({
          att_id: s.att_id,
          session_no: s.session_no,
          punch_in_time: s.punch_in_time
            ? new Date(s.punch_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
            : null,
          punch_out_time: s.punch_out_time
            ? new Date(s.punch_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
            : null,
          total_hours: s.total_hours
            ? `${Math.floor(s.total_hours)}h ${Math.round((s.total_hours % 1) * 60)}m`
            : null,
          punch_in_address: s.punch_in_address,
          punch_out_address: s.punch_out_address,
          is_late: !!s.is_late,
          status: s.status,
        })),
      };
    });

    // Week-off override: for users with no sessions on a day that matches their
    // week-off set, surface the day as 'weekend' instead of falling back to 'absent'.
    try {
      const weekOffMap = await this.getUserWeekOffMap();
      const dow = new Date(date).getDay();
      for (const r of records) {
        if (r.sessions.length === 0 && weekOffMap[r.u_id] && weekOffMap[r.u_id].has(dow)) {
          r.status = 'weekend';
        }
      }
    } catch (e) {
      console.error('[ATTENDANCE] week-off override failed:', e.message);
    }

    const summary = { present: 0, halfday: 0, absent: 0, leave: 0, forgot_logout: 0, holiday: 0, weekend: 0 };
    for (const r of records) summary[r.status] = (summary[r.status] || 0) + 1;

    return { summary, records };
  }

  /**
   * Admin: Monthly aggregated stats per user across a date range.
   */
  async getAdminMonthlySummary(startDate, endDate) {
    const [rows] = await this.db.query(
      `SELECT
          u.u_id,
          u.username,
          r.name AS role_name,
          r.slug AS role_slug,
          COUNT(DISTINCT CASE WHEN a.status = 'present' THEN a.att_date END) AS present_days,
          COUNT(DISTINCT CASE WHEN a.status = 'halfday' THEN a.att_date END) AS halfday_days,
          COUNT(DISTINCT CASE WHEN a.status = 'absent' THEN a.att_date END) AS absent_days,
          COUNT(DISTINCT CASE WHEN a.status = 'leave' THEN a.att_date END) AS leave_days,
          COUNT(DISTINCT CASE WHEN a.status = 'forgot_logout' THEN a.att_date END) AS forgot_logout_days,
          COALESCE(SUM(CASE WHEN a.status != 'forgot_logout' THEN a.total_hours ELSE 0 END), 0) AS total_hours,
          COALESCE(
            SUM(CASE WHEN a.status != 'forgot_logout' THEN a.total_hours ELSE 0 END) /
            NULLIF(COUNT(DISTINCT a.att_date), 0),
            0
          ) AS avg_hours
       FROM users u
       LEFT JOIN roles r ON u.r_id = r.r_id
       LEFT JOIN attendance a ON a.u_id = u.u_id AND a.att_date BETWEEN ? AND ?
       WHERE u.is_active = 1
       GROUP BY u.u_id, u.username, r.name, r.slug
       ORDER BY r.level ASC, u.username ASC`,
      [startDate, endDate]
    );

    // Weekend (week-off) day counts per user across the date range.
    // Counts only days where (a) the user's week-off applies AND (b) no
    // attendance row exists — i.e. the day was off and they didn't work.
    const weekendByUser = {};
    try {
      const weekOffMap = await this.getUserWeekOffMap();
      const [presence] = await this.db.query(
        `SELECT u_id, att_date FROM attendance
         WHERE att_date BETWEEN ? AND ?
         GROUP BY u_id, att_date`,
        [startDate, endDate]
      );
      const presenceByUser = {};
      for (const p of presence) {
        if (!presenceByUser[p.u_id]) presenceByUser[p.u_id] = new Set();
        presenceByUser[p.u_id].add(String(p.att_date).split('T')[0].slice(0, 10));
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      for (const u of Object.keys(weekOffMap)) {
        const offDays = weekOffMap[u];
        if (!offDays || offDays.size === 0) { weekendByUser[u] = 0; continue; }
        let count = 0;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (offDays.has(d.getDay())) {
            const key = d.toISOString().split('T')[0];
            if (!presenceByUser[u]?.has(key)) count++;
          }
        }
        weekendByUser[u] = count;
      }
    } catch (e) {
      console.error('[ATTENDANCE] weekend tally failed:', e.message);
    }

    return rows.map(r => ({
      u_id: r.u_id,
      username: r.username,
      role_name: r.role_name,
      role_slug: r.role_slug,
      present_days: Number(r.present_days) || 0,
      halfday_days: Number(r.halfday_days) || 0,
      absent_days: Number(r.absent_days) || 0,
      leave_days: Number(r.leave_days) || 0,
      forgot_logout_days: Number(r.forgot_logout_days) || 0,
      weekend_days: Number(weekendByUser[r.u_id]) || 0,
      total_hours: parseFloat(Number(r.total_hours).toFixed(2)) || 0,
      avg_hours: parseFloat(Number(r.avg_hours).toFixed(2)) || 0,
    }));
  }

  /**
   * Count week-off days for a single user across a date range.
   * Mirrors the logic used in getAdminMonthlySummary's weekend tally —
   * counts days that match the user's week-off set AND have no attendance row.
   */
  async countWeekendDaysForUser(userId, startDate, endDate) {
    if (!startDate || !endDate) return 0;
    try {
      const map = await this.getUserWeekOffMap();
      const offDays = map[userId];
      if (!offDays || offDays.size === 0) return 0;

      const [presence] = await this.db.query(
        `SELECT att_date FROM attendance
         WHERE u_id = ? AND att_date BETWEEN ? AND ?
         GROUP BY att_date`,
        [userId, startDate, endDate]
      );
      const presentSet = new Set(presence.map(r => String(r.att_date).slice(0, 10)));

      let count = 0;
      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (offDays.has(d.getDay())) {
          const key = d.toISOString().split('T')[0];
          if (!presentSet.has(key)) count++;
        }
      }
      return count;
    } catch (e) {
      console.error('[ATTENDANCE] countWeekendDaysForUser failed:', e.message);
      return 0;
    }
  }

  /**
   * Get stats for a user (date range)
   */
  async getStats(userId, startDate, endDate) {
    let query = `SELECT
        COUNT(DISTINCT att_date) as total_days,
        COUNT(DISTINCT CASE WHEN status = 'present' THEN att_date END) as present_days,
        COUNT(DISTINCT CASE WHEN status = 'absent' THEN att_date END) as absent_days,
        COUNT(DISTINCT CASE WHEN status = 'halfday' THEN att_date END) as halfday_days,
        COUNT(DISTINCT CASE WHEN status = 'leave' THEN att_date END) as leave_days,
        COUNT(DISTINCT CASE WHEN status = 'forgot_logout' THEN att_date END) as forgot_logout_days,
        SUM(IFNULL(total_hours, 0)) as total_hours,
        SUM(IFNULL(total_hours, 0)) / NULLIF(COUNT(DISTINCT att_date), 0) as avg_hours
      FROM attendance
      WHERE u_id = ?`;
    const params = [userId];

    if (startDate && endDate) {
      query += ` AND att_date >= ? AND att_date <= ?`;
      params.push(startDate, endDate);
    }

    const [rows] = await this.db.query(query, params);
    return rows[0];
  }
}

module.exports = Attendance;
