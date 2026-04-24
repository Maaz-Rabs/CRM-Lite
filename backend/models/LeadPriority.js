// ============================================================================
// LEAD PRIORITY MODEL
// Database operations for lead_priorities table
// ============================================================================

const TABLE_NAME = 'lead_priorities';
const PK_COLUMN = 'lp_id';

/**
 * Get all active lead priorities with role-based lead counts
 */
const getAll = async (db, userId, userRole) => {
  const isAdmin = !userRole || userRole === 'master' || userRole === 'admin';
  const uid = parseInt(userId) || 0;
  let userFilter = '';
  if (!isAdmin && uid) {
    if (userRole === 'team_leader') {
      userFilter = `AND (l.created_by = ${uid} OR EXISTS (
        SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.is_active = 1
        AND (la.u_id = ${uid} OR la.assigned_by = ${uid} OR la.u_id IN (
          SELECT u.u_id FROM users u WHERE u.team_leader_id = ${uid} OR u.reports_to = ${uid}
        ))
      ))`;
    } else if (userRole === 'sales_manager') {
      userFilter = `AND (l.created_by = ${uid} OR EXISTS (SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND (la.u_id = ${uid} OR la.assigned_by = ${uid}) AND la.is_active = 1))`;
    } else {
      userFilter = `AND (l.created_by = ${uid} OR EXISTS (SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.u_id = ${uid} AND la.is_active = 1))`;
    }
  }

  const [rows] = await db.execute(
    `SELECT ${PK_COLUMN} as lp_id, name, display_order, is_active,
       (SELECT COUNT(*) FROM leads l WHERE l.lp_id = ${TABLE_NAME}.${PK_COLUMN} AND l.is_archived = 0 AND (l.source_type != 'import' OR l.source_type IS NULL) ${userFilter}) as lead_count
     FROM ${TABLE_NAME}
     WHERE is_active = 1
     ORDER BY display_order ASC, ${PK_COLUMN} ASC`
  );
  return rows;
};

/**
 * Get all lead priorities including inactive (admin)
 */
const getAllAdmin = async (db) => {
  const [rows] = await db.execute(
    `SELECT ${PK_COLUMN} as lp_id, name, display_order, is_active, create_dt, update_dt
     FROM ${TABLE_NAME}
     ORDER BY display_order ASC, ${PK_COLUMN} ASC`
  );
  return rows;
};

/**
 * Get single lead priority by ID
 */
const getById = async (db, lpId) => {
  const [rows] = await db.execute(
    `SELECT ${PK_COLUMN} as lp_id, name, display_order, is_active FROM ${TABLE_NAME} WHERE ${PK_COLUMN} = ?`,
    [lpId]
  );
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Get lead priority by name (duplicate check)
 */
const getByName = async (db, name) => {
  const [rows] = await db.execute(
    `SELECT ${PK_COLUMN} as lp_id, name FROM ${TABLE_NAME} WHERE LOWER(name) = LOWER(?) AND is_active = 1`,
    [name.trim()]
  );
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Get max display_order
 */
const getMaxOrder = async (db) => {
  const [rows] = await db.execute(
    `SELECT MAX(display_order) as max_order FROM ${TABLE_NAME}`
  );
  return rows[0].max_order || 0;
};

/**
 * Create new lead priority
 */
const create = async (db, data) => {
  const { name } = data;
  const maxOrder = await getMaxOrder(db);

  const [result] = await db.execute(
    `INSERT INTO ${TABLE_NAME} (name, display_order, is_active) VALUES (?, ?, 1)`,
    [name.trim(), maxOrder + 1]
  );
  return result.insertId;
};

/**
 * Update lead priority
 */
const update = async (db, lpId, data) => {
  const fields = [];
  const values = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name.trim());
  }
  if (data.display_order !== undefined) {
    fields.push('display_order = ?');
    values.push(data.display_order);
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(data.is_active ? 1 : 0);
  }

  if (fields.length === 0) return false;

  values.push(lpId);

  const [result] = await db.execute(
    `UPDATE ${TABLE_NAME} SET ${fields.join(', ')} WHERE ${PK_COLUMN} = ?`,
    values
  );
  return result.affectedRows > 0;
};

/**
 * Soft delete (set is_active = 0)
 */
const softDelete = async (db, lpId) => {
  const [result] = await db.execute(
    `UPDATE ${TABLE_NAME} SET is_active = 0 WHERE ${PK_COLUMN} = ?`,
    [lpId]
  );
  return result.affectedRows > 0;
};

/**
 * Hard delete
 */
const hardDelete = async (db, lpId) => {
  const [result] = await db.execute(
    `DELETE FROM ${TABLE_NAME} WHERE ${PK_COLUMN} = ?`,
    [lpId]
  );
  return result.affectedRows > 0;
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
};
