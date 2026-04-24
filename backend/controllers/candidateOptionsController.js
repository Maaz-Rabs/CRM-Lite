const response = require('../utils/response');

/**
 * Generic CRUD for candidate option tables:
 * - candidate_sources
 * - candidate_positions
 * - candidate_statuses
 */

const TABLE_MAP = {
  'candidates_source': { table: 'candidate_sources', id: 'cs_id', name: 'name' },
  'candidates_post': { table: 'candidate_positions', id: 'cp_id', name: 'name' },
  'candidates_status': { table: 'candidate_statuses', id: 'cst_id', name: 'name' },
};

// GET /api/candidate-options/:type
exports.getAll = async (req, res) => {
  try {
    const config = TABLE_MAP[req.params.type];
    if (!config) return response.error(res, 'Invalid type');

    const [rows] = await req.db.query(
      `SELECT * FROM ${config.table} WHERE is_active = 1 ORDER BY display_order ASC, ${config.id} ASC`
    );
    return response.success(res, 'Options fetched', rows);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// POST /api/candidate-options/:type
exports.create = async (req, res) => {
  try {
    const config = TABLE_MAP[req.params.type];
    if (!config) return response.error(res, 'Invalid type');

    const { name, color } = req.body;
    if (!name || !name.trim()) return response.error(res, 'Name is required');

    // Check duplicate
    const [existing] = await req.db.query(
      `SELECT ${config.id} FROM ${config.table} WHERE name = ? AND is_active = 1`,
      [name.trim()]
    );
    if (existing.length > 0) {
      return response.success(res, 'Already exists', { id: existing[0][config.id], name: name.trim() });
    }

    const [result] = await req.db.query(
      `INSERT INTO ${config.table} (name${color ? ', color' : ''}) VALUES (?${color ? ', ?' : ''})`,
      color ? [name.trim(), color] : [name.trim()]
    );

    return response.success(res, 'Option created', { id: result.insertId, name: name.trim() }, 201);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// PUT /api/candidate-options/:type/:id
exports.update = async (req, res) => {
  try {
    const config = TABLE_MAP[req.params.type];
    if (!config) return response.error(res, 'Invalid type');

    const { name, color } = req.body;
    if (!name || !name.trim()) return response.error(res, 'Name is required');

    await req.db.query(
      `UPDATE ${config.table} SET name = ?${color !== undefined ? ', color = ?' : ''} WHERE ${config.id} = ?`,
      color !== undefined ? [name.trim(), color, req.params.id] : [name.trim(), req.params.id]
    );
    return response.success(res, 'Option updated');
  } catch (err) {
    return response.serverError(res, err);
  }
};

// DELETE /api/candidate-options/:type/:id
exports.remove = async (req, res) => {
  try {
    const config = TABLE_MAP[req.params.type];
    if (!config) return response.error(res, 'Invalid type');

    await req.db.query(
      `UPDATE ${config.table} SET is_active = 0 WHERE ${config.id} = ?`,
      [req.params.id]
    );
    return response.success(res, 'Option deleted');
  } catch (err) {
    return response.serverError(res, err);
  }
};
