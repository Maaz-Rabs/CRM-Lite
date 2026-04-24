const express = require('express');
const router = express.Router();
const {authenticate} = require('../middleware/auth');
const response = require('../utils/response');

router.use(authenticate);

// Self-heal: ensure lead_schedules table exists
let tableEnsured = false;
const ensureTable = async (db) => {
  if (tableEnsured) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS lead_schedules (
        ls_id INT AUTO_INCREMENT PRIMARY KEY,
        schedule_type ENUM('round_robin','manual') NOT NULL,
        user_ids JSON NOT NULL,
        date_from DATE DEFAULT NULL,
        date_to DATE DEFAULT NULL,
        source_ids JSON DEFAULT NULL,
        service_type_ids JSON DEFAULT NULL,
        project_ids JSON DEFAULT NULL,
        cities JSON DEFAULT NULL,
        status ENUM('active','inactive') NOT NULL DEFAULT 'active',
        last_assigned_index INT NOT NULL DEFAULT 0,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_type (schedule_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    tableEnsured = true;
  } catch (e) {
    console.log('ensure lead_schedules error:', e.message);
  }
};

// ─── GET ALL SCHEDULES ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    await ensureTable(req.db);
    const [rows] = await req.db.query(
      `SELECT ls.*, u.username as created_by_name
       FROM lead_schedules ls
       LEFT JOIN users u ON ls.created_by = u.u_id
       ORDER BY ls.created_at DESC`
    );

    // Resolve user names for each schedule
    for (const row of rows) {
      let userIds = [];
      try { userIds = typeof row.user_ids === 'string' ? JSON.parse(row.user_ids) : row.user_ids; } catch(e) {}
      if (Array.isArray(userIds) && userIds.length > 0) {
        const [users] = await req.db.query(
          `SELECT u_id, username FROM users WHERE u_id IN (?) ORDER BY username`,
          [userIds]
        );
        row.users = users;
      } else {
        row.users = [];
      }
      // Parse JSON fields
      try { row.source_ids = typeof row.source_ids === 'string' ? JSON.parse(row.source_ids) : (row.source_ids || []); } catch(e) { row.source_ids = []; }
      try { row.service_type_ids = typeof row.service_type_ids === 'string' ? JSON.parse(row.service_type_ids) : (row.service_type_ids || []); } catch(e) { row.service_type_ids = []; }
      try { row.project_ids = typeof row.project_ids === 'string' ? JSON.parse(row.project_ids) : (row.project_ids || []); } catch(e) { row.project_ids = []; }
      try { row.cities = typeof row.cities === 'string' ? JSON.parse(row.cities) : (row.cities || []); } catch(e) { row.cities = []; }
    }

    return response.success(res, 'Schedules fetched', {schedules: rows});
  } catch (err) {
    console.error('Get schedules error:', err);
    return response.serverError(res, err);
  }
});

// ─── CREATE SCHEDULE ────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    await ensureTable(req.db);
    const {schedule_type, user_ids, date_from, date_to, source_ids, service_type_ids, project_ids, cities, status} = req.body;

    if (!schedule_type) return response.error(res, 'Schedule type is required');
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) return response.error(res, 'At least one user is required');
    if (schedule_type === 'manual' && user_ids.length > 1) return response.error(res, 'Manual schedule allows only one user');

    const [result] = await req.db.query(
      `INSERT INTO lead_schedules (schedule_type, user_ids, date_from, date_to, source_ids, service_type_ids, project_ids, cities, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schedule_type,
        JSON.stringify(user_ids),
        date_from || null,
        date_to || null,
        source_ids && source_ids.length > 0 ? JSON.stringify(source_ids) : null,
        service_type_ids && service_type_ids.length > 0 ? JSON.stringify(service_type_ids) : null,
        project_ids && project_ids.length > 0 ? JSON.stringify(project_ids) : null,
        cities && cities.length > 0 ? JSON.stringify(cities) : null,
        status || 'active',
        req.user.userId,
      ]
    );

    return response.success(res, 'Schedule created successfully', {ls_id: result.insertId}, 201);
  } catch (err) {
    console.error('Create schedule error:', err);
    return response.serverError(res, err);
  }
});

// ─── UPDATE SCHEDULE ────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    await ensureTable(req.db);
    const {id} = req.params;
    const {schedule_type, user_ids, date_from, date_to, source_ids, service_type_ids, project_ids, cities, status} = req.body;

    const [existing] = await req.db.query('SELECT ls_id FROM lead_schedules WHERE ls_id = ?', [id]);
    if (existing.length === 0) return response.error(res, 'Schedule not found', 404);

    await req.db.query(
      `UPDATE lead_schedules SET
        schedule_type = ?, user_ids = ?, date_from = ?, date_to = ?,
        source_ids = ?, service_type_ids = ?, project_ids = ?, cities = ?, status = ?
       WHERE ls_id = ?`,
      [
        schedule_type,
        JSON.stringify(user_ids || []),
        date_from || null,
        date_to || null,
        source_ids && source_ids.length > 0 ? JSON.stringify(source_ids) : null,
        service_type_ids && service_type_ids.length > 0 ? JSON.stringify(service_type_ids) : null,
        project_ids && project_ids.length > 0 ? JSON.stringify(project_ids) : null,
        cities && cities.length > 0 ? JSON.stringify(cities) : null,
        status || 'active',
        id,
      ]
    );

    return response.success(res, 'Schedule updated');
  } catch (err) {
    console.error('Update schedule error:', err);
    return response.serverError(res, err);
  }
});

// ─── DELETE SCHEDULE ────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await ensureTable(req.db);
    await req.db.query('DELETE FROM lead_schedules WHERE ls_id = ?', [req.params.id]);
    return response.success(res, 'Schedule deleted');
  } catch (err) {
    console.error('Delete schedule error:', err);
    return response.serverError(res, err);
  }
});

// ─── TOGGLE STATUS ──────────────────────────────────────────────
router.patch('/:id/toggle', async (req, res) => {
  try {
    await ensureTable(req.db);
    const {id} = req.params;
    const [rows] = await req.db.query('SELECT status FROM lead_schedules WHERE ls_id = ?', [id]);
    if (rows.length === 0) return response.error(res, 'Schedule not found', 404);

    const newStatus = rows[0].status === 'active' ? 'inactive' : 'active';
    await req.db.query('UPDATE lead_schedules SET status = ? WHERE ls_id = ?', [newStatus, id]);
    return response.success(res, `Schedule ${newStatus}`);
  } catch (err) {
    console.error('Toggle schedule error:', err);
    return response.serverError(res, err);
  }
});

// ─── AUTO-ASSIGN LEAD (called internally when lead is created) ──
// This function finds a matching active schedule and assigns the lead
const autoAssignLead = async (db, leadId, leadData) => {
  try {
    const [schedules] = await db.query(
      `SELECT * FROM lead_schedules WHERE status = 'active' ORDER BY ls_id ASC`
    );
    if (schedules.length === 0) return null;

    const leadDate = leadData.create_dt ? new Date(leadData.create_dt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    for (const schedule of schedules) {
      // Check date range
      if (schedule.date_from && leadDate < schedule.date_from) continue;
      if (schedule.date_to && leadDate > schedule.date_to) continue;

      // Check source filter
      let sourceIds = [];
      try { sourceIds = typeof schedule.source_ids === 'string' ? JSON.parse(schedule.source_ids) : (schedule.source_ids || []); } catch(e) {}
      if (sourceIds.length > 0 && leadData.src_id && !sourceIds.includes(Number(leadData.src_id))) continue;

      // Check service type filter
      let stIds = [];
      try { stIds = typeof schedule.service_type_ids === 'string' ? JSON.parse(schedule.service_type_ids) : (schedule.service_type_ids || []); } catch(e) {}
      // Service type matching requires checking lead_requirements — skip if no filter
      // (advanced matching can be added later)

      // Check project filter
      let projIds = [];
      try { projIds = typeof schedule.project_ids === 'string' ? JSON.parse(schedule.project_ids) : (schedule.project_ids || []); } catch(e) {}
      // Project matching requires checking lead_requirements — skip if no filter

      // Check city filter
      let cities = [];
      try { cities = typeof schedule.cities === 'string' ? JSON.parse(schedule.cities) : (schedule.cities || []); } catch(e) {}
      if (cities.length > 0 && leadData.city) {
        const leadCity = leadData.city.toLowerCase();
        if (!cities.some(c => c.toLowerCase() === leadCity)) continue;
      }

      // Schedule matches! Determine which user to assign
      let userIds = [];
      try { userIds = typeof schedule.user_ids === 'string' ? JSON.parse(schedule.user_ids) : (schedule.user_ids || []); } catch(e) {}
      if (userIds.length === 0) continue;

      let assignToUserId;
      if (schedule.schedule_type === 'manual') {
        assignToUserId = userIds[0];
      } else {
        // Round Robin: use last_assigned_index to rotate
        const nextIndex = (schedule.last_assigned_index + 1) % userIds.length;
        assignToUserId = userIds[nextIndex];

        // Update the index
        await db.query('UPDATE lead_schedules SET last_assigned_index = ? WHERE ls_id = ?', [nextIndex, schedule.ls_id]);
      }

      // Assign lead
      await db.query(
        `INSERT INTO lead_assignments (l_id, u_id, assigned_by, is_active) VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE u_id = VALUES(u_id), is_active = 1`,
        [leadId, assignToUserId, 0] // assigned_by = 0 means system
      );

      // Log activity
      const [assignedUser] = await db.query('SELECT username FROM users WHERE u_id = ?', [assignToUserId]);
      const assignedName = assignedUser[0]?.username || `User #${assignToUserId}`;
      await db.query(
        `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source)
         VALUES (?, ?, 'system', ?, 'system')`,
        [leadId, assignToUserId, `Lead auto-assigned to ${assignedName} via ${schedule.schedule_type} schedule`]
      );

      console.log(`[LEAD-SCHEDULE] Lead #${leadId} assigned to user #${assignToUserId} via schedule #${schedule.ls_id} (${schedule.schedule_type})`);
      return assignToUserId;
    }

    return null; // No matching schedule
  } catch (err) {
    console.error('[LEAD-SCHEDULE] Auto-assign error:', err);
    return null;
  }
};

module.exports = router;
module.exports.autoAssignLead = autoAssignLead;
