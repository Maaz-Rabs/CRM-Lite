const response = require('../utils/response');
const fs = require('fs');
const path = require('path');

/**
 * GET /api/properties
 * List properties with search, status, type, project filters and pagination
 */
const getAll = async (req, res) => {
  try {
    const {
      search = '',
      status,
      property_type,
      project_id,
      page = 1,
      limit = 20,
    } = req.query;

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const limitVal = parseInt(limit);

    let where = 'WHERE p.is_active = 1';
    const params = [];

    if (search) {
      where += ' AND (p.title LIKE ? OR p.location LIKE ? OR p.address LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (status) {
      where += ' AND p.status = ?';
      params.push(status);
    }

    if (property_type) {
      where += ' AND p.property_type = ?';
      params.push(property_type);
    }

    if (project_id) {
      where += ' AND p.project_id = ?';
      params.push(parseInt(project_id));
    }

    // Count query
    const [countRows] = await req.db.query(
      `SELECT COUNT(*) AS total FROM properties p ${where}`,
      params
    );
    const total = countRows[0].total;

    // Data query with project name join (fixed: pr.name AS project_name)
    const [rows] = await req.db.query(
      `SELECT p.*, pr.name AS project_name
       FROM properties p
       LEFT JOIN projects pr ON p.project_id = pr.project_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitVal, offset]
    );

    return response.success(res, 'Properties fetched successfully', {
      properties: rows,
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

/**
 * GET /api/properties/:id
 * Get single property with project name joined
 */
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await req.db.query(
      `SELECT p.*, pr.name AS project_name
       FROM properties p
       LEFT JOIN projects pr ON p.project_id = pr.project_id
       WHERE p.prop_id = ? AND p.is_active = 1`,
      [id]
    );

    if (rows.length === 0) {
      return response.error(res, 'Property not found', 404);
    }

    const property = rows[0];

    // Fetch media
    const [media] = await req.db.query(
      'SELECT * FROM property_media WHERE prop_id = ? ORDER BY is_cover DESC, sort_order ASC, media_id ASC',
      [id]
    );
    property.media = media || [];

    // Fetch history
    const [history] = await req.db.query(
      'SELECT * FROM property_history WHERE prop_id = ? ORDER BY created_at DESC LIMIT 20',
      [id]
    );
    property.history = history || [];

    return response.success(res, 'Property fetched successfully', property);
  } catch (err) {
    return response.serverError(res, err);
  }
};

/**
 * POST /api/properties
 * Create a new property (with new fields)
 */
const create = async (req, res) => {
  try {
    const {
      project_id, title, description, property_type, configuration,
      location, address, price, price_unit, area, area_unit,
      bedrooms, bathrooms, floor, total_floors, furnishing, facing,
      amenities, images, status, listed_by,
      unit_number, tower_id, carpet_area, builtup_area, super_builtup_area,
      base_price, price_per_sqft, owner_type, owner_name, owner_contact,
      parking, balconies, rera_id,
    } = req.body;

    if (!title) {
      return response.error(res, 'Title is required');
    }

    const [result] = await req.db.query(
      `INSERT INTO properties
       (project_id, title, description, property_type, configuration,
        location, address, price, price_unit, area, area_unit,
        bedrooms, bathrooms, floor, total_floors, furnishing, facing,
        amenities, images, status, listed_by,
        unit_number, tower_id, carpet_area, builtup_area, super_builtup_area,
        base_price, price_per_sqft, owner_type, owner_name, owner_contact,
        parking, balconies, rera_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project_id || null, title, description || null, property_type || null,
        configuration || null, location || null, address || null,
        price || null, price_unit || 'INR', area || null, area_unit || 'sqft',
        bedrooms || null, bathrooms || null, floor || null, total_floors || null,
        furnishing || null, facing || null,
        amenities ? (typeof amenities === 'string' ? amenities : JSON.stringify(amenities)) : null,
        images ? (typeof images === 'string' ? images : JSON.stringify(images)) : null,
        status || 'available', listed_by || null,
        unit_number || null, tower_id || null, carpet_area || null,
        builtup_area || null, super_builtup_area || null,
        base_price || null, price_per_sqft || null,
        owner_type || null, owner_name || null, owner_contact || null,
        parking || null, balconies || null, rera_id || null,
      ]
    );

    const [newProperty] = await req.db.query(
      'SELECT * FROM properties WHERE prop_id = ?',
      [result.insertId]
    );

    return response.success(res, 'Property created successfully', newProperty[0], 201);
  } catch (err) {
    return response.serverError(res, err);
  }
};

/**
 * PUT /api/properties/:id
 * Update a property with auto-logging to property_history on status/price changes
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;

    // Check existence and get current values for change tracking
    const [existing] = await req.db.query(
      'SELECT * FROM properties WHERE prop_id = ? AND is_active = 1',
      [id]
    );

    if (existing.length === 0) {
      return response.error(res, 'Property not found', 404);
    }

    const oldProperty = existing[0];

    const fields = [
      'project_id', 'title', 'description', 'property_type', 'configuration',
      'location', 'address', 'price', 'price_unit', 'area', 'area_unit',
      'bedrooms', 'bathrooms', 'floor', 'total_floors', 'furnishing', 'facing',
      'amenities', 'images', 'status', 'listed_by',
      'unit_number', 'tower_id', 'carpet_area', 'builtup_area', 'super_builtup_area',
      'base_price', 'price_per_sqft', 'owner_type', 'owner_name', 'owner_contact',
      'parking', 'balconies', 'rera_id',
    ];

    const setClauses = [];
    const params = [];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        let value = req.body[field];
        if ((field === 'amenities' || field === 'images') && typeof value !== 'string') {
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
      `UPDATE properties SET ${setClauses.join(', ')} WHERE prop_id = ?`,
      params
    );

    // Auto-log status changes to property_history
    if (req.body.status !== undefined && req.body.status !== oldProperty.status) {
      await req.db.query(
        `INSERT INTO property_history (prop_id, action, old_value, new_value, changed_by)
         VALUES (?, 'status', ?, ?, ?)`,
        [id, oldProperty.status || null, req.body.status, req.user ? req.user.userId : null]
      );
    }

    // Auto-log price changes to property_history
    if (req.body.price !== undefined && String(req.body.price) !== String(oldProperty.price)) {
      await req.db.query(
        `INSERT INTO property_history (prop_id, action, old_value, new_value, changed_by)
         VALUES (?, 'price', ?, ?, ?)`,
        [id, oldProperty.price ? String(oldProperty.price) : null, String(req.body.price), req.user ? req.user.userId : null]
      );
    }

    // Auto-log base_price changes to property_history
    if (req.body.base_price !== undefined && String(req.body.base_price) !== String(oldProperty.base_price)) {
      await req.db.query(
        `INSERT INTO property_history (prop_id, action, old_value, new_value, changed_by)
         VALUES (?, 'base_price', ?, ?, ?)`,
        [id, oldProperty.base_price ? String(oldProperty.base_price) : null, String(req.body.base_price), req.user ? req.user.userId : null]
      );
    }

    const [updated] = await req.db.query(
      'SELECT * FROM properties WHERE prop_id = ?',
      [id]
    );

    return response.success(res, 'Property updated successfully', updated[0]);
  } catch (err) {
    return response.serverError(res, err);
  }
};

/**
 * DELETE /api/properties/:id
 * Soft delete (set is_active = 0)
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await req.db.query(
      'SELECT prop_id FROM properties WHERE prop_id = ? AND is_active = 1',
      [id]
    );

    if (existing.length === 0) {
      return response.error(res, 'Property not found', 404);
    }

    await req.db.query(
      'UPDATE properties SET is_active = 0 WHERE prop_id = ?',
      [id]
    );

    return response.success(res, 'Property deleted successfully');
  } catch (err) {
    return response.serverError(res, err);
  }
};

/**
 * GET /api/properties/stats
 * Get property counts by status
 */
const getStats = async (req, res) => {
  try {
    const [rows] = await req.db.query(
      `SELECT status, COUNT(*) AS count
       FROM properties
       WHERE is_active = 1
       GROUP BY status`
    );

    const [totalRows] = await req.db.query(
      'SELECT COUNT(*) AS total FROM properties WHERE is_active = 1'
    );

    return response.success(res, 'Property stats fetched successfully', {
      total: totalRows[0].total,
      byStatus: rows,
    });
  } catch (err) {
    return response.serverError(res, err);
  }
};

/**
 * POST /api/properties/:id/media
 * Upload media files for a property
 */
const uploadMedia = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await req.db.query(
      'SELECT prop_id FROM properties WHERE prop_id = ? AND is_active = 1',
      [id]
    );

    if (existing.length === 0) {
      return response.error(res, 'Property not found', 404);
    }

    if (!req.files || req.files.length === 0) {
      return response.error(res, 'No files uploaded');
    }

    const inserted = [];

    for (const file of req.files) {
      const fileType = file.mimetype.startsWith('image/') ? 'image'
        : file.mimetype === 'application/pdf' ? 'document'
        : 'video';

      const fileUrl = `/uploads/properties/${file.filename}`;

      const [result] = await req.db.query(
        `INSERT INTO property_media (prop_id, file_url, media_type, file_name, file_size)
         VALUES (?, ?, ?, ?, ?)`,
        [id, fileUrl, fileType, file.originalname, file.size]
      );

      const [media] = await req.db.query(
        'SELECT * FROM property_media WHERE media_id = ?',
        [result.insertId]
      );

      inserted.push(media[0]);
    }

    return response.success(res, 'Media uploaded successfully', inserted, 201);
  } catch (err) {
    return response.serverError(res, err);
  }
};

/**
 * DELETE /api/properties/:id/media/:mediaId
 * Delete a media record and its file
 */
const deleteMedia = async (req, res) => {
  try {
    const { id, mediaId } = req.params;

    const [media] = await req.db.query(
      'SELECT * FROM property_media WHERE media_id = ? AND prop_id = ?',
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
      'DELETE FROM property_media WHERE media_id = ?',
      [mediaId]
    );

    return response.success(res, 'Media deleted successfully');
  } catch (err) {
    return response.serverError(res, err);
  }
};

/**
 * GET /api/properties/:id/history
 * Get property change history
 */
const getHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await req.db.query(
      'SELECT prop_id FROM properties WHERE prop_id = ?',
      [id]
    );

    if (existing.length === 0) {
      return response.error(res, 'Property not found', 404);
    }

    const [history] = await req.db.query(
      `SELECT ph.*, u.username AS changed_by_name
       FROM property_history ph
       LEFT JOIN users u ON ph.changed_by = u.user_id
       WHERE ph.prop_id = ?
       ORDER BY ph.created_at DESC`,
      [id]
    );

    return response.success(res, 'Property history fetched successfully', history);
  } catch (err) {
    return response.serverError(res, err);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  getStats,
  uploadMedia,
  deleteMedia,
  getHistory,
};
