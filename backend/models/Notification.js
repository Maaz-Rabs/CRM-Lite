// ============================================================================
// NOTIFICATION MODEL
// Database operations for notifications table
// ============================================================================

/**
 * Get all notifications for a user (latest first, max 50)
 */
const getAll = async (db, userId) => {
  const [rows] = await db.execute(
    `SELECT n_id, u_id, type, title, message, data, is_read, create_dt
     FROM notifications
     WHERE u_id = ?
     ORDER BY create_dt DESC
     LIMIT 50`,
    [userId]
  );
  return rows;
};

/**
 * Get unread count for a user
 */
const getUnreadCount = async (db, userId) => {
  const [rows] = await db.execute(
    `SELECT COUNT(*) as count FROM notifications WHERE u_id = ? AND is_read = 0`,
    [userId]
  );
  return rows[0]?.count || 0;
};

/**
 * Create a notification
 */
const create = async (db, data) => {
  const { u_id, type, title, message, extra_data } = data;
  const [result] = await db.execute(
    `INSERT INTO notifications (u_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)`,
    [u_id, type || 'general', title, message, extra_data ? JSON.stringify(extra_data) : null]
  );
  return result.insertId;
};

/**
 * Create notifications for multiple users
 */
const createBulk = async (db, userIds, { type, title, message, extra_data }) => {
  if (!userIds || userIds.length === 0) return;
  const dataStr = extra_data ? JSON.stringify(extra_data) : null;
  const values = userIds.map(uid => [uid, type || 'general', title, message, dataStr]);
  const placeholders = values.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const flat = values.flat();
  await db.execute(
    `INSERT INTO notifications (u_id, type, title, message, data) VALUES ${placeholders}`,
    flat
  );
};

/**
 * Mark single notification as read
 */
const markRead = async (db, nId, userId) => {
  const [result] = await db.execute(
    `UPDATE notifications SET is_read = 1 WHERE n_id = ? AND u_id = ?`,
    [nId, userId]
  );
  return result.affectedRows > 0;
};

/**
 * Mark all notifications as read for a user
 */
const markAllRead = async (db, userId) => {
  await db.execute(
    `UPDATE notifications SET is_read = 1 WHERE u_id = ? AND is_read = 0`,
    [userId]
  );
};

/**
 * Delete a single notification
 */
const remove = async (db, nId, userId) => {
  const [result] = await db.execute(
    `DELETE FROM notifications WHERE n_id = ? AND u_id = ?`,
    [nId, userId]
  );
  return result.affectedRows > 0;
};

/**
 * Delete all notifications for a user
 */
const removeAll = async (db, userId) => {
  await db.execute(`DELETE FROM notifications WHERE u_id = ?`, [userId]);
};

module.exports = {
  getAll,
  getUnreadCount,
  create,
  createBulk,
  markRead,
  markAllRead,
  remove,
  removeAll,
};
