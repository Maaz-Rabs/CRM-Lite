// ============================================================================
// ATTENDANCE POLICY MODEL
// Database operations for attendance_policies table
// Columns: ap_id, title, type (enum), threshold_hours, threshold_minutes,
//          threshold_time, color, is_active, created_at, updated_at
// ============================================================================

const TABLE_NAME = 'attendance_policies';
const PK_COLUMN = 'ap_id';

/**
 * Get all active attendance policies
 */
const getAll = async (db) => {
  const [rows] = await db.execute(
    `SELECT ${PK_COLUMN}, title, type, threshold_hours, threshold_minutes,
       threshold_time, color, week_offs, is_active, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE is_active = 1
     ORDER BY created_at DESC`
  );
  return rows;
};

/**
 * Get single attendance policy by ID
 */
const getById = async (db, apId) => {
  const [rows] = await db.execute(
    `SELECT ${PK_COLUMN}, title, type, threshold_hours, threshold_minutes,
       threshold_time, color, week_offs, is_active
     FROM ${TABLE_NAME} WHERE ${PK_COLUMN} = ?`,
    [apId]
  );
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Check duplicate by title + type combo
 */
const getByTitleAndType = async (db, title, type) => {
  const [rows] = await db.execute(
    `SELECT ${PK_COLUMN}, title, type FROM ${TABLE_NAME}
     WHERE LOWER(title) = LOWER(?) AND type = ? AND is_active = 1`,
    [title.trim(), type]
  );
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Create new attendance policy
 */
const create = async (db, data) => {
  const [result] = await db.execute(
    `INSERT INTO ${TABLE_NAME}
       (title, type, threshold_hours, threshold_minutes, threshold_time, color, week_offs, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      data.title.trim(),
      data.type,
      data.threshold_hours ?? null,
      data.threshold_minutes ?? null,
      data.threshold_time || null,
      data.color || null,
      data.week_offs || null,
    ]
  );
  return result.insertId;
};

/**
 * Update attendance policy
 */
const update = async (db, apId, data) => {
  const fields = [];
  const values = [];

  const fieldMap = {
    title: (v) => v.trim(),
    type: (v) => v,
    threshold_hours: (v) => v,
    threshold_minutes: (v) => v,
    threshold_time: (v) => v,
    color: (v) => v,
    week_offs: (v) => v,
    is_active: (v) => v ? 1 : 0,
  };

  for (const [key, transform] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(transform(data[key]));
    }
  }

  if (fields.length === 0) return false;

  values.push(apId);
  const [result] = await db.execute(
    `UPDATE ${TABLE_NAME} SET ${fields.join(', ')} WHERE ${PK_COLUMN} = ?`,
    values
  );
  return result.affectedRows > 0;
};

/**
 * Soft delete (set is_active = 0)
 */
const softDelete = async (db, apId) => {
  const [result] = await db.execute(
    `UPDATE ${TABLE_NAME} SET is_active = 0 WHERE ${PK_COLUMN} = ?`,
    [apId]
  );
  return result.affectedRows > 0;
};

module.exports = {
  getAll,
  getById,
  getByTitleAndType,
  create,
  update,
  softDelete,
};
