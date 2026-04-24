// ============================================================================
// ATTENDANCE POLICY CONTROLLER
// Handles all attendance policy CRUD operations
// Table: attendance_policies (ap_id, title, type, threshold_hours,
//        threshold_minutes, threshold_time, color, is_active)
// ============================================================================

const AttendancePolicy = require('../models/AttendancePolicy');
const AttendancePolicyUserWeekOff = require('../models/AttendancePolicyUserWeekOff');
const response = require('../utils/response');
const { sendNotification } = require('../services/notificationService');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Send week-off assignment notifications to users
 */
const notifyWeekOffUsers = async (db, policyTitle, userWeekOffs) => {
  if (!userWeekOffs || userWeekOffs.length === 0) return;

  const userIds = userWeekOffs.map(u => u.u_id);
  const placeholders = userIds.map(() => '?').join(',');

  const [users] = await db.query(
    `SELECT u.u_id, u.device_token, up.first_name, up.last_name
     FROM users u
     LEFT JOIN user_profiles up ON u.u_id = up.u_id
     WHERE u.u_id IN (${placeholders}) AND u.device_token IS NOT NULL`,
    userIds
  );

  const tokenMap = {};
  users.forEach(u => { tokenMap[u.u_id] = u.device_token; });

  for (const uwo of userWeekOffs) {
    const token = tokenMap[uwo.u_id];
    if (!token) continue;

    const days = uwo.week_offs
      ? uwo.week_offs.split(',').map(d => DAY_NAMES[parseInt(d.trim())]).filter(Boolean).join(', ')
      : 'None';

    sendNotification(
      token,
      'Week Off Assigned',
      `Your week off days for "${policyTitle}" have been set to: ${days}`,
      { type: 'week_off_assigned' }
    ).catch(err => console.error('[ATTENDANCE POLICY] notify error:', err));
  }
};

const VALID_TYPES = ['full_day', 'half_day', 'late_mark', 'intime', 'week_off'];

/**
 * GET /api/attendance-policies
 * Get all active attendance policies
 */
const getAll = async (req, res) => {
  try {
    const policies = await AttendancePolicy.getAll(req.db);

    return response.success(res, 'Attendance policies fetched successfully', {
      policies,
      count: policies.length,
    });
  } catch (err) {
    console.error('[ATTENDANCE POLICY] getAll error:', err);
    return response.serverError(res, err);
  }
};

/**
 * POST /api/attendance-policies
 * Create new attendance policy
 * Body: { title, type, threshold_hours?, threshold_minutes?, threshold_time?, color? }
 */
const create = async (req, res) => {
  try {
    const { title, type, threshold_hours, threshold_minutes, threshold_time, color, week_offs, user_week_offs } = req.body;

    if (!title || !title.trim()) {
      return response.error(res, 'Title is required', 400);
    }
    if (title.trim().length > 100) {
      return response.error(res, 'Title must be less than 100 characters', 400);
    }
    if (!type || !VALID_TYPES.includes(type)) {
      return response.error(res, `Type must be one of: ${VALID_TYPES.join(', ')}`, 400);
    }

    // Check for duplicate title + type combo
    const existing = await AttendancePolicy.getByTitleAndType(req.db, title, type);
    if (existing) {
      return response.error(res, 'A policy with this title and type already exists', 400);
    }

    const apId = await AttendancePolicy.create(req.db, {
      title,
      type,
      threshold_hours: threshold_hours ?? null,
      threshold_minutes: threshold_minutes ?? null,
      threshold_time: threshold_time || null,
      color: color || null,
      week_offs: week_offs || null,
    });

    // Save per-user week offs for specific mode
    if (type === 'week_off' && user_week_offs && Array.isArray(user_week_offs)) {
      await AttendancePolicyUserWeekOff.saveForPolicy(req.db, apId, user_week_offs);
      notifyWeekOffUsers(req.db, title, user_week_offs);
    }

    const policy = await AttendancePolicy.getById(req.db, apId);

    return response.success(res, 'Attendance policy created successfully', { policy }, 201);
  } catch (err) {
    console.error('[ATTENDANCE POLICY] create error:', err);
    return response.serverError(res, err);
  }
};

/**
 * PUT /api/attendance-policies/:id
 * Update attendance policy
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return response.error(res, 'Invalid policy ID', 400);
    }

    const apId = parseInt(id);

    const existing = await AttendancePolicy.getById(req.db, apId);
    if (!existing) {
      return response.error(res, 'Attendance policy not found', 404);
    }

    const { title, type, threshold_hours, threshold_minutes, threshold_time, color, week_offs, user_week_offs } = req.body;

    // If changing title or type, check for duplicate combo
    const newTitle = title !== undefined ? title.trim() : existing.title;
    const newType = type !== undefined ? type : existing.type;
    if ((title && newTitle !== existing.title) || (type && newType !== existing.type)) {
      const duplicate = await AttendancePolicy.getByTitleAndType(req.db, newTitle, newType);
      if (duplicate && duplicate.ap_id !== apId) {
        return response.error(res, 'A policy with this title and type already exists', 400);
      }
    }

    if (type && !VALID_TYPES.includes(type)) {
      return response.error(res, `Type must be one of: ${VALID_TYPES.join(', ')}`, 400);
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (type !== undefined) updateData.type = type;
    if (threshold_hours !== undefined) updateData.threshold_hours = threshold_hours;
    if (threshold_minutes !== undefined) updateData.threshold_minutes = threshold_minutes;
    if (threshold_time !== undefined) updateData.threshold_time = threshold_time;
    if (color !== undefined) updateData.color = color;
    if (week_offs !== undefined) updateData.week_offs = week_offs;

    const updated = await AttendancePolicy.update(req.db, apId, updateData);

    // Handle per-user week offs for specific mode
    if (user_week_offs !== undefined) {
      const uwoList = Array.isArray(user_week_offs) ? user_week_offs : [];
      await AttendancePolicyUserWeekOff.saveForPolicy(req.db, apId, uwoList);
      if (uwoList.length > 0) {
        notifyWeekOffUsers(req.db, newTitle, uwoList);
      }
    }

    if (!updated && user_week_offs === undefined) {
      return response.error(res, 'No changes made', 400);
    }

    const policy = await AttendancePolicy.getById(req.db, apId);

    return response.success(res, 'Attendance policy updated successfully', { policy });
  } catch (err) {
    console.error('[ATTENDANCE POLICY] update error:', err);
    return response.serverError(res, err);
  }
};

/**
 * DELETE /api/attendance-policies/:id
 * Delete attendance policy (soft delete)
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return response.error(res, 'Invalid policy ID', 400);
    }

    const apId = parseInt(id);

    const existing = await AttendancePolicy.getById(req.db, apId);
    if (!existing) {
      return response.error(res, 'Attendance policy not found', 404);
    }

    const deleted = await AttendancePolicy.softDelete(req.db, apId);

    if (!deleted) {
      return response.error(res, 'Failed to delete policy', 400);
    }

    return response.success(res, 'Attendance policy deleted successfully');
  } catch (err) {
    console.error('[ATTENDANCE POLICY] remove error:', err);
    return response.serverError(res, err);
  }
};

/**
 * GET /api/attendance-policies/:id/user-week-offs
 * Get per-user week-off assignments for a policy
 */
const getUserWeekOffs = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return response.error(res, 'Invalid policy ID', 400);
    }
    const apId = parseInt(id);
    const userWeekOffs = await AttendancePolicyUserWeekOff.getByPolicyId(req.db, apId);
    return response.success(res, 'User week offs fetched', { user_week_offs: userWeekOffs });
  } catch (err) {
    console.error('[ATTENDANCE POLICY] getUserWeekOffs error:', err);
    return response.serverError(res, err);
  }
};

module.exports = {
  getAll,
  create,
  update,
  remove,
  getUserWeekOffs,
};
