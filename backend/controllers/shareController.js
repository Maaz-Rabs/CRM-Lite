const crypto = require('crypto');
const response = require('../utils/response');

// ============================================================================
// SHARE CONTROLLER
// Public sharing of projects and properties via encrypted token links
// ============================================================================

/**
 * POST /api/share
 * Create a share link for a project or property
 */
exports.createShareLink = async (req, res) => {
  try {
    const { entity_type, entity_id } = req.body;

    if (!entity_type || !entity_id) {
      return response.error(res, 'entity_type and entity_id are required');
    }

    if (!['project', 'property'].includes(entity_type)) {
      return response.error(res, 'entity_type must be "project" or "property"');
    }

    // Check if entity exists
    const table = entity_type === 'project' ? 'projects' : 'properties';
    const idCol = entity_type === 'project' ? 'project_id' : 'prop_id';
    const [entityRows] = await req.db.query(
      `SELECT ${idCol} FROM ${table} WHERE ${idCol} = ? AND is_active = 1`,
      [entity_id]
    );

    if (entityRows.length === 0) {
      return response.error(res, `${entity_type} not found`, 404);
    }

    // Check if an active link already exists for this entity
    const [existing] = await req.db.query(
      `SELECT * FROM shared_links
       WHERE entity_type = ? AND entity_id = ? AND is_active = 1
       AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [entity_type, entity_id]
    );

    if (existing.length > 0) {
      const link = existing[0];
      const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
      return response.success(res, 'Share link already exists', {
        link_id: link.link_id,
        share_token: link.share_token,
        share_url: `${BASE_URL}/shared/${link.share_token}`,
        entity_type: link.entity_type,
        entity_id: link.entity_id,
        view_count: link.view_count,
        created_at: link.created_at,
        expires_at: link.expires_at,
      });
    }

    // Generate a crypto random token (32 bytes hex = 64 chars)
    const shareToken = crypto.randomBytes(32).toString('hex');

    const [result] = await req.db.query(
      `INSERT INTO shared_links (share_token, entity_type, entity_id, shared_by, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [shareToken, entity_type, entity_id, req.user.userId]
    );

    const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

    return response.success(res, 'Share link created successfully', {
      link_id: result.insertId,
      share_token: shareToken,
      share_url: `${BASE_URL}/shared/${shareToken}`,
      entity_type,
      entity_id: parseInt(entity_id),
      view_count: 0,
      created_at: new Date().toISOString(),
      expires_at: null,
    }, 201);
  } catch (err) {
    return response.serverError(res, err);
  }
};

/**
 * GET /api/shared/:token
 * Public endpoint - no auth required
 * Fetch shared content and track views
 */
exports.getSharedContent = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || token.length < 10) {
      return response.error(res, 'Invalid share token', 400);
    }

    // Look up the token
    const [links] = await req.db.query(
      'SELECT * FROM shared_links WHERE share_token = ? LIMIT 1',
      [token]
    );

    if (links.length === 0) {
      return response.error(res, 'Share link not found or invalid', 404);
    }

    const link = links[0];

    // Check if active
    if (!link.is_active) {
      return response.error(res, 'This share link has been deactivated', 410);
    }

    // Check if expired
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return response.error(res, 'This share link has expired', 410);
    }

    // Increment view count
    await req.db.query(
      'UPDATE shared_links SET view_count = view_count + 1 WHERE link_id = ?',
      [link.link_id]
    );

    // Log the view
    const ipAddress = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || req.ip || null;
    const userAgent = req.headers['user-agent'] || null;

    await req.db.query(
      `INSERT INTO shared_link_views (link_id, ip_address, user_agent, viewed_at)
       VALUES (?, ?, ?, NOW())`,
      [link.link_id, ipAddress, userAgent ? userAgent.substring(0, 500) : null]
    );

    let data = null;

    if (link.entity_type === 'project') {
      // Fetch project with media
      const [projectRows] = await req.db.query(
        'SELECT * FROM projects WHERE project_id = ? AND is_active = 1',
        [link.entity_id]
      );

      if (projectRows.length === 0) {
        return response.error(res, 'Project not found or has been removed', 404);
      }

      const project = projectRows[0];

      // Fetch project media
      const [mediaRows] = await req.db.query(
        'SELECT * FROM project_media WHERE project_id = ? ORDER BY is_cover DESC, media_id ASC',
        [link.entity_id]
      );

      data = {
        entity_type: 'project',
        project: {
          ...project,
          media: mediaRows,
        },
        view_count: link.view_count + 1,
      };
    } else if (link.entity_type === 'property') {
      // Fetch property with media and project name
      const [propertyRows] = await req.db.query(
        `SELECT pr.*, p.name AS project_name, p.developer, p.location AS project_location
         FROM properties pr
         LEFT JOIN projects p ON p.project_id = pr.project_id
         WHERE pr.prop_id = ? AND pr.is_active = 1`,
        [link.entity_id]
      );

      if (propertyRows.length === 0) {
        return response.error(res, 'Property not found or has been removed', 404);
      }

      const property = propertyRows[0];

      // Fetch property media
      const [mediaRows] = await req.db.query(
        'SELECT * FROM property_media WHERE prop_id = ? ORDER BY is_cover DESC, media_id ASC',
        [link.entity_id]
      );

      data = {
        entity_type: 'property',
        property: {
          ...property,
          media: mediaRows,
        },
        view_count: link.view_count + 1,
      };
    }

    return response.success(res, 'Shared content fetched successfully', data);
  } catch (err) {
    return response.serverError(res, err);
  }
};

/**
 * GET /api/share/:linkId/stats
 * Get share link statistics (authenticated)
 */
exports.getShareStats = async (req, res) => {
  try {
    const { linkId } = req.params;

    // Get link details
    const [links] = await req.db.query(
      'SELECT * FROM shared_links WHERE link_id = ?',
      [linkId]
    );

    if (links.length === 0) {
      return response.error(res, 'Share link not found', 404);
    }

    const link = links[0];

    // Get recent views (last 20)
    const [views] = await req.db.query(
      `SELECT view_id, ip_address, user_agent, viewed_at
       FROM shared_link_views
       WHERE link_id = ?
       ORDER BY viewed_at DESC
       LIMIT 20`,
      [linkId]
    );

    const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

    return response.success(res, 'Share stats fetched successfully', {
      link_id: link.link_id,
      share_token: link.share_token,
      share_url: `${BASE_URL}/shared/${link.share_token}`,
      entity_type: link.entity_type,
      entity_id: link.entity_id,
      shared_by: link.shared_by,
      is_active: link.is_active,
      view_count: link.view_count,
      created_at: link.created_at,
      expires_at: link.expires_at,
      recent_views: views,
    });
  } catch (err) {
    return response.serverError(res, err);
  }
};

/**
 * DELETE /api/share/:linkId
 * Deactivate a share link (authenticated)
 */
exports.deactivateLink = async (req, res) => {
  try {
    const { linkId } = req.params;

    const [links] = await req.db.query(
      'SELECT * FROM shared_links WHERE link_id = ?',
      [linkId]
    );

    if (links.length === 0) {
      return response.error(res, 'Share link not found', 404);
    }

    await req.db.query(
      'UPDATE shared_links SET is_active = 0 WHERE link_id = ?',
      [linkId]
    );

    return response.success(res, 'Share link deactivated successfully');
  } catch (err) {
    return response.serverError(res, err);
  }
};
