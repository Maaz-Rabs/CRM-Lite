const response = require('../utils/response');

// Get all towers for a project (with unit count per tower)
exports.getAll = async (req, res) => {
  try {
    const { id } = req.params;

    const [towers] = await req.db.query(
      `SELECT t.*,
              COALESCE(uc.unit_count, 0) AS unit_count
       FROM project_towers t
       LEFT JOIN (
         SELECT tower_id, COUNT(*) AS unit_count
         FROM properties
         WHERE is_active = 1
         GROUP BY tower_id
       ) uc ON uc.tower_id = t.id
       WHERE t.project_id = ?
       ORDER BY t.tower_name ASC`,
      [id]
    );

    return response.success(res, 'Towers fetched successfully', towers);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Create a tower
exports.create = async (req, res) => {
  try {
    const { id } = req.params;
    const { tower_name, total_floors, units_per_floor } = req.body;

    if (!tower_name || !tower_name.trim()) {
      return response.error(res, 'Tower name is required');
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
      `INSERT INTO project_towers (project_id, tower_name, total_floors, units_per_floor)
       VALUES (?, ?, ?, ?)`,
      [id, tower_name.trim(), total_floors || null, units_per_floor || null]
    );

    const [newTower] = await req.db.query(
      'SELECT * FROM project_towers WHERE id = ?',
      [result.insertId]
    );

    return response.success(res, 'Tower created successfully', newTower[0], 201);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Update a tower
exports.update = async (req, res) => {
  try {
    const { id, towerId } = req.params;

    const [existing] = await req.db.query(
      'SELECT * FROM project_towers WHERE id = ? AND project_id = ?',
      [towerId, id]
    );

    if (existing.length === 0) {
      return response.error(res, 'Tower not found', 404);
    }

    const allowedFields = ['tower_name', 'total_floors', 'units_per_floor'];
    const setClauses = [];
    const params = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        let value = req.body[field];
        if (field === 'tower_name') {
          if (!value || !String(value).trim()) {
            return response.error(res, 'Tower name cannot be empty');
          }
          value = String(value).trim();
        }
        params.push(value);
      }
    }

    if (setClauses.length === 0) {
      return response.error(res, 'No fields to update');
    }

    params.push(towerId);

    await req.db.query(
      `UPDATE project_towers SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    const [updated] = await req.db.query(
      'SELECT * FROM project_towers WHERE id = ?',
      [towerId]
    );

    return response.success(res, 'Tower updated successfully', updated[0]);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Delete a tower
exports.remove = async (req, res) => {
  try {
    const { id, towerId } = req.params;

    const [existing] = await req.db.query(
      'SELECT * FROM project_towers WHERE id = ? AND project_id = ?',
      [towerId, id]
    );

    if (existing.length === 0) {
      return response.error(res, 'Tower not found', 404);
    }

    await req.db.query(
      'DELETE FROM project_towers WHERE id = ?',
      [towerId]
    );

    return response.success(res, 'Tower deleted successfully');
  } catch (err) {
    return response.serverError(res, err);
  }
};
