// ============================================================================
// LEAD PRIORITY CONTROLLER
// Handles all lead priority CRUD operations
// ============================================================================

const LeadPriority = require('../models/LeadPriority');
const response = require('../utils/response');

/**
 * GET /api/lead-priorities
 * Get all active lead priorities
 */
const getAll = async (req, res) => {
  try {
    const priorities = await LeadPriority.getAll(req.db, req.user.userId, req.user.roleSlug);

    return response.success(res, 'Lead priorities fetched successfully', {
      priorities,
      count: priorities.length,
    });
  } catch (err) {
    console.error('[LEAD PRIORITY] getAll error:', err);
    return response.serverError(res, err);
  }
};

/**
 * GET /api/lead-priorities/all
 * Get all lead priorities including inactive (admin only)
 */
const getAllAdmin = async (req, res) => {
  try {
    const priorities = await LeadPriority.getAllAdmin(req.db);

    return response.success(res, 'All lead priorities fetched', {
      priorities,
      count: priorities.length,
    });
  } catch (err) {
    console.error('[LEAD PRIORITY] getAllAdmin error:', err);
    return response.serverError(res, err);
  }
};

/**
 * POST /api/lead-priorities
 * Create new lead priority
 * Body: { name }
 */
const create = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return response.error(res, 'Priority name is required', 400);
    }

    if (name.trim().length > 100) {
      return response.error(res, 'Priority name must be less than 100 characters', 400);
    }

    // Check for duplicate name
    const existing = await LeadPriority.getByName(req.db, name);
    if (existing) {
      return response.error(res, 'A priority with this name already exists', 400);
    }

    const lpId = await LeadPriority.create(req.db, { name: name.trim() });
    const priority = await LeadPriority.getById(req.db, lpId);

    return response.success(res, 'Lead priority created successfully', { priority }, 201);
  } catch (err) {
    console.error('[LEAD PRIORITY] create error:', err);
    return response.serverError(res, err);
  }
};

/**
 * PUT /api/lead-priorities/:id
 * Update lead priority
 * Body: { name?, is_active? }
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;

    if (!id || isNaN(id)) {
      return response.error(res, 'Invalid priority ID', 400);
    }

    const lpId = parseInt(id);

    const existing = await LeadPriority.getById(req.db, lpId);
    if (!existing) {
      return response.error(res, 'Lead priority not found', 404);
    }

    // If renaming, check for duplicate
    if (name && name.trim() !== existing.name) {
      const duplicate = await LeadPriority.getByName(req.db, name);
      if (duplicate && duplicate.lp_id !== lpId) {
        return response.error(res, 'A priority with this name already exists', 400);
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (is_active !== undefined) updateData.is_active = is_active;

    const updated = await LeadPriority.update(req.db, lpId, updateData);

    if (!updated) {
      return response.error(res, 'No changes made', 400);
    }

    const priority = await LeadPriority.getById(req.db, lpId);

    return response.success(res, 'Lead priority updated successfully', { priority });
  } catch (err) {
    console.error('[LEAD PRIORITY] update error:', err);
    return response.serverError(res, err);
  }
};

/**
 * DELETE /api/lead-priorities/:id
 * Delete lead priority (soft delete)
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return response.error(res, 'Invalid priority ID', 400);
    }

    const lpId = parseInt(id);

    const existing = await LeadPriority.getById(req.db, lpId);
    if (!existing) {
      return response.error(res, 'Lead priority not found', 404);
    }

    const deleted = await LeadPriority.softDelete(req.db, lpId);

    if (!deleted) {
      return response.error(res, 'Failed to delete priority', 400);
    }

    return response.success(res, 'Lead priority deleted successfully');
  } catch (err) {
    console.error('[LEAD PRIORITY] remove error:', err);
    return response.serverError(res, err);
  }
};

module.exports = {
  getAll,
  getAllAdmin,
  create,
  update,
  remove,
};
