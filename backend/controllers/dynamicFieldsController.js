/**
 * Dynamic Fields Controller
 * Unified CRUD for dropdown/master tables consumed by the
 * Dynamic Fields page on the frontend.
 *
 * Endpoint pattern:
 *   GET    /api/dynamic-fields/<type>
 *   POST   /api/dynamic-fields/<type>
 *   PUT    /api/dynamic-fields/<type>/:id
 *   DELETE /api/dynamic-fields/<type>/:id
 *   PATCH  /api/dynamic-fields/<type>/:id/toggle
 */

const response = require('../utils/response');

// Each entry declares:
//   table       — DB table name
//   idField     — primary key column
//   nameField   — required label column
//   fields      — other allowed columns (writable)
const TYPE_MAP = {
  'lead-sources': {
    table: 'lead_sources',
    idField: 'src_id',
    nameField: 'name',
    fields: ['color', 'icon', 'display_order'],
  },
  'lead-statuses': {
    table: 'lead_statuses',
    idField: 'ls_id',
    nameField: 'name',
    fields: ['color', 'display_order'],
  },
  'lead-priorities': {
    table: 'lead_priorities',
    idField: 'lp_id',
    nameField: 'name',
    fields: ['color', 'display_order'],
  },
  'projects': {
    table: 'projects',
    idField: 'project_id',
    nameField: 'name',
    fields: ['developer', 'location'],
  },
  'service-types': {
    table: 'service_types',
    idField: 'st_id',
    nameField: 'name',
    fields: ['display_order'],
  },
  'property-types': {
    table: 'property_types',
    idField: 'pt_id',
    nameField: 'name',
    fields: ['display_order'],
  },
  'configurations': {
    table: 'property_configurations',
    idField: 'pc_id',
    nameField: 'name',
    fields: ['display_order'],
  },
  'attendance-policies': {
    table: 'attendance_policies',
    idField: 'ap_id',
    nameField: 'title',
    fields: ['type', 'threshold_hours', 'threshold_minutes', 'threshold_time', 'color', 'week_offs'],
  },
};

const getConfig = (type) => TYPE_MAP[type] || null;

const pickWritable = (body, cfg) => {
  const out = {};
  const allowed = [cfg.nameField, ...cfg.fields];
  for (const key of allowed) {
    if (body[key] !== undefined && body[key] !== '') out[key] = body[key];
  }
  return out;
};

const list = async (req, res) => {
  try {
    const cfg = getConfig(req.params.type);
    if (!cfg) return response.error(res, 'Unknown dynamic field type', 404);

    const [rows] = await req.db.query(
      `SELECT * FROM \`${cfg.table}\` ORDER BY ${cfg.fields.includes('display_order') ? 'display_order ASC, ' : ''}${cfg.idField} ASC`
    );
    return response.success(res, 'Fetched', rows);
  } catch (err) {
    console.error('DynamicFields list error:', err);
    return response.serverError(res, err);
  }
};

const create = async (req, res) => {
  try {
    const cfg = getConfig(req.params.type);
    if (!cfg) return response.error(res, 'Unknown dynamic field type', 404);

    const data = pickWritable(req.body, cfg);
    if (!data[cfg.nameField]) return response.error(res, `${cfg.nameField} is required`);

    const cols = Object.keys(data);
    const placeholders = cols.map(() => '?').join(', ');
    const values = cols.map(c => data[c]);

    const [result] = await req.db.query(
      `INSERT INTO \`${cfg.table}\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`,
      values
    );

    const [rows] = await req.db.query(
      `SELECT * FROM \`${cfg.table}\` WHERE ${cfg.idField} = ?`,
      [result.insertId]
    );
    return response.success(res, 'Created', rows[0], 201);
  } catch (err) {
    console.error('DynamicFields create error:', err);
    return response.serverError(res, err);
  }
};

const update = async (req, res) => {
  try {
    const cfg = getConfig(req.params.type);
    if (!cfg) return response.error(res, 'Unknown dynamic field type', 404);

    const data = pickWritable(req.body, cfg);
    const cols = Object.keys(data);
    if (cols.length === 0) return response.error(res, 'No updatable fields provided');

    const setClause = cols.map(c => `\`${c}\` = ?`).join(', ');
    const values = cols.map(c => data[c]);
    values.push(req.params.id);

    const [result] = await req.db.query(
      `UPDATE \`${cfg.table}\` SET ${setClause} WHERE ${cfg.idField} = ?`,
      values
    );

    if (result.affectedRows === 0) return response.error(res, 'Not found', 404);

    const [rows] = await req.db.query(
      `SELECT * FROM \`${cfg.table}\` WHERE ${cfg.idField} = ?`,
      [req.params.id]
    );
    return response.success(res, 'Updated', rows[0]);
  } catch (err) {
    console.error('DynamicFields update error:', err);
    return response.serverError(res, err);
  }
};

const remove = async (req, res) => {
  try {
    const cfg = getConfig(req.params.type);
    if (!cfg) return response.error(res, 'Unknown dynamic field type', 404);

    const [result] = await req.db.query(
      `DELETE FROM \`${cfg.table}\` WHERE ${cfg.idField} = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) return response.error(res, 'Not found', 404);
    return response.success(res, 'Deleted');
  } catch (err) {
    console.error('DynamicFields delete error:', err);
    // Most likely FK constraint — return a friendlier message
    if (err && (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451)) {
      return response.error(res, 'Cannot delete — this item is used by existing records. Deactivate it instead.', 409);
    }
    return response.serverError(res, err);
  }
};

const toggle = async (req, res) => {
  try {
    const cfg = getConfig(req.params.type);
    if (!cfg) return response.error(res, 'Unknown dynamic field type', 404);

    const [rows] = await req.db.query(
      `SELECT is_active FROM \`${cfg.table}\` WHERE ${cfg.idField} = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return response.error(res, 'Not found', 404);

    const next = rows[0].is_active ? 0 : 1;
    await req.db.query(
      `UPDATE \`${cfg.table}\` SET is_active = ? WHERE ${cfg.idField} = ?`,
      [next, req.params.id]
    );
    return response.success(res, 'Toggled', { is_active: next });
  } catch (err) {
    console.error('DynamicFields toggle error:', err);
    return response.serverError(res, err);
  }
};

module.exports = { list, create, update, remove, toggle };
