// ============================================================================
// LEAD STATUS MODEL
// Database operations for lead_statuses table
// 
// SCHEMA COMPATIBILITY:
// - New schema: lead_statuses table with ls_id
// - Old schema: crm_lead_status table with ls_id
// 
// Change TABLE_NAME below if needed
// ============================================================================

// Table configuration - change if your table name is different
const TABLE_NAME = 'lead_statuses';  // or 'crm_lead_status' for old schema
const PK_COLUMN = 'ls_id';           // Primary key column

/**
 * Get all active lead statuses (for dropdown/list)
 * @param {Pool} db - MySQL pool
 * @returns {Promise<Array>}
 */
const getAll = async (db, userId, userRole) => {
  const isAdmin = !userRole || userRole === 'master' || userRole === 'admin';
  const uid = parseInt(userId);
  let userFilter = '';
  if (!isAdmin) {
    if (userRole === 'team_leader') {
      // Team leader sees: own leads + assigned to them + assigned to their team members
      userFilter = `AND (l.created_by = ${uid} OR EXISTS (
        SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.is_active = 1
        AND (la.u_id = ${uid} OR la.assigned_by = ${uid} OR la.u_id IN (
          SELECT u.u_id FROM users u WHERE u.team_leader_id = ${uid} OR u.reports_to = ${uid}
        ))
      ))`;
    } else if (userRole === 'sales_manager') {
      // Sales manager sees: own leads + assigned to them + leads they assigned forward
      userFilter = `AND (l.created_by = ${uid} OR EXISTS (SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND (la.u_id = ${uid} OR la.assigned_by = ${uid}) AND la.is_active = 1))`;
    } else {
      // Telecaller sees: own leads + leads assigned to them
      userFilter = `AND (l.created_by = ${uid} OR EXISTS (SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.u_id = ${uid} AND la.is_active = 1))`;
    }
  }

  try {
    const [rows] = await db.execute(`
      SELECT
        ${PK_COLUMN} as ls_id,
        name,
        color,
        COALESCE(is_positive, 0) as is_positive,
        COALESCE(is_negative, 0) as is_negative,
        COALESCE(is_default, 0) as is_default,
        COALESCE(is_system, 0) as is_system,
        COALESCE(include_in_all, 1) as include_in_all,
        COALESCE(display_order, 0) as display_order,
        COALESCE(is_active, 1) as is_active,
        (SELECT COUNT(*) FROM leads l WHERE l.ls_id = ${TABLE_NAME}.${PK_COLUMN} AND l.is_archived = 0 AND (l.source_type != 'import' OR l.source_type IS NULL) ${userFilter}) as lead_count
      FROM ${TABLE_NAME}
      WHERE is_active = 1 OR is_active IS NULL
      ORDER BY display_order ASC, ${PK_COLUMN} ASC
    `);
    return rows;
  } catch (err) {
    // If new schema columns don't exist, try minimal query
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      console.log('[LeadStatus] Falling back to minimal columns');
      const [rows] = await db.execute(`
        SELECT
          ${PK_COLUMN} as ls_id,
          name,
          color,
          (SELECT COUNT(*) FROM leads l WHERE l.ls_id = ${TABLE_NAME}.${PK_COLUMN} AND l.is_archived = 0 AND (l.source_type != 'import' OR l.source_type IS NULL) ${userFilter}) as lead_count
        FROM ${TABLE_NAME}
        ORDER BY ${PK_COLUMN} ASC
      `);
      // Add default values for missing columns
      return rows.map(row => ({
        ...row,
        is_positive: 0,
        is_negative: 0,
        is_default: 0,
        is_system: 0,
        include_in_all: 1,
        display_order: 0,
        is_active: 1,
      }));
    }
    throw err;
  }
};

/**
 * Get all lead statuses including inactive (for admin)
 * @param {Pool} db - MySQL pool
 * @returns {Promise<Array>}
 */
const getAllAdmin = async (db) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        ${PK_COLUMN} as ls_id,
        name,
        color,
        COALESCE(is_positive, 0) as is_positive,
        COALESCE(is_negative, 0) as is_negative,
        COALESCE(is_default, 0) as is_default,
        COALESCE(is_system, 0) as is_system,
        COALESCE(include_in_all, 1) as include_in_all,
        COALESCE(display_order, 0) as display_order,
        COALESCE(is_active, 1) as is_active,
        created_at,
        updated_at
      FROM ${TABLE_NAME}
      ORDER BY display_order ASC, ${PK_COLUMN} ASC
    `);
    return rows;
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      const [rows] = await db.execute(`
        SELECT 
          ${PK_COLUMN} as ls_id,
          name,
          color
        FROM ${TABLE_NAME}
        ORDER BY ${PK_COLUMN} ASC
      `);
      return rows.map(row => ({
        ...row,
        is_positive: 0,
        is_negative: 0,
        is_default: 0,
        is_system: 0,
        include_in_all: 1,
        display_order: 0,
        is_active: 1,
        created_at: null,
        updated_at: null,
      }));
    }
    throw err;
  }
};

/**
 * Get single lead status by ID
 * @param {Pool} db - MySQL pool
 * @param {number} lsId - Lead status ID
 * @returns {Promise<Object|null>}
 */
const getById = async (db, lsId) => {
  const [rows] = await db.execute(
    `SELECT *, ${PK_COLUMN} as ls_id FROM ${TABLE_NAME} WHERE ${PK_COLUMN} = ?`,
    [lsId]
  );
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Get lead status by name (for duplicate check)
 * @param {Pool} db - MySQL pool
 * @param {string} name - Status name
 * @returns {Promise<Object|null>}
 */
const getByName = async (db, name) => {
  const [rows] = await db.execute(
    `SELECT *, ${PK_COLUMN} as ls_id FROM ${TABLE_NAME} WHERE LOWER(name) = LOWER(?)`,
    [name.trim()]
  );
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Get the maximum display_order value
 * @param {Pool} db - MySQL pool
 * @returns {Promise<number>}
 */
const getMaxOrder = async (db) => {
  try {
    const [rows] = await db.execute(
      `SELECT MAX(display_order) as max_order FROM ${TABLE_NAME}`
    );
    return rows[0].max_order || 0;
  } catch (err) {
    // If display_order doesn't exist, return 0
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      const [rows] = await db.execute(
        `SELECT MAX(${PK_COLUMN}) as max_order FROM ${TABLE_NAME}`
      );
      return rows[0].max_order || 0;
    }
    throw err;
  }
};

/**
 * Create new lead status
 * @param {Pool} db - MySQL pool
 * @param {Object} data - Status data
 * @returns {Promise<number>} - Inserted ID
 */
const create = async (db, data) => {
  const {
    name,
    color = '#808080',
    is_positive = 0,
    is_negative = 0,
    is_default = 0,
    include_in_all = 1,
    display_order = null,
  } = data;

  // Get next display_order if not provided
  let order = display_order;
  if (order === null) {
    const maxOrder = await getMaxOrder(db);
    order = maxOrder + 1;
  }

  try {
    // Try new schema with all columns
    const [result] = await db.execute(
      `INSERT INTO ${TABLE_NAME} 
        (name, color, is_positive, is_negative, is_default, is_system, include_in_all, display_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1, NOW(), NOW())`,
      [name.trim(), color, is_positive, is_negative, is_default, include_in_all, order]
    );
    return result.insertId;
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      // Fallback: try with minimal columns (old schema)
      const [result] = await db.execute(
        `INSERT INTO ${TABLE_NAME} (name, color) VALUES (?, ?)`,
        [name.trim(), color]
      );
      return result.insertId;
    }
    throw err;
  }
};

/**
 * Update lead status
 * @param {Pool} db - MySQL pool
 * @param {number} lsId - Lead status ID
 * @param {Object} data - Fields to update
 * @returns {Promise<boolean>}
 */
const update = async (db, lsId, data) => {
  const fields = [];
  const values = [];

  // Only update provided fields
  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name.trim());
  }
  if (data.color !== undefined) {
    fields.push('color = ?');
    values.push(data.color);
  }
  if (data.is_positive !== undefined) {
    fields.push('is_positive = ?');
    values.push(data.is_positive ? 1 : 0);
  }
  if (data.is_negative !== undefined) {
    fields.push('is_negative = ?');
    values.push(data.is_negative ? 1 : 0);
  }
  if (data.is_default !== undefined) {
    fields.push('is_default = ?');
    values.push(data.is_default ? 1 : 0);
  }
  if (data.include_in_all !== undefined) {
    fields.push('include_in_all = ?');
    values.push(data.include_in_all ? 1 : 0);
  }
  if (data.display_order !== undefined) {
    fields.push('display_order = ?');
    values.push(data.display_order);
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(data.is_active ? 1 : 0);
  }

  if (fields.length === 0) {
    return false;
  }

  // Add updated_at if column exists
  fields.push('updated_at = NOW()');

  values.push(lsId);

  try {
    const [result] = await db.execute(
      `UPDATE ${TABLE_NAME} SET ${fields.join(', ')} WHERE ${PK_COLUMN} = ?`,
      values
    );
    return result.affectedRows > 0;
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      // Remove updated_at and try again
      fields.pop();
      const [result] = await db.execute(
        `UPDATE ${TABLE_NAME} SET ${fields.join(', ')} WHERE ${PK_COLUMN} = ?`,
        values
      );
      return result.affectedRows > 0;
    }
    throw err;
  }
};

/**
 * Soft delete (set is_active = 0)
 * @param {Pool} db - MySQL pool
 * @param {number} lsId - Lead status ID
 * @returns {Promise<boolean>}
 */
const softDelete = async (db, lsId) => {
  try {
    const [result] = await db.execute(
      `UPDATE ${TABLE_NAME} SET is_active = 0, updated_at = NOW() WHERE ${PK_COLUMN} = ? AND (is_system = 0 OR is_system IS NULL)`,
      [lsId]
    );
    return result.affectedRows > 0;
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      // Try without is_system and updated_at
      const [result] = await db.execute(
        `UPDATE ${TABLE_NAME} SET is_active = 0 WHERE ${PK_COLUMN} = ?`,
        [lsId]
      );
      return result.affectedRows > 0;
    }
    throw err;
  }
};

/**
 * Hard delete (only non-system statuses)
 * @param {Pool} db - MySQL pool
 * @param {number} lsId - Lead status ID
 * @returns {Promise<boolean>}
 */
const hardDelete = async (db, lsId) => {
  try {
    const [result] = await db.execute(
      `DELETE FROM ${TABLE_NAME} WHERE ${PK_COLUMN} = ? AND (is_system = 0 OR is_system IS NULL)`,
      [lsId]
    );
    return result.affectedRows > 0;
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      const [result] = await db.execute(
        `DELETE FROM ${TABLE_NAME} WHERE ${PK_COLUMN} = ?`,
        [lsId]
      );
      return result.affectedRows > 0;
    }
    throw err;
  }
};

/**
 * Reorder statuses
 * @param {Pool} db - MySQL pool
 * @param {Array} orderList - Array of { ls_id, display_order }
 * @returns {Promise<boolean>}
 */
const reorder = async (db, orderList) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    for (const item of orderList) {
      await connection.execute(
        `UPDATE ${TABLE_NAME} SET display_order = ? WHERE ${PK_COLUMN} = ?`,
        [item.display_order, item.ls_id]
      );
    }

    await connection.commit();
    return true;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

module.exports = {
  getAll,
  getAllAdmin,
  getById,
  getByName,
  getMaxOrder,
  create,
  update,
  softDelete,
  hardDelete,
  reorder,
  // Export config for debugging
  TABLE_NAME,
  PK_COLUMN,
};
