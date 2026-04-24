const TABLE = 'attendance_policy_user_week_offs';

/**
 * Get all active user week-off assignments for a policy
 */
const getByPolicyId = async (db, apId) => {
  const [rows] = await db.execute(
    `SELECT apuwo_id, ap_id, u_id, week_offs
     FROM ${TABLE} WHERE ap_id = ? AND is_active = 1`,
    [apId]
  );
  return rows;
};

/**
 * Save per-user week offs for a policy
 * Deactivates removed users, upserts current ones
 */
const saveForPolicy = async (db, apId, userWeekOffs) => {
  // Deactivate all existing for this policy
  await db.execute(
    `UPDATE ${TABLE} SET is_active = 0 WHERE ap_id = ?`,
    [apId]
  );

  // Upsert each user's week offs
  for (const uwo of userWeekOffs) {
    await db.execute(
      `INSERT INTO ${TABLE} (ap_id, u_id, week_offs, is_active) VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE week_offs = VALUES(week_offs), is_active = 1`,
      [apId, uwo.u_id, uwo.week_offs]
    );
  }
};

module.exports = { getByPolicyId, saveForPolicy };
