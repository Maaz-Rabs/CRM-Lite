// ============================================================================
// FOLLOW-UP REMINDER SETTINGS CONTROLLER
// Master can configure when reminders are sent (before, on-time, after)
// ============================================================================

const response = require('../utils/response');

/**
 * GET /api/reminder-settings
 * Get all reminder settings
 */
const getAll = async (req, res) => {
  try {
    const [rows] = await req.db.query(
      'SELECT * FROM followup_reminder_settings ORDER BY minutes_offset ASC'
    );
    return response.success(res, 'Reminder settings fetched', rows);
  } catch (err) {
    console.error('Get reminder settings error:', err);
    return response.serverError(res, err);
  }
};

/**
 * POST /api/reminder-settings
 * Add a new reminder setting (master only)
 */
const create = async (req, res) => {
  try {
    const { label, minutes_offset } = req.body;

    if (label === undefined || minutes_offset === undefined) {
      return response.error(res, 'Label and minutes_offset are required');
    }

    // Check duplicate offset
    const [existing] = await req.db.query(
      'SELECT frs_id FROM followup_reminder_settings WHERE minutes_offset = ?',
      [minutes_offset]
    );
    if (existing.length > 0) {
      return response.error(res, 'A reminder with this timing already exists');
    }

    const [result] = await req.db.query(
      'INSERT INTO followup_reminder_settings (label, minutes_offset, is_active) VALUES (?, ?, 1)',
      [label, minutes_offset]
    );

    return response.success(res, 'Reminder added', { frs_id: result.insertId, label, minutes_offset, is_active: 1 }, 201);
  } catch (err) {
    console.error('Create reminder setting error:', err);
    return response.serverError(res, err);
  }
};

/**
 * PATCH /api/reminder-settings/:id/toggle
 * Toggle a reminder on/off (master only)
 */
const toggle = async (req, res) => {
  try {
    const { id } = req.params;
    await req.db.query(
      'UPDATE followup_reminder_settings SET is_active = NOT is_active WHERE frs_id = ?',
      [id]
    );
    return response.success(res, 'Reminder toggled');
  } catch (err) {
    console.error('Toggle reminder setting error:', err);
    return response.serverError(res, err);
  }
};

/**
 * DELETE /api/reminder-settings/:id
 * Delete a reminder setting (master only)
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await req.db.query('DELETE FROM followup_reminder_settings WHERE frs_id = ?', [id]);
    return response.success(res, 'Reminder deleted');
  } catch (err) {
    console.error('Delete reminder setting error:', err);
    return response.serverError(res, err);
  }
};

module.exports = { getAll, create, toggle, remove };
