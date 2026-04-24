// ============================================================================
// LEAD STATUS CONTROLLER
// Handles all lead status CRUD operations
// ============================================================================

const LeadStatus = require('../models/LeadStatus');
const response = require('../utils/response');

/**
 * GET /api/lead-statuses
 * Get all active lead statuses
 */
const getAll = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.roleSlug;
    const statuses = await LeadStatus.getAll(req.db, userId, userRole);

    return response.success(res, 'Lead statuses fetched successfully', {
      statuses,
      count: statuses.length,
    });
  } catch (err) {
    console.error('[LEAD STATUS] getAll error:', err);
    return response.serverError(res, err);
  }
};

/**
 * GET /api/lead-statuses/all
 * Get all lead statuses including inactive (admin only)
 */
const getAllAdmin = async (req, res) => {
  try {
    const statuses = await LeadStatus.getAllAdmin(req.db);

    return response.success(res, 'All lead statuses fetched', {
      statuses,
      count: statuses.length,
    });
  } catch (err) {
    console.error('[LEAD STATUS] getAllAdmin error:', err);
    return response.serverError(res, err);
  }
};

/**
 * GET /api/lead-statuses/:id
 * Get single lead status by ID
 */
const getById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return response.error(res, 'Invalid status ID', 400);
    }

    const status = await LeadStatus.getById(req.db, parseInt(id));

    if (!status) {
      return response.error(res, 'Lead status not found', 404);
    }

    return response.success(res, 'Lead status fetched', { status });
  } catch (err) {
    console.error('[LEAD STATUS] getById error:', err);
    return response.serverError(res, err);
  }
};

/**
 * POST /api/lead-statuses
 * Create new lead status
 * Body: { name, color, include_in_all }
 */
const create = async (req, res) => {
  try {
    const { name, color, include_in_all } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return response.error(res, 'Status name is required', 400);
    }

    if (name.trim().length > 100) {
      return response.error(
        res,
        'Status name must be less than 100 characters',
        400,
      );
    }

    // Validate color format (optional, default will be used)
    let statusColor = color || '#808080';
    if (!/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(statusColor)) {
      statusColor = '#808080'; // Default if invalid
    }

    // Check for duplicate name
    const existing = await LeadStatus.getByName(req.db, name);
    if (existing) {
      return response.error(res, 'A status with this name already exists', 400);
    }

    // Create status
    const lsId = await LeadStatus.create(req.db, {
      name: name.trim(),
      color: statusColor,
      include_in_all: include_in_all !== false ? 1 : 0,
    });

    // Fetch created status
    const status = await LeadStatus.getById(req.db, lsId);

    return response.success(
      res,
      'Lead status created successfully',
      { status },
      201,
    );
  } catch (err) {
    console.error('[LEAD STATUS] create error:', err);
    return response.serverError(res, err);
  }
};

/**
 * PUT /api/lead-statuses/:id
 * Update lead status
 * Body: { name?, color?, include_in_all?, is_active? }
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, include_in_all, is_active, display_order } = req.body;

    if (!id || isNaN(id)) {
      return response.error(res, 'Invalid status ID', 400);
    }

    const lsId = parseInt(id);

    // Check if status exists
    const existing = await LeadStatus.getById(req.db, lsId);
    if (!existing) {
      return response.error(res, 'Lead status not found', 404);
    }

    // If renaming, check for duplicate
    if (name && name.trim() !== existing.name) {
      const duplicate = await LeadStatus.getByName(req.db, name);
      if (duplicate && duplicate.ls_id !== lsId) {
        return response.error(
          res,
          'A status with this name already exists',
          400,
        );
      }
    }

    // Validate color format if provided
    let statusColor = color;
    if (color && !/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(color)) {
      statusColor = undefined; // Don't update if invalid
    }

    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (statusColor !== undefined) updateData.color = statusColor;
    if (include_in_all !== undefined)
      updateData.include_in_all = include_in_all;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (display_order !== undefined) updateData.display_order = display_order;

    // Update
    const updated = await LeadStatus.update(req.db, lsId, updateData);

    if (!updated) {
      return response.error(res, 'No changes made', 400);
    }

    // Fetch updated status
    const status = await LeadStatus.getById(req.db, lsId);

    return response.success(res, 'Lead status updated successfully', {
      status,
    });
  } catch (err) {
    console.error('[LEAD STATUS] update error:', err);
    return response.serverError(res, err);
  }
};

/**
 * DELETE /api/lead-statuses/:id
 * Delete lead status (soft delete by default)
 * Query: ?hard=true for permanent delete
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const { hard } = req.query;

    if (!id || isNaN(id)) {
      return response.error(res, 'Invalid status ID', 400);
    }

    const lsId = parseInt(id);

    // Check if status exists
    const existing = await LeadStatus.getById(req.db, lsId);
    if (!existing) {
      return response.error(res, 'Lead status not found', 404);
    }

    // Cannot delete system statuses
    if (existing.is_system === 1) {
      return response.error(res, 'Cannot delete system status', 400);
    }

    let deleted;
    if (hard === 'true') {
      // Hard delete
      deleted = await LeadStatus.hardDelete(req.db, lsId);
    } else {
      // Soft delete (deactivate)
      deleted = await LeadStatus.softDelete(req.db, lsId);
    }

    if (!deleted) {
      return response.error(res, 'Failed to delete status', 400);
    }

    return response.success(res, 'Lead status deleted successfully');
  } catch (err) {
    console.error('[LEAD STATUS] remove error:', err);
    return response.serverError(res, err);
  }
};

/**
 * PUT /api/lead-statuses/reorder
 * Reorder statuses
 * Body: { order: [{ ls_id: 1, display_order: 1 }, ...] }
 */
const reorder = async (req, res) => {
  try {
    const { order } = req.body;

    if (!order || !Array.isArray(order) || order.length === 0) {
      return response.error(res, 'Order array is required', 400);
    }

    // Validate each item
    for (const item of order) {
      if (!item.ls_id || item.display_order === undefined) {
        return response.error(
          res,
          'Each item must have ls_id and display_order',
          400,
        );
      }
    }

    await LeadStatus.reorder(req.db, order);

    // Fetch updated list
    const statuses = await LeadStatus.getAll(req.db);

    return response.success(res, 'Statuses reordered successfully', {
      statuses,
    });
  } catch (err) {
    console.error('[LEAD STATUS] reorder error:', err);
    return response.serverError(res, err);
  }
};

module.exports = {
  getAll,
  getAllAdmin,
  getById,
  create,
  update,
  remove,
  reorder,
};
