/**
 * Dynamic Fields Controller
 * Unified CRUD for dropdown/master tables consumed by the
 * Dynamic Fields page on the frontend.
 *
 * Endpoint pattern:
 *   GET    /api/dynamic-fields/<type>
 *   POST   /api/dynamic-fields/<type>
 *   PUT    /api/dynamic-fields/<type>/:id
 *   DELETE /api/dynamic-fields/<type>/:id
 *   PATCH  /api/dynamic-fields/<type>/:id/toggle
 */

const response = require('../utils/response');

// Each entry declares:
//   table       — DB table name
//   idField     — primary key column
//   nameField   — required label column
//   fields      — other allowed columns (writable)
const TYPE_MAP = {
  'lead-sources': {
    table: 'lead_sources',
    idField: 'src_id',
    nameField: 'name',
    fields: ['color', 'icon', 'display_order'],
  },
  'lead-statuses': {
    table: 'lead_statuses',
    idField: 'ls_id',
    nameField: 'name',
    fields: ['color', 'display_order'],
  },
  'lead-priorities': {
    table: 'lead_priorities',
    idField: 'lp_id',
    nameField: 'name',
    fields: ['color', 'display_order'],
  },
  'projects': {
    table: 'projects',
    idField: 'project_id',
    nameField: 'name',
    fields: ['developer', 'location'],
  },
  'service-types': {
    table: 'service_types',
    idField: 'st_id',
    nameField: 'name',
    fields: ['display_order'],
  },
  'property-types': {
    table: 'property_types',
    idField: 'pt_id',
    nameField: 'name',
    fields: ['display_order'],
  },
  'configurations': {
    table: 'property_configurations',
    idField: 'pc_id',
    nameField: 'name',
    fields: ['display_order'],
  },
  'attendance-policies': {
    table: 'attendance_policies',
    idField: 'ap_id',
    nameField: 'title',
    fields: ['type', 'threshold_hours', 'threshold_minutes', 'threshold_time', 'color', 'week_offs'],
  },
};

const getConfig = (type) => TYPE_MAP[type] || null;

// Attendance-policy type enum mirrors backend/controllers/attendancePolicyController.js
const VALID_ATTENDANCE_TYPES = ['full_day', 'half_day', 'late_mark', 'intime', 'week_off'];

/**
 * Recompute `is_late` across the ENTIRE attendance table using the currently
 * best late_mark/intime policy. Called whenever a late_mark/intime policy is
 * created, updated, or toggled. Past sessions are re-flagged too — late means
 * late, regardless of when it was logged or which session number it was.
 *
 * Mirrors the policy-selection rule in Attendance.punchIn (late_mark wins,
 * else intime; latest ap_id breaks ties). If no usable policy exists, every
 * is_late flag is cleared to 0.
 */
const reapplyLateMarkToToday = async (db) => {
  try {
    // Make sure the column exists before we touch it. Use SHOW COLUMNS so we
    // only ALTER when truly missing (older MySQL has no IF NOT EXISTS for ADD COLUMN).
    const [cols] = await db.query(`SHOW COLUMNS FROM attendance LIKE 'is_late'`);
    if (cols.length === 0) {
      try {
        await db.query(`ALTER TABLE attendance ADD COLUMN is_late TINYINT(1) NOT NULL DEFAULT 0`);
      } catch (e) {
        console.error('[LATE-MARK] backfill: could not add is_late column:', e.message);
      }
    }

    const [policy] = await db.query(
      `SELECT type, threshold_time FROM attendance_policies
       WHERE is_active = 1 AND threshold_time IS NOT NULL
         AND type IN ('late_mark', 'intime')
       ORDER BY (type = 'late_mark') DESC, ap_id DESC
       LIMIT 1`
    );

    if (policy.length === 0 || !policy[0].threshold_time) {
      const [r] = await db.query(
        `UPDATE attendance SET is_late = 0
         WHERE session_no = 1 AND punch_in_time IS NOT NULL`
      );
      console.log(`[LATE-MARK] backfill: cleared ${r.affectedRows} first-session rows (no active policy)`);
    } else {
      const [r] = await db.query(
        `UPDATE attendance SET is_late = (TIME(punch_in_time) > ?)
         WHERE session_no = 1 AND punch_in_time IS NOT NULL`,
        [policy[0].threshold_time]
      );
      console.log(
        `[LATE-MARK] backfill: applied policy=${policy[0].type} ` +
        `threshold=${policy[0].threshold_time} to ${r.affectedRows} first-session rows ` +
        `across all dates`
      );
    }
  } catch (err) {
    console.error('[LATE-MARK] backfill failed:', err.message);
  }
};

/**
 * Type-specific validation for attendance-policies. Returns an error string
 * (sent as 400) or null when the payload is OK.
 *
 * @param {object} db        — req.db pool
 * @param {object} body      — incoming payload (already merged with existing on update)
 * @param {string|null} forId — pass the ap_id when updating so we exclude self from the duplicate check
 */
const validateAttendancePolicy = async (db, body, forId = null) => {
  if (body.type !== undefined && !VALID_ATTENDANCE_TYPES.includes(body.type)) {
    return `type must be one of: ${VALID_ATTENDANCE_TYPES.join(', ')}`;
  }

  // (title, type) must be unique among active rows
  if (body.title && body.type) {
    const params = [String(body.title).trim(), body.type];
    let sql = `SELECT ap_id FROM attendance_policies
               WHERE LOWER(title) = LOWER(?) AND type = ? AND is_active = 1`;
    if (forId) { sql += ` AND ap_id != ?`; params.push(forId); }
    sql += ` LIMIT 1`;
    const [rows] = await db.query(sql, params);
    if (rows.length > 0) return 'A policy with this title and type already exists';
  }
  return null;
};

const pickWritable = (body, cfg) => {
  const out = {};
  const allowed = [cfg.nameField, ...cfg.fields];
  for (const key of allowed) {
    if (body[key] !== undefined && body[key] !== '') out[key] = body[key];
  }
  return out;
};

const list = async (req, res) => {
  try {
    const cfg = getConfig(req.params.type);
    if (!cfg) return response.error(res, 'Unknown dynamic field type', 404);

    const [rows] = await req.db.query(
      `SELECT * FROM \`${cfg.table}\` ORDER BY ${cfg.fields.includes('display_order') ? 'display_order ASC, ' : ''}${cfg.idField} ASC`
    );
    return response.success(res, 'Fetched', rows);
  } catch (err) {
    console.error('DynamicFields list error:', err);
    return response.serverError(res, err);
  }
};

const create = async (req, res) => {
  try {
    const cfg = getConfig(req.params.type);
    if (!cfg) return response.error(res, 'Unknown dynamic field type', 404);

    const data = pickWritable(req.body, cfg);
    if (!data[cfg.nameField]) return response.error(res, `${cfg.nameField} is required`);

    if (req.params.type === 'attendance-policies') {
      if (!data.type) return response.error(res, 'type is required for attendance policies');
      // Widen the ENUM defensively in case the existing schema only had
      // ('full_day','half_day') — otherwise saving 'late_mark' silently inserts ''.
      try {
        await req.db.query(
          `ALTER TABLE attendance_policies
             MODIFY COLUMN type ENUM('full_day','half_day','late_mark','intime','week_off') NOT NULL`
        );
      } catch (e) { /* already correct or no permission — ignore */ }
      const err = await validateAttendancePolicy(req.db, data);
      if (err) return response.error(res, err);
    }

    const cols = Object.keys(data);
    const placeholders = cols.map(() => '?').join(', ');
    const values = cols.map(c => data[c]);

    const [result] = await req.db.query(
      `INSERT INTO \`${cfg.table}\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`,
      values
    );

    const [rows] = await req.db.query(
      `SELECT * FROM \`${cfg.table}\` WHERE ${cfg.idField} = ?`,
      [result.insertId]
    );

    // Re-flag today's first sessions whenever a late_mark/intime policy lands
    if (req.params.type === 'attendance-policies' &&
        (data.type === 'late_mark' || data.type === 'intime')) {
      await reapplyLateMarkToToday(req.db);
    }

    return response.success(res, 'Created', rows[0], 201);
  } catch (err) {
    console.error('DynamicFields create error:', err);
    return response.serverError(res, err);
  }
};

const update = async (req, res) => {
  try {
    const cfg = getConfig(req.params.type);
    if (!cfg) return response.error(res, 'Unknown dynamic field type', 404);

    const data = pickWritable(req.body, cfg);
    const cols = Object.keys(data);
    if (cols.length === 0) return response.error(res, 'No updatable fields provided');

    if (req.params.type === 'attendance-policies') {
      // Merge with existing row so the duplicate check sees the final (title, type) combo
      const [existing] = await req.db.query(
        `SELECT title, type FROM attendance_policies WHERE ap_id = ? LIMIT 1`,
        [req.params.id]
      );
      if (existing.length === 0) return response.error(res, 'Not found', 404);
      const merged = {
        title: data.title !== undefined ? data.title : existing[0].title,
        type: data.type !== undefined ? data.type : existing[0].type,
      };
      const err = await validateAttendancePolicy(req.db, merged, req.params.id);
      if (err) return response.error(res, err);
    }

    const setClause = cols.map(c => `\`${c}\` = ?`).join(', ');
    const values = cols.map(c => data[c]);
    values.push(req.params.id);

    const [result] = await req.db.query(
      `UPDATE \`${cfg.table}\` SET ${setClause} WHERE ${cfg.idField} = ?`,
      values
    );

    if (result.affectedRows === 0) return response.error(res, 'Not found', 404);

    const [rows] = await req.db.query(
      `SELECT * FROM \`${cfg.table}\` WHERE ${cfg.idField} = ?`,
      [req.params.id]
    );

    // Re-flag today's first sessions when a late_mark/intime policy was changed
    // (or a different-type policy was switched into late_mark/intime).
    if (req.params.type === 'attendance-policies') {
      const finalType = rows[0]?.type;
      if (finalType === 'late_mark' || finalType === 'intime') {
        await reapplyLateMarkToToday(req.db);
      }
    }

    return response.success(res, 'Updated', rows[0]);
  } catch (err) {
    console.error('DynamicFields update error:', err);
    return response.serverError(res, err);
  }
};

const remove = async (req, res) => {
  try {
    const cfg = getConfig(req.params.type);
    if (!cfg) return response.error(res, 'Unknown dynamic field type', 404);

    const [result] = await req.db.query(
      `DELETE FROM \`${cfg.table}\` WHERE ${cfg.idField} = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) return response.error(res, 'Not found', 404);
    return response.success(res, 'Deleted');
  } catch (err) {
    console.error('DynamicFields delete error:', err);
    // Most likely FK constraint — return a friendlier message
    if (err && (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451)) {
      return response.error(res, 'Cannot delete — this item is used by existing records. Deactivate it instead.', 409);
    }
    return response.serverError(res, err);
  }
};

const toggle = async (req, res) => {
  try {
    const cfg = getConfig(req.params.type);
    if (!cfg) return response.error(res, 'Unknown dynamic field type', 404);

    const [rows] = await req.db.query(
      `SELECT is_active FROM \`${cfg.table}\` WHERE ${cfg.idField} = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return response.error(res, 'Not found', 404);

    const next = rows[0].is_active ? 0 : 1;
    await req.db.query(
      `UPDATE \`${cfg.table}\` SET is_active = ? WHERE ${cfg.idField} = ?`,
      [next, req.params.id]
    );

    // Toggling a late_mark/intime policy on/off changes which policy "wins"
    // for today, so reapply the flag.
    if (req.params.type === 'attendance-policies') {
      const [[row]] = await req.db.query(
        `SELECT type FROM attendance_policies WHERE ap_id = ?`,
        [req.params.id]
      );
      if (row && (row.type === 'late_mark' || row.type === 'intime')) {
        await reapplyLateMarkToToday(req.db);
      }
    }

    return response.success(res, 'Toggled', { is_active: next });
  } catch (err) {
    console.error('DynamicFields toggle error:', err);
    return response.serverError(res, err);
  }
};

module.exports = { list, create, update, remove, toggle };
