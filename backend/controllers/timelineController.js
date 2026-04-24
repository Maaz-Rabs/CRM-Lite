const response = require('../utils/response');

// Get all milestones for a project ordered by sort_order
exports.getAll = async (req, res) => {
  try {
    const { id } = req.params;

    const [milestones] = await req.db.query(
      'SELECT * FROM project_timeline WHERE project_id = ? ORDER BY sort_order ASC',
      [id]
    );

    return response.success(res, 'Timeline fetched successfully', milestones);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Create a milestone
exports.create = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, milestone_date, status, sort_order } = req.body;

    if (!title || !title.trim()) {
      return response.error(res, 'Title is required');
    }

    // Verify project exists
    const [project] = await req.db.query(
      'SELECT project_id FROM projects WHERE project_id = ? AND is_active = 1',
      [id]
    );

    if (project.length === 0) {
      return response.error(res, 'Project not found', 404);
    }

    const [result] = await req.db.query(
      `INSERT INTO project_timeline (project_id, title, description, milestone_date, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        title.trim(),
        description || null,
        milestone_date || null,
        status || 'pending',
        sort_order || 0,
      ]
    );

    const [newMilestone] = await req.db.query(
      'SELECT * FROM project_timeline WHERE id = ?',
      [result.insertId]
    );

    return response.success(res, 'Milestone created successfully', newMilestone[0], 201);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Update a milestone
exports.update = async (req, res) => {
  try {
    const { id, timelineId } = req.params;

    const [existing] = await req.db.query(
      'SELECT * FROM project_timeline WHERE id = ? AND project_id = ?',
      [timelineId, id]
    );

    if (existing.length === 0) {
      return response.error(res, 'Milestone not found', 404);
    }

    const allowedFields = ['title', 'description', 'milestone_date', 'status', 'sort_order'];
    const setClauses = [];
    const params = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        let value = req.body[field];
        if (field === 'title') {
          if (!value || !String(value).trim()) {
            return response.error(res, 'Title cannot be empty');
          }
          value = String(value).trim();
        }
        params.push(value);
      }
    }

    if (setClauses.length === 0) {
      return response.error(res, 'No fields to update');
    }

    params.push(timelineId);

    await req.db.query(
      `UPDATE project_timeline SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    const [updated] = await req.db.query(
      'SELECT * FROM project_timeline WHERE id = ?',
      [timelineId]
    );

    return response.success(res, 'Milestone updated successfully', updated[0]);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Delete a milestone
exports.remove = async (req, res) => {
  try {
    const { id, timelineId } = req.params;

    const [existing] = await req.db.query(
      'SELECT * FROM project_timeline WHERE id = ? AND project_id = ?',
      [timelineId, id]
    );

    if (existing.length === 0) {
      return response.error(res, 'Milestone not found', 404);
    }

    await req.db.query(
      'DELETE FROM project_timeline WHERE id = ?',
      [timelineId]
    );

    return response.success(res, 'Milestone deleted successfully');
  } catch (err) {
    return response.serverError(res, err);
  }
};
