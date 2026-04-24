/**
 * Lead Controller
 * Handles all lead-related API endpoints
 */

const Lead = require('../models/Lead');
const response = require('../utils/response');
const { sendNotification, storeNotification } = require('../services/notificationService');
const { autoAssignLead } = require('../routes/leadScheduling');

/**
 * Create a new lead
 * POST /api/leads
 */
const createLead = async (req, res) => {
  try {
    const leadModel = new Lead(req.db);
    const userId = req.user.userId;

    const {
      source_type, src_id, broker_id,
      ref_name, ref_country_code, ref_mobile, ref_email,
      name, country_code, mobile, email,
      alt_country_code, alt_mobile, alt_email,
      country, state, city, locality, sub_locality,
      buyer_type, investment_type,
      ls_id, lp_id,
      initial_message,
      requirements,
    } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return response.error(res, 'Name is required');
    }

    if (!mobile || !mobile.trim()) {
      return response.error(res, 'Mobile number is required');
    }

    // Check for duplicate mobile
    const [existing] = await req.db.query(
      'SELECT l_id FROM leads WHERE mobile = ? AND is_archived = 0 LIMIT 1',
      [mobile.trim()]
    );

    if (existing.length > 0) {
      return response.error(res, 'Lead with this mobile number already exists');
    }

    // Create lead
    const lead = await leadModel.create({
      source_type, src_id, broker_id,
      ref_name, ref_country_code, ref_mobile, ref_email,
      name: name.trim(),
      country_code: country_code || '+91',
      mobile: mobile.trim(),
      email: email?.trim() || null,
      alt_country_code, alt_mobile: alt_mobile?.trim() || null, alt_email: alt_email?.trim() || null,
      country, state, city, locality, sub_locality,
      buyer_type, investment_type,
      ls_id, lp_id,
      initial_message,
      requirements,
    }, userId);

    // Auto-assign: first try schedule rules, fallback to creator self-assign
    const userRole = req.user.roleSlug;
    if (lead?.l_id) {
      let scheduledUser = null;
      try {
        scheduledUser = await autoAssignLead(req.db, lead.l_id, {
          create_dt: new Date(),
          src_id: req.body.src_id || null,
          city: req.body.city || null,
        });
      } catch (e) {
        console.log('[LEAD-SCHEDULE] Auto-assign skipped:', e.message);
      }

      // If no schedule matched AND user is not admin, self-assign
      if (!scheduledUser && userRole !== 'master' && userRole !== 'admin') {
        await req.db.query(
          `INSERT INTO lead_assignments (l_id, u_id, assigned_by, is_active) VALUES (?, ?, ?, 1)`,
          [lead.l_id, userId, userId]
        );
      }
    }

    return response.success(res, 'Lead created successfully', { lead }, 201);

  } catch (err) {
    console.error('Create lead error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Get all leads
 * GET /api/leads
 */
const getLeads = async (req, res) => {
  try {
    const leadModel = new Lead(req.db);
    const userId = req.user.userId;
    const userRole = req.user.roleSlug;

    const {
      status, statuses, priority, priorities, source, sources,
      service_types, projects, property_types, configurations, assigned_to,
      search, has_followup, followup_from, followup_to, followup_filter,
      created_from, created_to, assign_status, is_fresh, no_status, is_imported, exclude_imported, form_name,
      broker_id,
      page = 1, limit = 20,
    } = req.query;

    const result = await leadModel.findAll(
      {
        status, statuses, priority, priorities, source, sources,
        service_types, projects, property_types, configurations, assigned_to,
        search,
        has_followup: has_followup === 'true' ? true : has_followup === 'false' ? false : undefined,
        followup_from, followup_to, followup_filter,
        created_from, created_to, assign_status,
        is_fresh: is_fresh === 'true' ? true : is_fresh === 'false' ? false : undefined,
        no_status: no_status === 'true' ? true : undefined,
        is_imported: is_imported === 'true' ? true : undefined,
        exclude_imported: exclude_imported === 'true' ? true : undefined,
        form_name,
        broker_id: broker_id || undefined,
      },
      userId,
      userRole,
      { page: parseInt(page), limit: parseInt(limit) }
    );

    return response.success(res, 'Leads fetched successfully', result);

  } catch (err) {
    console.error('Get leads error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Get single lead by ID
 * GET /api/leads/:id
 */
const getLead = async (req, res) => {
  try {
    const leadModel = new Lead(req.db);
    const { id } = req.params;

    const lead = await leadModel.findById(id);

    if (!lead) {
      return response.error(res, 'Lead not found', 404);
    }

    // Mark lead as viewed if not already + assign "Open Lead" status if no status set
    if (!lead.is_viewed) {
      await req.db.query('UPDATE leads SET is_viewed = 1 WHERE l_id = ?', [id]);
      lead.is_viewed = 1;

      // If no status assigned, set "Open Lead" (or whatever is_default = 1)
      if (!lead.ls_id) {
        // Find or create the "Open Lead" default status
        let [openStatus] = await req.db.query(
          `SELECT ls_id FROM lead_statuses WHERE (is_default = 1 OR LOWER(name) = 'open lead' OR LOWER(name) = 'open leads') AND (is_active = 1 OR is_active IS NULL) LIMIT 1`
        );
        if (openStatus.length === 0) {
          // Create "Open Lead" as system default if doesn't exist
          try {
            const [ins] = await req.db.query(
              `INSERT INTO lead_statuses (name, color, is_default, is_system, is_active, display_order) VALUES ('Open Lead', '#E91E63', 1, 1, 1, 1)`
            );
            openStatus = [{ ls_id: ins.insertId }];
          } catch (e) {
            // Try without new columns
            try {
              const [ins2] = await req.db.query(
                `INSERT INTO lead_statuses (name, color) VALUES ('Open Lead', '#E91E63')`
              );
              openStatus = [{ ls_id: ins2.insertId }];
            } catch (e2) {}
          }
        }
        if (openStatus.length > 0) {
          await req.db.query('UPDATE leads SET ls_id = ? WHERE l_id = ?', [openStatus[0].ls_id, id]);
          lead.ls_id = openStatus[0].ls_id;

          // Log activity
          await req.db.query(
            `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source)
             VALUES (?, ?, 'system', 'Status set to Open Lead', 'mobile')`,
            [id, req.user.userId]
          );
        }
      }
    }

    // Fetch activities/timeline
    const [activities] = await req.db.query(
      `SELECT la.*, u.username as user_name
       FROM lead_activities la
       LEFT JOIN users u ON la.u_id = u.u_id
       WHERE la.l_id = ?
       ORDER BY la.create_dt DESC
       LIMIT 50`,
      [id]
    );

    lead.activities = activities || [];

    return response.success(res, 'Lead fetched successfully', { lead });

  } catch (err) {
    console.error('Get lead error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Update lead
 * PUT /api/leads/:id
 */
const updateLead = async (req, res) => {
  try {
    const leadModel = new Lead(req.db);
    const userId = req.user.userId;
    const { id } = req.params;

    // Check if lead exists
    const existing = await leadModel.findById(id);
    if (!existing) {
      return response.error(res, 'Lead not found', 404);
    }

    // Check if locked
    if (existing.is_locked) {
      return response.error(res, 'Lead is locked and cannot be edited', 403);
    }

    // Update lead
    const lead = await leadModel.update(id, req.body, userId);

    // Update requirements if provided
    if (req.body.requirements) {
      await leadModel.updateRequirements(id, req.body.requirements);
    }

    // Fetch updated lead with requirements
    const updatedLead = await leadModel.findById(id);

    return response.success(res, 'Lead updated successfully', { lead: updatedLead });

  } catch (err) {
    console.error('Update lead error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Delete (archive) lead
 * DELETE /api/leads/:id
 */
const deleteLead = async (req, res) => {
  try {
    const leadModel = new Lead(req.db);
    const userId = req.user.userId;
    const userRole = req.user.roleSlug;
    const { id } = req.params;

    // Check if lead exists
    const existing = await leadModel.findById(id);
    if (!existing) {
      return response.error(res, 'Lead not found', 404);
    }

    // Get user name for activity log
    const [userRows] = await req.db.query(
      `SELECT CONCAT(COALESCE(up.first_name, u.username), ' ', COALESCE(up.last_name, '')) as name
       FROM users u LEFT JOIN user_profiles up ON u.u_id = up.u_id
       WHERE u.u_id = ?`,
      [userId]
    );
    const userName = userRows[0]?.name?.trim() || 'User';

    if (userRole === 'master' || userRole === 'admin') {
      // Master/Admin: soft delete (archive)
      await req.db.query('UPDATE leads SET is_archived = 1 WHERE l_id = ?', [id]);

      await req.db.query(
        `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source)
         VALUES (?, ?, 'system', 'Lead archived', 'mobile')`,
        [id, userId]
      );

      return response.success(res, 'Lead deleted successfully');
    } else {
      // Regular user: unassign from this user, lead goes back to master/admin
      await req.db.query(
        'UPDATE lead_assignments SET is_active = 0 WHERE l_id = ? AND u_id = ?',
        [id, userId]
      );

      // Check if any other active assignments remain
      const [remaining] = await req.db.query(
        'SELECT COUNT(*) as cnt FROM lead_assignments WHERE l_id = ? AND is_active = 1',
        [id]
      );

      if (remaining[0].cnt === 0) {
        await req.db.query(
          `UPDATE leads SET assign_status = 'unassigned' WHERE l_id = ?`,
          [id]
        );
      }

      // Log activity in timeline
      await req.db.query(
        `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source)
         VALUES (?, ?, 'system', ?, 'mobile')`,
        [id, userId, `Lead unassigned from ${userName}`]
      );

      return response.success(res, 'Lead removed from your list');
    }

  } catch (err) {
    console.error('Delete lead error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Get master data for dropdowns
 * GET /api/leads/master-data
 */
const getMasterData = async (req, res) => {
  try {
    const leadModel = new Lead(req.db);
    const data = await leadModel.getMasterData();

    return response.success(res, 'Master data fetched successfully', data);

  } catch (err) {
    console.error('Get master data error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Get lead sources
 * GET /api/leads/sources
 */
const getSources = async (req, res) => {
  try {
    const leadModel = new Lead(req.db);
    const sources = await leadModel.getSources();

    return response.success(res, 'Sources fetched successfully', { sources });

  } catch (err) {
    console.error('Get sources error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Get lead priorities
 * GET /api/leads/priorities
 */
const getPriorities = async (req, res) => {
  try {
    const leadModel = new Lead(req.db);
    const priorities = await leadModel.getPriorities();

    return response.success(res, 'Priorities fetched successfully', { priorities });

  } catch (err) {
    console.error('Get priorities error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Update lead status
 * PATCH /api/leads/:id/status
 */
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { ls_id } = req.body;
    const userId = req.user.userId;

    if (!ls_id) {
      return response.error(res, 'Status ID is required');
    }

    // Update status
    await req.db.query('UPDATE leads SET ls_id = ? WHERE l_id = ?', [ls_id, id]);

    // Get status name for activity log
    const [status] = await req.db.query('SELECT name FROM lead_statuses WHERE ls_id = ?', [ls_id]);
    const statusName = status.length > 0 ? status[0].name : 'Unknown';

    // Log activity
    await req.db.query(
      `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source)
       VALUES (?, ?, 'status_update', ?, 'mobile')`,
      [id, userId, `Status changed to: ${statusName}`]
    );

    return response.success(res, 'Status updated successfully');

  } catch (err) {
    console.error('Update status error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Update lead priority
 * PATCH /api/leads/:id/priority
 */
const updatePriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { lp_id } = req.body;
    const userId = req.user.userId;

    if (!lp_id) {
      return response.error(res, 'Priority ID is required');
    }

    // Update priority
    await req.db.query('UPDATE leads SET lp_id = ? WHERE l_id = ?', [lp_id, id]);

    // Get priority name for activity log
    const [priority] = await req.db.query('SELECT name FROM lead_priorities WHERE lp_id = ?', [lp_id]);
    const priorityName = priority.length > 0 ? priority[0].name : 'Unknown';

    // Log activity
    await req.db.query(
      `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source)
       Values (?, ?, 'system', ?, 'mobile')`,
      [id, userId, `Priority changed to: ${priorityName}`]
    );

    return response.success(res, 'Priority updated successfully');

  } catch (err) {
    console.error('Update priority error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Add comment to lead
 * POST /api/leads/:id/comments
 */
const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user.userId;

    if (!comment || !comment.trim()) {
      return response.error(res, 'Comment is required');
    }

    // Log activity
    await req.db.query(
      `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source)
       VALUES (?, ?, 'comment', ?, 'mobile')`,
      [id, userId, comment.trim()]
    );

    return response.success(res, 'Comment added successfully', null, 201);

  } catch (err) {
    console.error('Add comment error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Add/Update followup
 * POST /api/leads/:id/followup
 */
const addFollowup = async (req, res) => {
  try {
    const { id } = req.params;
    const { followup_dt, note } = req.body;
    const userId = req.user.userId;

    if (!followup_dt) {
      return response.error(res, 'Follow-up date is required');
    }

    // Block past date/time (allow 2 min grace)
    const fuDate = new Date(followup_dt);
    if (fuDate < new Date(Date.now() - 2 * 60000)) {
      return response.error(res, 'Cannot schedule follow-up in the past');
    }

    // Deactivate existing pending followups
    await req.db.query(
      `UPDATE lead_followups SET is_active = 0 WHERE l_id = ? AND status = 'pending'`,
      [id]
    );

    // Insert new followup
    await req.db.query(
      `INSERT INTO lead_followups (l_id, u_id, followup_dt, note, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [id, userId, followup_dt, note || null]
    );

    // Update lead's has_followup flag AND followup_dt
    await req.db.query(
      'UPDATE leads SET has_followup = 1, followup_dt = ? WHERE l_id = ?', 
      [followup_dt, id]
    );

    // Log activity
    const formattedDate = new Date(followup_dt).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    await req.db.query(
      `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source)
       VALUES (?, ?, 'followup_set', ?, 'mobile')`,
      [id, userId, `Follow-up scheduled for: ${formattedDate}`]
    );

    // Send instant notification to assigned users about the followup
    try {
      // Get lead name
      const [leadRows] = await req.db.query('SELECT name FROM leads WHERE l_id = ?', [id]);
      const leadName = leadRows[0]?.name || 'Lead';

      // Get scheduler name
      const [schedulerRows] = await req.db.query(
        `SELECT CONCAT(COALESCE(up.first_name, u.username), ' ', COALESCE(up.last_name, '')) as name
         FROM users u LEFT JOIN user_profiles up ON u.u_id = up.u_id WHERE u.u_id = ?`,
        [userId]
      );
      const schedulerName = schedulerRows[0]?.name?.trim() || 'Someone';

      // Get assigned users with device tokens (excluding the one who created the followup)
      const [assignedUsers] = await req.db.query(
        `SELECT DISTINCT u.u_id, u.device_token
         FROM lead_assignments la
         JOIN users u ON la.u_id = u.u_id
         WHERE la.l_id = ? AND la.is_active = 1 AND u.device_token IS NOT NULL AND u.device_token != '' AND u.is_active = 1`,
        [id]
      );

      // Also notify the followup creator themselves (so they get the reminder on their phone)
      const [creatorRows] = await req.db.query(
        'SELECT u_id, device_token FROM users WHERE u_id = ? AND device_token IS NOT NULL AND device_token != ""',
        [userId]
      );

      // Combine unique users
      const allUsers = [...assignedUsers, ...creatorRows];
      const seen = new Set();
      const uniqueUsers = allUsers.filter(u => {
        if (seen.has(u.u_id)) return false;
        seen.add(u.u_id);
        return true;
      });

      console.log(`[FOLLOWUP] Sending notifications to ${uniqueUsers.length} user(s) for lead ${leadName}`);
      const fuMsg = `${schedulerName} scheduled a follow-up for ${leadName} on ${formattedDate}`;
      for (const user of uniqueUsers) {
        storeNotification(req.db, user.u_id, 'followup', 'Follow-up Scheduled', fuMsg, { lead_id: String(id) });
        sendNotification(
          user.device_token,
          'Follow-up Scheduled',
          fuMsg,
          { type: 'followup_scheduled', lead_id: String(id) }
        ).then(ok => {
          console.log(`[FOLLOWUP] Notification to user ${user.u_id}: ${ok ? 'sent' : 'failed'}`);
        }).catch(err => console.error('[FOLLOWUP] notify error:', err));
      }
    } catch (notifyErr) {
      console.error('[FOLLOWUP] Notification error:', notifyErr);
    }

    return response.success(res, 'Follow-up scheduled successfully', null, 201);

  } catch (err) {
    console.error('Add followup error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Toggle lead lock
 * PATCH /api/leads/:id/lock
 */
const toggleLock = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Get current lock status
    const [lead] = await req.db.query('SELECT is_locked FROM leads WHERE l_id = ?', [id]);
    if (lead.length === 0) {
      return response.error(res, 'Lead not found', 404);
    }

    const newLockStatus = lead[0].is_locked ? 0 : 1;

    // Update lock status
    await req.db.query('UPDATE leads SET is_locked = ? WHERE l_id = ?', [newLockStatus, id]);

    // Log activity
    await req.db.query(
      `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source)
       VALUES (?, ?, 'system', ?, 'mobile')`,
      [id, userId, newLockStatus ? 'Lead locked' : 'Lead unlocked']
    );

    return response.success(res, newLockStatus ? 'Lead locked' : 'Lead unlocked');

  } catch (err) {
    console.error('Toggle lock error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Assign lead to users
 * POST /api/leads/:id/assign
 */
const assignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_ids, status_id } = req.body;
    const userId = req.user.userId;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return response.error(res, 'At least one user ID is required');
    }

    // Deactivate existing assignments (but keep the assigner's own assignment if they are a sales_manager)
    const userRole = req.user.roleSlug;
    if (userRole === 'sales_manager') {
      // Only deactivate assignments made by this sales manager (not their own assignment from master)
      await req.db.query('UPDATE lead_assignments SET is_active = 0 WHERE l_id = ? AND assigned_by = ?', [id, userId]);
    } else {
      await req.db.query('UPDATE lead_assignments SET is_active = 0 WHERE l_id = ?', [id]);
    }

    // Insert new assignments
    for (const assignToId of user_ids) {
      await req.db.query(
        `INSERT INTO lead_assignments (l_id, u_id, assigned_by, is_active)
         VALUES (?, ?, ?, 1)`,
        [id, assignToId, userId]
      );
    }

    // Update assign status
    await req.db.query(
      `UPDATE leads SET assign_status = 'assigned' WHERE l_id = ?`,
      [id]
    );

    // Update lead status if provided
    if (status_id) {
      await req.db.query(
        `UPDATE leads SET ls_id = ? WHERE l_id = ?`,
        [status_id, id]
      );
    }

    // Get assigned user names for activity log
    const namePlaceholders = user_ids.map(() => '?').join(',');
    const [users] = await req.db.query(
      `SELECT username as name FROM users WHERE u_id IN (${namePlaceholders})`,
      [...user_ids]
    );
    const userNames = users.map(u => u.name.trim()).join(', ');

    // Log activity
    await req.db.query(
      `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source)
       VALUES (?, ?, 'system', ?, 'mobile')`,
      [id, userId, `Lead assigned to: ${userNames}`]
    );

    // Send notification to assigned users
    const placeholders = user_ids.map(() => '?').join(',');
    const [assignedUsers] = await req.db.query(
      `SELECT u.u_id, u.device_token,
              CONCAT(COALESCE(up.first_name, u.username), ' ', COALESCE(up.last_name, '')) as name
       FROM users u
       LEFT JOIN user_profiles up ON u.u_id = up.u_id
       WHERE u.u_id IN (${placeholders}) AND u.device_token IS NOT NULL AND u.device_token != ''`,
      [...user_ids]
    );

    // Get lead name for notification
    const [leadRows] = await req.db.query(
      `SELECT name, mobile FROM leads WHERE l_id = ?`,
      [id]
    );
    const leadName = leadRows[0]?.name || 'Unknown';

    // Get assigner name
    const [assignerRows] = await req.db.query(
      `SELECT CONCAT(COALESCE(up.first_name, u.username), ' ', COALESCE(up.last_name, '')) as name
       FROM users u LEFT JOIN user_profiles up ON u.u_id = up.u_id
       WHERE u.u_id = ?`,
      [userId]
    );
    const assignerName = assignerRows[0]?.name?.trim() || 'Admin';

    console.log(`[LEAD ASSIGN] Sending notifications to ${assignedUsers.length} user(s)`);
    const assignMsg = `${assignerName} assigned you a lead: ${leadName}`;
    for (const user of assignedUsers) {
      console.log(`[LEAD ASSIGN] Notifying user ${user.u_id}, token: ${user.device_token?.substring(0, 20)}...`);
      storeNotification(req.db, user.u_id, 'lead', 'New Lead Assigned', assignMsg, { lead_id: String(id) });
      sendNotification(
        user.device_token,
        'New Lead Assigned',
        assignMsg,
        { type: 'lead_assigned', lead_id: String(id) }
      ).then(ok => {
        console.log(`[LEAD ASSIGN] Notification to user ${user.u_id}: ${ok ? 'sent' : 'failed'}`);
      }).catch(err => console.error('[LEAD ASSIGN] notify error:', err));
    }

    return response.success(res, 'Lead assigned successfully');

  } catch (err) {
    console.error('Assign lead error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Unassign lead
 * POST /api/leads/:id/unassign
 */
const unassignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Deactivate all assignments
    await req.db.query('UPDATE lead_assignments SET is_active = 0 WHERE l_id = ?', [id]);

    // Update assign status
    await req.db.query(`UPDATE leads SET assign_status = 'unassigned' WHERE l_id = ?`, [id]);

    // Activity log
    await req.db.query(
      `INSERT INTO lead_activities (l_id, u_id, activity_type, description) VALUES (?, ?, 'system', ?)`,
      [id, userId, 'Lead unassigned from all users']
    );

    return response.success(res, 'Lead unassigned successfully');
  } catch (err) {
    console.error('Unassign lead error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Get users for assignment (hierarchy-based)
 * GET /api/leads/users
 */
const getUsers = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.roleSlug;

    let query = `
      SELECT u.u_id, u.username,
        CONCAT(COALESCE(up.first_name, u.username), ' ', COALESCE(up.last_name, '')) as name,
        r.name as role_name,
        r.slug as role_slug
       FROM users u
       LEFT JOIN user_profiles up ON u.u_id = up.u_id
       LEFT JOIN roles r ON u.r_id = r.r_id
       WHERE u.is_active = 1 AND r.level > 2`;
    const params = [];

    if (userRole === 'sales_manager') {
      // Sales manager sees self + telecallers under them
      query += ' AND (u.u_id = ? OR u.sales_manager_id = ? OR u.reports_to = ?)';
      params.push(userId, userId, userId);
    } else if (userRole === 'team_leader') {
      // Team leader sees self + sales managers and telecallers under them
      query += ' AND (u.u_id = ? OR u.team_leader_id = ? OR u.reports_to = ? OR u.sales_manager_id IN (SELECT u2.u_id FROM users u2 WHERE u2.team_leader_id = ? OR u2.reports_to = ?))';
      params.push(userId, userId, userId, userId, userId);
    }
    // Master/Admin see all users except self
    if (userRole === 'master' || userRole === 'admin') {
      query += ' AND u.u_id != ?';
      params.push(userId);
    }

    console.log(`[GET USERS] role=${userRole}, userId=${userId}, query params=${JSON.stringify(params)}`);

    query += ' ORDER BY r.level ASC, up.first_name, u.username';

    const [users] = await req.db.query(query, params);

    return response.success(res, 'Users fetched successfully', { users });

  } catch (err) {
    console.error('Get users error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Get category counts (assigned, non-assigned, etc.)
 * GET /api/leads/category-counts
 */
const getCategoryCounts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.roleSlug;
    const isAdmin = userRole === 'master' || userRole === 'admin';
    const isSM = userRole === 'sales_manager';

    let whereClause = 'WHERE l.is_archived = 0';
    const params = [];

    // Role-based visibility
    const isTL = userRole === 'team_leader';
    if (!isAdmin) {
      if (isTL) {
        // Team leader sees: own + assigned to them + assigned to their team
        whereClause += ` AND (l.created_by = ? OR EXISTS (
          SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.is_active = 1
          AND (la.u_id = ? OR la.assigned_by = ? OR la.u_id IN (
            SELECT u.u_id FROM users u WHERE u.team_leader_id = ? OR u.reports_to = ?
          ))
        ))`;
        params.push(userId, userId, userId, userId, userId);
      } else if (isSM) {
        // Sales manager sees leads assigned to them or they assigned forward
        whereClause += ` AND (l.created_by = ? OR EXISTS (
          SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND (la.u_id = ? OR la.assigned_by = ?) AND la.is_active = 1
        ))`;
        params.push(userId, userId, userId);
      } else {
        whereClause += ` AND (l.created_by = ? OR EXISTS (
          SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.u_id = ? AND la.is_active = 1
        ))`;
        params.push(userId, userId);
      }
    }

    // Get fresh count (not viewed)
    const [freshResult] = await req.db.query(
      `SELECT COUNT(*) as count FROM leads l ${whereClause} AND (l.is_viewed = 0 OR l.is_viewed IS NULL)`,
      params
    );

    let assignedCount, nonAssignedCount;

    if (isSM || isTL) {
      // SM / TL: "Assigned" = leads they forwarded to someone else (e.g. telecaller)
      const [assignedResult] = await req.db.query(
        `SELECT COUNT(DISTINCT l.l_id) as count FROM leads l
         ${whereClause}
         AND EXISTS (SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.assigned_by = ? AND la.u_id != ? AND la.is_active = 1)`,
        [...params, userId, userId]
      );
      // "Non Assigned" = leads they own/created/are assigned, but NOT yet forwarded to anyone else
      const [nonAssignedResult] = await req.db.query(
        `SELECT COUNT(DISTINCT l.l_id) as count FROM leads l
         ${whereClause}
         AND NOT EXISTS (SELECT 1 FROM lead_assignments la2 WHERE la2.l_id = l.l_id AND la2.assigned_by = ? AND la2.u_id != ? AND la2.is_active = 1)`,
        [...params, userId, userId]
      );
      assignedCount = assignedResult[0]?.count || 0;
      nonAssignedCount = nonAssignedResult[0]?.count || 0;
    } else if (isAdmin) {
      // Admin/Master: overall assigned/non-assigned across all leads
      const [assignedResult] = await req.db.query(
        `SELECT COUNT(DISTINCT l.l_id) as count FROM leads l
         INNER JOIN lead_assignments la ON l.l_id = la.l_id AND la.is_active = 1
         WHERE l.is_archived = 0`,
        []
      );
      const [nonAssignedResult] = await req.db.query(
        `SELECT COUNT(*) as count FROM leads l
         WHERE l.is_archived = 0
         AND NOT EXISTS (SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.is_active = 1)`,
        []
      );
      assignedCount = assignedResult[0]?.count || 0;
      nonAssignedCount = nonAssignedResult[0]?.count || 0;
    } else {
      // Team Leader / Telecaller: assigned = leads assigned to them, non-assigned = leads created by them with no assignment
      const [assignedResult] = await req.db.query(
        `SELECT COUNT(DISTINCT l.l_id) as count FROM leads l
         ${whereClause}
         AND EXISTS (SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.u_id = ? AND la.is_active = 1)`,
        [...params, userId]
      );
      const [nonAssignedResult] = await req.db.query(
        `SELECT COUNT(*) as count FROM leads l
         ${whereClause}
         AND NOT EXISTS (SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.is_active = 1)`,
        params
      );
      assignedCount = assignedResult[0]?.count || 0;
      nonAssignedCount = nonAssignedResult[0]?.count || 0;
    }

    // Get unknown count (no status assigned)
    const [unknownResult] = await req.db.query(
      `SELECT COUNT(*) as count FROM leads l ${whereClause} AND (l.ls_id IS NULL OR l.ls_id = 0)`,
      params
    );

    // Get imported count
    const [importedResult] = await req.db.query(
      `SELECT COUNT(*) as count FROM leads l ${whereClause} AND l.source_type = 'import'`,
      params
    );

    // Status-wise counts (team = all visible leads, self = only user's own)
    let statusUserFilter = '';
    if (!isAdmin) {
      if (isTL) {
        statusUserFilter = `AND (l.created_by = ${Number(userId)} OR EXISTS (
          SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.is_active = 1
          AND (la.u_id = ${Number(userId)} OR la.assigned_by = ${Number(userId)} OR la.u_id IN (
            SELECT u.u_id FROM users u WHERE u.team_leader_id = ${Number(userId)} OR u.reports_to = ${Number(userId)}
          ))
        ))`;
      } else if (isSM) {
        statusUserFilter = `AND (l.created_by = ${Number(userId)} OR EXISTS (SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND (la.u_id = ${Number(userId)} OR la.assigned_by = ${Number(userId)}) AND la.is_active = 1))`;
      } else {
        statusUserFilter = `AND (l.created_by = ${Number(userId)} OR EXISTS (SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.u_id = ${Number(userId)} AND la.is_active = 1))`;
      }
    }

    const [statusTeamCounts] = await req.db.query(
      `SELECT ls.ls_id, ls.name, ls.color, ls.display_order, COUNT(l.l_id) as count
       FROM lead_statuses ls
       LEFT JOIN leads l ON l.ls_id = ls.ls_id AND l.is_archived = 0 ${statusUserFilter}
       WHERE ls.is_active = 1
       GROUP BY ls.ls_id ORDER BY ls.display_order`
    );

    const [statusSelfCounts] = await req.db.query(
      `SELECT ls.ls_id, COUNT(l.l_id) as count
       FROM lead_statuses ls
       LEFT JOIN leads l ON l.ls_id = ls.ls_id AND l.is_archived = 0
         AND (l.created_by = ? OR EXISTS (SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.u_id = ? AND la.is_active = 1))
       WHERE ls.is_active = 1
       GROUP BY ls.ls_id ORDER BY ls.display_order`,
      [userId, userId]
    );

    const selfMap = {};
    (statusSelfCounts || []).forEach(s => { selfMap[s.ls_id] = s.count || 0; });

    const statusCounts = (statusTeamCounts || []).map(s => ({
      ls_id: s.ls_id,
      name: s.name,
      color: s.color,
      display_order: s.display_order,
      team_count: s.count || 0,
      self_count: selfMap[s.ls_id] || 0,
    }));

    return response.success(res, 'Category counts fetched', {
      fresh: freshResult[0]?.count || 0,
      assigned: assignedCount,
      nonAssigned: nonAssignedCount,
      imported: importedResult[0]?.count || 0,
      unknown: unknownResult[0]?.count || 0,
      statusCounts,
    });
    
  } catch (err) {
    console.error('Get category counts error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Remove follow-up from lead
 * DELETE /api/leads/:id/followup
 */
const removeFollowup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Deactivate all pending followups
    await req.db.query(
      `UPDATE lead_followups SET is_active = 0, status = 'cancelled' WHERE l_id = ? AND status = 'pending'`,
      [id]
    );

    // Update lead's has_followup flag and clear followup_dt
    await req.db.query(
      'UPDATE leads SET has_followup = 0, followup_dt = NULL WHERE l_id = ?', 
      [id]
    );

    // Log activity
    await req.db.query(
      `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source)
       VALUES (?, ?, 'followup_done', ?, 'mobile')`,
      [id, userId, 'Follow-up removed']
    );

    return response.success(res, 'Follow-up removed successfully');

  } catch (err) {
    console.error('Remove followup error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Log a call activity for a lead
 * POST /api/leads/:id/call-activity
 */
const logCallActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { call_type, call_duration, comment } = req.body;
    const userId = req.user.userId;

    try {
      await req.db.query(
        `INSERT INTO lead_activities (l_id, u_id, activity_type, call_type, call_duration, comment, source)
         VALUES (?, ?, 'call', ?, ?, ?, 'mobile')`,
        [id, userId, call_type || 'outgoing', call_duration || null, comment || null]
      );
    } catch (colErr) {
      if (colErr.code === 'ER_BAD_FIELD_ERROR') {
        // Fallback if call_duration column doesn't exist
        await req.db.query(
          `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source)
           VALUES (?, ?, 'call', ?, 'mobile')`,
          [id, userId, comment || null]
        );
      } else {
        throw colErr;
      }
    }

    return response.success(res, 'Call activity logged', null, 201);
  } catch (err) {
    console.error('Log call activity error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Upload document for a lead
 * POST /api/leads/:id/upload-document
 */
const uploadLeadDocument = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return response.error(res, 'No file uploaded');
    }

    const documentPath = `/uploads/documents/${req.file.filename}`;
    const documentName = req.file.originalname;

    // Get existing documents array
    const [rows] = await req.db.query('SELECT documents FROM leads WHERE l_id = ?', [id]);
    let docs = [];
    if (rows[0]?.documents) {
      try { docs = JSON.parse(rows[0].documents); } catch (e) { docs = []; }
    }
    if (!Array.isArray(docs)) docs = [];

    // Add new document
    docs.push({ path: documentPath, name: documentName, type: req.file.mimetype, uploaded_at: new Date().toISOString() });

    await req.db.query(
      'UPDATE leads SET documents = ? WHERE l_id = ?',
      [JSON.stringify(docs), id]
    );

    return response.success(res, 'Document uploaded successfully', {
      document_path: documentPath,
      document_name: documentName,
      documents: docs,
    });
  } catch (err) {
    console.error('Upload document error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Import leads from parsed data
 * POST /api/leads/import
 */
const importLeads = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { leads: leadsData } = req.body;

    if (!Array.isArray(leadsData) || leadsData.length === 0) {
      return response.error(res, 'No leads data provided');
    }

    // Get source mapping
    const [sources] = await req.db.query('SELECT src_id, name FROM lead_sources WHERE is_active = 1');
    const sourceMap = {};
    sources.forEach(s => { sourceMap[s.name.toLowerCase()] = s.src_id; });

    // Get default status (Fresh Lead)
    const [defaultStatus] = await req.db.query('SELECT ls_id FROM lead_statuses WHERE is_default = 1 LIMIT 1');
    const defaultLsId = defaultStatus[0]?.ls_id || null;

    let imported = 0;
    let errors = 0;
    let duplicates = 0;

    for (const lead of leadsData) {
      try {
        const name = String(lead.name || '').trim();
        const mobile = String(lead.mobile || '').trim().replace(/[^0-9]/g, '');

        if (!name || !mobile) {
          errors++;
          continue;
        }

        // Check duplicate by mobile
        const [existing] = await req.db.query(
          'SELECT l_id FROM leads WHERE mobile = ? AND is_archived = 0 LIMIT 1',
          [mobile]
        );
        if (existing.length > 0) {
          duplicates++;
          continue;
        }

        const countryCode = String(lead.country_code || '+91').trim();
        const email = String(lead.email || '').trim() || null;
        const sourceName = String(lead.source || '').trim().toLowerCase();
        const srcId = sourceMap[sourceName] || null;
        const buyerType = String(lead.buyer_type || '').trim() || null;
        const investmentType = String(lead.investment_type || '').trim() || null;
        const country = String(lead.country || '').trim() || null;
        const state = String(lead.state || '').trim() || null;
        const city = String(lead.city || '').trim() || null;
        const locality = String(lead.locality || '').trim() || null;
        const otherDetails = String(lead.other_details || '').trim() || null;

        // Insert lead
        const [result] = await req.db.query(
          `INSERT INTO leads (
            name, country_code, mobile, email,
            source_type, src_id,
            buyer_type, investment_type,
            ls_id, country, state, city, locality,
            other_details, created_by, is_viewed
          ) VALUES (?, ?, ?, ?, 'import', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [name, countryCode, mobile, email, srcId, buyerType, investmentType, defaultLsId, country, state, city, locality, otherDetails, userId]
        );

        const leadId = result.insertId;

        // Insert requirements
        await req.db.query(
          `INSERT INTO lead_requirements (l_id, preferred_country, preferred_state, preferred_city, preferred_locality)
           VALUES (?, ?, ?, ?, ?)`,
          [leadId, country, state, city, locality]
        );

        // Log activity
        await req.db.query(
          `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source)
           VALUES (?, ?, 'system', 'Lead imported', 'web')`,
          [leadId, userId]
        );

        imported++;
      } catch (rowErr) {
        console.error('Import row error:', rowErr.message);
        errors++;
      }
    }

    return response.success(res, `Import completed: ${imported} imported, ${duplicates} duplicates, ${errors} errors`, {
      imported,
      duplicates,
      errors,
      total: leadsData.length,
    });
  } catch (err) {
    console.error('Import leads error:', err);
    return response.serverError(res, err);
  }
};

module.exports = {
  createLead,
  getLeads,
  getLead,
  updateLead,
  deleteLead,
  getMasterData,
  getSources,
  getPriorities,
  updateStatus,
  updatePriority,
  addComment,
  addFollowup,
  removeFollowup,
  toggleLock,
  assignLead,
  unassignLead,
  getUsers,
  getCategoryCounts,
  logCallActivity,
  uploadDocument: uploadLeadDocument,
  importLeads,
};
