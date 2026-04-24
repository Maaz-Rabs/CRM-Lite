const response = require('../utils/response');

// Get all candidates with search, pagination, and filters
exports.getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status_id,
      position_id,
      source_id,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = ['c.is_active = 1'];

    if (search.trim()) {
      conditions.push('(c.name LIKE ? OR c.mobile LIKE ? OR c.email LIKE ?)');
      const q = `%${search.trim()}%`;
      params.push(q, q, q);
    }

    if (status_id) {
      conditions.push('c.status_id = ?');
      params.push(parseInt(status_id));
    }

    if (position_id) {
      conditions.push('c.position_id = ?');
      params.push(parseInt(position_id));
    }

    if (source_id) {
      conditions.push('c.source_id = ?');
      params.push(parseInt(source_id));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Allowed sort columns
    const allowedSort = ['name', 'email', 'mobile', 'location', 'created_at', 'date_of_birth'];
    const safeSort = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const safeOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count total
    const [countRows] = await req.db.query(
      `SELECT COUNT(*) as total FROM candidates c ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // Fetch candidates
    const [rows] = await req.db.query(
      `SELECT c.* FROM candidates c ${whereClause} ORDER BY c.${safeSort} ${safeOrder} LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    return response.paginated(res, 'Candidates fetched successfully', rows, {
      page: parseInt(page),
      limit: parseInt(limit),
      total
    });
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Get single candidate by ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await req.db.query(
      'SELECT * FROM candidates WHERE cand_id = ? AND is_active = 1',
      [id]
    );

    if (rows.length === 0) {
      return response.error(res, 'Candidate not found', 404);
    }

    return response.success(res, 'Candidate fetched successfully', rows[0]);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Create candidate
exports.create = async (req, res) => {
  try {
    const {
      name, email, country_code, mobile, alt_country_code, alt_mobile,
      source_id, position_id, status_id, date_of_birth, location, notes
    } = req.body;

    if (!name || !name.trim()) {
      return response.error(res, 'Candidate name is required');
    }
    if (!mobile || !mobile.trim()) {
      return response.error(res, 'Mobile number is required');
    }

    const [result] = await req.db.query(
      `INSERT INTO candidates (name, email, country_code, mobile, alt_country_code, alt_mobile,
        source_id, position_id, status_id, date_of_birth, location, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        email || null,
        country_code || '+91',
        mobile.trim(),
        alt_country_code || '+91',
        alt_mobile || null,
        source_id || null,
        position_id || null,
        status_id || null,
        date_of_birth || null,
        location || null,
        notes || null,
        req.user.userId
      ]
    );

    return response.success(res, 'Candidate created successfully', { cand_id: result.insertId }, 201);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Update candidate
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'name', 'email', 'country_code', 'mobile', 'alt_country_code', 'alt_mobile',
      'source_id', 'position_id', 'status_id', 'date_of_birth', 'location', 'notes'
    ];

    const setClauses = [];
    const params = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        params.push(req.body[field] === '' ? null : req.body[field]);
      }
    }

    if (setClauses.length === 0) {
      return response.error(res, 'No fields to update');
    }

    params.push(id);

    const [result] = await req.db.query(
      `UPDATE candidates SET ${setClauses.join(', ')} WHERE cand_id = ? AND is_active = 1`,
      params
    );

    if (result.affectedRows === 0) {
      return response.error(res, 'Candidate not found', 404);
    }

    return response.success(res, 'Candidate updated successfully');
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Soft delete candidate
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await req.db.query(
      'UPDATE candidates SET is_active = 0 WHERE cand_id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return response.error(res, 'Candidate not found', 404);
    }

    return response.success(res, 'Candidate deleted successfully');
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Upload CV for a candidate
exports.uploadCV = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return response.error(res, 'No file uploaded');
    }

    const cv_path = req.file.path.replace(/\\/g, '/');
    const cv_name = req.file.originalname;

    const [result] = await req.db.query(
      'UPDATE candidates SET cv_path = ?, cv_name = ? WHERE cand_id = ? AND is_active = 1',
      [cv_path, cv_name, id]
    );

    if (result.affectedRows === 0) {
      return response.error(res, 'Candidate not found', 404);
    }

    return response.success(res, 'CV uploaded successfully', { cv_path, cv_name });
  } catch (err) {
    return response.serverError(res, err);
  }
};
