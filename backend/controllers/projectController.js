const response = require('../utils/response');
const fs = require('fs');
const path = require('path');

// Get all projects with search, pagination, cover image, and unit count
exports.getAll = async (req, res) => {
  try {
    const {
      search = '',
      page = 1,
      limit = 20,
    } = req.query;

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const limitVal = parseInt(limit);

    let where = 'WHERE p.is_active = 1';
    const params = [];

    if (search) {
      where += ' AND (p.name LIKE ? OR p.developer LIKE ? OR p.location LIKE ? OR p.city LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    // Count query
    const [countRows] = await req.db.query(
      `SELECT COUNT(*) AS total FROM projects p ${where}`,
      params
    );
    const total = countRows[0].total;

    // Data query with cover image and unit count
    const [rows] = await req.db.query(
      `SELECT p.*,
              pm.file_url AS cover_image,
              COALESCE(uc.unit_count, 0) AS unit_count
       FROM projects p
       LEFT JOIN project_media pm ON pm.project_id = p.project_id AND pm.is_cover = 1
       LEFT JOIN (
         SELECT project_id, COUNT(*) AS unit_count
         FROM properties
         WHERE is_active = 1
         GROUP BY project_id
       ) uc ON uc.project_id = p.project_id
       ${where}
       ORDER BY p.create_dt DESC
       LIMIT ? OFFSET ?`,
      [...params, limitVal, offset]
    );

    return response.success(res, 'Projects fetched successfully', {
      projects: rows,
      pagination: {
        page: parseInt(page),
        limit: limitVal,
        total,
        totalPages: Math.ceil(total / limitVal),
      },
    });
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Get single project with media, towers, timeline, and unit stats
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await req.db.query(
      'SELECT * FROM projects WHERE project_id = ? AND is_active = 1',
      [id]
    );

    if (rows.length === 0) {
      return response.error(res, 'Project not found', 404);
    }

    const project = rows[0];

    // Fetch media, towers, timeline, and unit stats in parallel
    const [media] = await req.db.query(
      'SELECT * FROM project_media WHERE project_id = ? ORDER BY is_cover DESC, created_at DESC',
      [id]
    );

    const [towers] = await req.db.query(
      'SELECT * FROM project_towers WHERE project_id = ? ORDER BY tower_name ASC',
      [id]
    );

    const [timeline] = await req.db.query(
      'SELECT * FROM project_timeline WHERE project_id = ? ORDER BY sort_order ASC',
      [id]
    );

    const [unitStats] = await req.db.query(
      `SELECT status, COUNT(*) AS count
       FROM properties
       WHERE project_id = ? AND is_active = 1
       GROUP BY status`,
      [id]
    );

    project.media = media;
    project.towers = towers;
    project.timeline = timeline;
    project.unit_stats = unitStats;

    return response.success(res, 'Project fetched successfully', project);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Create project with all new fields
exports.create = async (req, res) => {
  try {
    const {
      name, developer, location, rera_number, project_type,
      construction_status, possession_date, total_towers, total_units,
      amenities, description, latitude, longitude, address, city, state, pincode,
    } = req.body;

    if (!name || !name.trim()) {
      return response.error(res, 'Project name is required');
    }

    const [result] = await req.db.query(
      `INSERT INTO projects
       (name, developer, location, rera_number, project_type,
        construction_status, possession_date, total_towers, total_units,
        amenities, description, latitude, longitude, address, city, state, pincode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        developer || null,
        location || null,
        rera_number || null,
        project_type || null,
        construction_status || null,
        possession_date || null,
        total_towers || null,
        total_units || null,
        amenities ? (typeof amenities === 'string' ? amenities : JSON.stringify(amenities)) : null,
        description || null,
        latitude || null,
        longitude || null,
        address || null,
        city || null,
        state || null,
        pincode || null,
      ]
    );

    const [newProject] = await req.db.query(
      'SELECT * FROM projects WHERE project_id = ?',
      [result.insertId]
    );

    return response.success(res, 'Project created successfully', newProject[0], 201);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Update project - dynamic SET clause, only update provided fields
exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await req.db.query(
      'SELECT project_id FROM projects WHERE project_id = ? AND is_active = 1',
      [id]
    );

    if (existing.length === 0) {
      return response.error(res, 'Project not found', 404);
    }

    const allowedFields = [
      'name', 'developer', 'location', 'rera_number', 'project_type',
      'construction_status', 'possession_date', 'total_towers', 'total_units',
      'amenities', 'description', 'latitude', 'longitude', 'address',
      'city', 'state', 'pincode',
    ];

    const setClauses = [];
    const params = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        let value = req.body[field];
        if (field === 'name' && (!value || !String(value).trim())) {
          return response.error(res, 'Project name cannot be empty');
        }
        if (field === 'name') value = String(value).trim();
        if (field === 'amenities' && typeof value !== 'string') {
          value = JSON.stringify(value);
        }
        params.push(value);
      }
    }

    if (setClauses.length === 0) {
      return response.error(res, 'No fields to update');
    }

    params.push(id);

    await req.db.query(
      `UPDATE projects SET ${setClauses.join(', ')} WHERE project_id = ?`,
      params
    );

    const [updated] = await req.db.query(
      'SELECT * FROM projects WHERE project_id = ?',
      [id]
    );

    return response.success(res, 'Project updated successfully', updated[0]);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Soft delete project
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await req.db.query(
      'SELECT project_id FROM projects WHERE project_id = ? AND is_active = 1',
      [id]
    );

    if (existing.length === 0) {
      return response.error(res, 'Project not found', 404);
    }

    await req.db.query(
      'UPDATE projects SET is_active = 0 WHERE project_id = ?',
      [id]
    );

    return response.success(res, 'Project deleted successfully');
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Toggle is_active
exports.toggle = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await req.db.query(
      'SELECT * FROM projects WHERE project_id = ?',
      [id]
    );

    if (existing.length === 0) {
      return response.error(res, 'Project not found', 404);
    }

    const newStatus = existing[0].is_active ? 0 : 1;
    await req.db.query(
      'UPDATE projects SET is_active = ? WHERE project_id = ?',
      [newStatus, id]
    );

    const [rows] = await req.db.query(
      'SELECT * FROM projects WHERE project_id = ?',
      [id]
    );

    return response.success(res, `Project ${newStatus ? 'activated' : 'deactivated'} successfully`, rows[0]);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Upload media files for a project
exports.uploadMedia = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await req.db.query(
      'SELECT project_id FROM projects WHERE project_id = ? AND is_active = 1',
      [id]
    );

    if (existing.length === 0) {
      return response.error(res, 'Project not found', 404);
    }

    if (!req.files || req.files.length === 0) {
      return response.error(res, 'No files uploaded');
    }

    const inserted = [];

    for (const file of req.files) {
      const fileType = file.mimetype.startsWith('image/') ? 'image'
        : file.mimetype === 'application/pdf' ? 'document'
        : 'video';

      const fileUrl = `/uploads/projects/${file.filename}`;

      const [result] = await req.db.query(
        `INSERT INTO project_media (project_id, file_url, file_type, file_name, file_size)
         VALUES (?, ?, ?, ?, ?)`,
        [id, fileUrl, fileType, file.originalname, file.size]
      );

      const [media] = await req.db.query(
        'SELECT * FROM project_media WHERE id = ?',
        [result.insertId]
      );

      inserted.push(media[0]);
    }

    return response.success(res, 'Media uploaded successfully', inserted, 201);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Delete a media record and its file
exports.deleteMedia = async (req, res) => {
  try {
    const { id, mediaId } = req.params;

    const [media] = await req.db.query(
      'SELECT * FROM project_media WHERE id = ? AND project_id = ?',
      [mediaId, id]
    );

    if (media.length === 0) {
      return response.error(res, 'Media not found', 404);
    }

    // Delete file from disk
    const filePath = path.join('.', media[0].file_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await req.db.query(
      'DELETE FROM project_media WHERE id = ?',
      [mediaId]
    );

    return response.success(res, 'Media deleted successfully');
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Set a media as cover image (unset others first)
exports.setCoverImage = async (req, res) => {
  try {
    const { id, mediaId } = req.params;

    const [media] = await req.db.query(
      'SELECT * FROM project_media WHERE id = ? AND project_id = ?',
      [mediaId, id]
    );

    if (media.length === 0) {
      return response.error(res, 'Media not found', 404);
    }

    // Unset all covers for this project
    await req.db.query(
      'UPDATE project_media SET is_cover = 0 WHERE project_id = ?',
      [id]
    );

    // Set this media as cover
    await req.db.query(
      'UPDATE project_media SET is_cover = 1 WHERE id = ?',
      [mediaId]
    );

    const [updated] = await req.db.query(
      'SELECT * FROM project_media WHERE id = ?',
      [mediaId]
    );

    return response.success(res, 'Cover image set successfully', updated[0]);
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Get project stats: unit counts by status, total units, price range
exports.getStats = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await req.db.query(
      'SELECT project_id FROM projects WHERE project_id = ? AND is_active = 1',
      [id]
    );

    if (existing.length === 0) {
      return response.error(res, 'Project not found', 404);
    }

    const [statusCounts] = await req.db.query(
      `SELECT status, COUNT(*) AS count
       FROM properties
       WHERE project_id = ? AND is_active = 1
       GROUP BY status`,
      [id]
    );

    const [totals] = await req.db.query(
      `SELECT
         COUNT(*) AS total_units,
         MIN(price) AS min_price,
         MAX(price) AS max_price
       FROM properties
       WHERE project_id = ? AND is_active = 1`,
      [id]
    );

    return response.success(res, 'Project stats fetched successfully', {
      total_units: totals[0].total_units,
      min_price: totals[0].min_price,
      max_price: totals[0].max_price,
      by_status: statusCounts,
    });
  } catch (err) {
    return response.serverError(res, err);
  }
};

// Get inventory grouped by tower_id and floor for visual grid
exports.getInventory = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await req.db.query(
      'SELECT project_id FROM projects WHERE project_id = ? AND is_active = 1',
      [id]
    );

    if (existing.length === 0) {
      return response.error(res, 'Project not found', 404);
    }

    const [units] = await req.db.query(
      `SELECT p.prop_id, p.unit_number, p.tower_id, p.floor, p.configuration,
              p.carpet_area, p.price, p.status,
              t.tower_name
       FROM properties p
       LEFT JOIN project_towers t ON t.id = p.tower_id
       WHERE p.project_id = ? AND p.is_active = 1
       ORDER BY t.tower_name ASC, p.floor ASC, p.unit_number ASC`,
      [id]
    );

    // Group by tower, then by floor
    const inventory = {};
    for (const unit of units) {
      const towerKey = unit.tower_id || 'unassigned';
      const towerName = unit.tower_name || 'Unassigned';
      const floorKey = unit.floor || 0;

      if (!inventory[towerKey]) {
        inventory[towerKey] = { tower_id: unit.tower_id, tower_name: towerName, floors: {} };
      }
      if (!inventory[towerKey].floors[floorKey]) {
        inventory[towerKey].floors[floorKey] = [];
      }
      inventory[towerKey].floors[floorKey].push(unit);
    }

    return response.success(res, 'Inventory fetched successfully', inventory);
  } catch (err) {
    return response.serverError(res, err);
  }
};
