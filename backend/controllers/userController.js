/**
 * User Controller
 * Handles team member/user operations
 */

const bcrypt = require('bcryptjs');
const fs = require('fs');
const response = require('../utils/response');

/**
 * Get all users
 * GET /api/users
 */
const getUsers = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.roleSlug;
    const userLevel = req.user.roleLevel;

    let query = `
      SELECT
        u.u_id, u.username, u.email,
        u.is_active, u.created_at,
        u.reports_to,
        r.name as role_name, r.slug as role_slug,
        up.phone as mobile, up.profile_image,
        (SELECT COUNT(*) FROM lead_assignments la WHERE la.u_id = u.u_id AND la.is_active = 1) as lead_count
      FROM users u
      LEFT JOIN roles r ON u.r_id = r.r_id
      LEFT JOIN user_profiles up ON up.u_id = u.u_id
      WHERE u.is_active IS NOT NULL
        AND u.u_id != ?
        AND r.level > 2
    `;
    const params = [userId];

    // Non-admin users see only their reportees
    if (userLevel > 2) {
      query += ` AND (u.reports_to = ? OR u.created_by = ?)`;
      params.push(userId, userId);
    }

    query += ` ORDER BY u.username ASC`;

    const [users] = await req.db.query(query, params);

    // Fetch status-wise lead counts per user
    const [statusCounts] = await req.db.query(`
      SELECT la.u_id, ls.ls_id, ls.name as status_name, ls.color as status_color, COUNT(*) as count
      FROM lead_assignments la
      JOIN leads l ON la.l_id = l.l_id
      LEFT JOIN lead_statuses ls ON l.ls_id = ls.ls_id
      WHERE la.is_active = 1 AND l.is_archived = 0
      GROUP BY la.u_id, ls.ls_id, ls.name, ls.color
      ORDER BY count DESC
    `);

    // Build status map per user
    const statusMap = {};
    (statusCounts || []).forEach(sc => {
      if (!statusMap[sc.u_id]) statusMap[sc.u_id] = [];
      statusMap[sc.u_id].push({ls_id: sc.ls_id, name: sc.status_name || 'Unassigned', color: sc.status_color || '#9E9E9E', count: sc.count});
    });

    // Map username as name for frontend compatibility
    const mappedUsers = users.map(u => ({
      ...u,
      name: u.username,
      status_leads: statusMap[u.u_id] || [],
    }));

    return response.success(res, 'Users fetched successfully', { users: mappedUsers });

  } catch (err) {
    console.error('Get users error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Get single user
 * GET /api/users/:id
 */
const getUser = async (req, res) => {
  try {
    const { id } = req.params;

    const [users] = await req.db.query(
      `SELECT
        u.u_id, u.username, u.email,
        u.is_active, u.created_at,
        u.reports_to,
        r.name as role_name, r.slug as role_slug,
        up.phone as mobile, up.profile_image,
        (SELECT COUNT(*) FROM lead_assignments la WHERE la.u_id = u.u_id AND la.is_active = 1) as lead_count
      FROM users u
      LEFT JOIN roles r ON u.r_id = r.r_id
      LEFT JOIN user_profiles up ON up.u_id = u.u_id
      WHERE u.u_id = ?`,
      [id]
    );

    if (users.length === 0) {
      return response.error(res, 'User not found', 404);
    }

    // Map username as name for frontend compatibility
    const user = {
      ...users[0],
      name: users[0].username,
    };

    return response.success(res, 'User fetched successfully', { user });

  } catch (err) {
    console.error('Get user error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Create new user/team member
 * POST /api/users
 */
const createUser = async (req, res) => {
  try {
    const { 
      name, username, password, email, mobile, 
      user_type, role, team_leader_id, sales_manager_id, 
      permissions 
    } = req.body;
    const createdBy = req.user.userId;

    // Validate required fields
    if (!name || !username || !password) {
      return response.error(res, 'Name, username and password are required');
    }

    // Check if username already exists
    const [existing] = await req.db.query(
      'SELECT u_id FROM users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      return response.error(res, 'Username already exists');
    }

    // Get role ID
    const roleSlug = role || 'tele_caller';
    const [roles] = await req.db.query('SELECT r_id FROM roles WHERE slug = ?', [roleSlug]);
    const roleId = roles.length > 0 ? roles[0].r_id : 4; // Default to tele_caller

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user - using actual table columns
    const [result] = await req.db.query(
      `INSERT INTO users (username, password_hash, email, r_id, reports_to, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [
        username,
        hashedPassword,
        email || null,
        roleId,
        team_leader_id || sales_manager_id || null, // reports_to
        createdBy
      ]
    );

    const newUserId = result.insertId;

    // Save permissions if provided (same mapping logic as updateUser)
    if (permissions && typeof permissions === 'object') {
      const [allPerms] = await req.db.query('SELECT p_id, code FROM permissions');
      const permMap = {};
      allPerms.forEach(p => { permMap[p.code] = p.p_id; });

      const mapKey = (key) => {
        if (permMap[key] !== undefined) return key;
        const parts = key.split('_');
        if (parts.length >= 2) {
          const module = parts[0];
          const action = parts.slice(1).join('_');
          const candidates = [
            `${module}.${action}`,
            `${module}s.${action}`,
            `${module}.${action}s`,
          ];
          for (const c of candidates) {
            if (permMap[c] !== undefined) return c;
          }
        }
        return null;
      };

      const seen = new Map();
      for (const [code, granted] of Object.entries(permissions)) {
        const dbCode = mapKey(code);
        if (dbCode && permMap[dbCode] !== undefined) {
          seen.set(permMap[dbCode], granted ? 1 : 0);
        }
      }
      for (const [pid, granted] of seen.entries()) {
        await req.db.query(
          'INSERT INTO user_permissions (u_id, p_id, granted, granted_by) VALUES (?, ?, ?, ?)',
          [newUserId, pid, granted, createdBy]
        );
      }
    }

    return response.success(res, 'User created successfully', {
      user_id: newUserId
    }, 201);

  } catch (err) {
    console.error('Create user error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Update user
 * PUT /api/users/:id
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, mobile, email, role, password, reports_to, permissions } = req.body;

    // Check if user exists
    const [existing] = await req.db.query(
      'SELECT u_id FROM users WHERE u_id = ?',
      [id]
    );

    if (existing.length === 0) {
      return response.error(res, 'User not found', 404);
    }

    // Build update query for users table
    let updateFields = [];
    let params = [];

    if (name !== undefined) {
      // users table has 'username', not 'name'
      updateFields.push('username = ?');
      params.push(name.trim());
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      params.push(email || null);
    }
    if (reports_to !== undefined) {
      updateFields.push('reports_to = ?');
      params.push(reports_to || null);
    }
    if (role) {
      const [roles] = await req.db.query('SELECT r_id FROM roles WHERE slug = ?', [role]);
      if (roles.length > 0) {
        updateFields.push('r_id = ?');
        params.push(roles[0].r_id);
      }
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push('password_hash = ?');
      params.push(hashedPassword);
    }

    if (updateFields.length > 0) {
      params.push(id);
      await req.db.query(
        `UPDATE users SET ${updateFields.join(', ')} WHERE u_id = ?`,
        params
      );
    }

    // Update mobile/phone in user_profiles table
    if (mobile !== undefined) {
      const [profileExists] = await req.db.query(
        'SELECT up_id FROM user_profiles WHERE u_id = ?', [id]
      );
      if (profileExists.length > 0) {
        await req.db.query(
          'UPDATE user_profiles SET phone = ? WHERE u_id = ?',
          [mobile || null, id]
        );
      } else {
        await req.db.query(
          'INSERT INTO user_profiles (u_id, phone) VALUES (?, ?)',
          [id, mobile || null]
        );
      }
    }

    // Update permissions if provided
    if (permissions && typeof permissions === 'object') {
      // Get all permission codes from DB
      const [allPerms] = await req.db.query('SELECT p_id, code FROM permissions');
      const permMap = {};
      allPerms.forEach(p => { permMap[p.code] = p.p_id; });

      // Helper: map frontend key (lead_add) to DB code (leads.add)
      const mapKey = (key) => {
        if (permMap[key] !== undefined) return key; // exact match
        // Convert "module_action" → "modules.action" (pluralize module)
        const parts = key.split('_');
        if (parts.length >= 2) {
          const module = parts[0];
          const action = parts.slice(1).join('_');
          const candidates = [
            `${module}.${action}`,
            `${module}s.${action}`,
            `${module}.${action}s`,
          ];
          for (const c of candidates) {
            if (permMap[c] !== undefined) return c;
          }
        }
        return null;
      };

      // Remove existing user permission overrides
      await req.db.query('DELETE FROM user_permissions WHERE u_id = ?', [id]);

      // Dedupe by p_id — frontend sends both "lead_delete" and "leads.delete" which map to same p_id
      const seen = new Map();
      for (const [code, granted] of Object.entries(permissions)) {
        const dbCode = mapKey(code);
        if (dbCode && permMap[dbCode] !== undefined) {
          seen.set(permMap[dbCode], granted ? 1 : 0);
        }
      }
      for (const [pid, granted] of seen.entries()) {
        await req.db.query(
          'INSERT INTO user_permissions (u_id, p_id, granted, granted_by) VALUES (?, ?, ?, ?)',
          [id, pid, granted, req.user.userId]
        );
      }
    }

    return response.success(res, 'User updated successfully');

  } catch (err) {
    console.error('Update user error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Get delete info for a user (lead count + eligible reassignment users)
 * GET /api/users/:id/delete-info
 */
const getDeleteInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = parseInt(id);

    // Get active lead count for this user
    const [leadRows] = await req.db.query(
      'SELECT COUNT(*) as lead_count FROM lead_assignments WHERE u_id = ? AND is_active = 1',
      [targetId]
    );
    const leadCount = leadRows[0].lead_count || 0;

    // Get eligible users to reassign leads to (active users, excluding the one being deleted)
    const [eligibleUsers] = await req.db.query(
      `SELECT u.u_id, u.username as name, r.name as role_name, r.slug as role_slug
       FROM users u
       LEFT JOIN roles r ON u.r_id = r.r_id
       WHERE u.is_active = 1 AND u.u_id != ?
       ORDER BY u.username ASC`,
      [targetId]
    );

    return response.success(res, 'Delete info fetched', {
      lead_count: leadCount,
      eligible_users: eligibleUsers,
    });

  } catch (err) {
    console.error('Get delete info error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Delete user (soft delete - set inactive) with lead reassignment
 * DELETE /api/users/:id
 * Body: { reassign_to?: number } - u_id to reassign leads to
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reassign_to, unassign } = req.body;
    const targetId = parseInt(id);

    // Check if user exists
    const [users] = await req.db.query('SELECT u_id, username FROM users WHERE u_id = ?', [targetId]);
    if (users.length === 0) {
      return response.error(res, 'User not found', 404);
    }

    // Check active lead count
    const [leadRows] = await req.db.query(
      'SELECT COUNT(*) as lead_count FROM lead_assignments WHERE u_id = ? AND is_active = 1',
      [targetId]
    );
    const leadCount = leadRows[0].lead_count || 0;

    // If user has leads, either reassign_to or unassign flag is required
    if (leadCount > 0 && !reassign_to && !unassign) {
      return response.error(res, 'This member has active leads. Please select a user to reassign leads to or choose unassign.', 400);
    }

    let reassignedCount = 0;
    let unassignedCount = 0;

    if (leadCount > 0 && reassign_to) {
      const reassignId = parseInt(reassign_to);

      const [targetUser] = await req.db.query(
        'SELECT u_id FROM users WHERE u_id = ? AND is_active = 1',
        [reassignId]
      );
      if (targetUser.length === 0) {
        return response.error(res, 'Reassignment target user not found or inactive', 400);
      }

      const [reassignResult] = await req.db.query(
        'UPDATE lead_assignments SET u_id = ?, assigned_by = ? WHERE u_id = ? AND is_active = 1',
        [reassignId, req.user.userId, targetId]
      );
      reassignedCount = reassignResult.affectedRows || 0;
    } else if (leadCount > 0 && unassign) {
      // Deactivate the user's active assignments — leads become unassigned but history/activities stay
      const [unassignResult] = await req.db.query(
        'UPDATE lead_assignments SET is_active = 0 WHERE u_id = ? AND is_active = 1',
        [targetId]
      );
      unassignedCount = unassignResult.affectedRows || 0;

      // Log a system activity on each lead so history reflects the change
      const [affectedLeads] = await req.db.query(
        'SELECT DISTINCT l_id FROM lead_assignments WHERE u_id = ?',
        [targetId]
      );
      for (const row of affectedLeads) {
        await req.db.query(
          `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source) VALUES (?, ?, 'system', ?, 'mobile')`,
          [row.l_id, req.user.userId, `Lead unassigned — member ${users[0].username} deleted`]
        );
      }
    }

    // Hard delete the user from DB (clean up residual inactive assignments first)
    await req.db.query('DELETE FROM lead_assignments WHERE u_id = ?', [targetId]);
    await req.db.query('DELETE FROM users WHERE u_id = ?', [targetId]);

    return response.success(res, 'Member deleted successfully', {
      reassigned_leads: reassignedCount,
      unassigned_leads: unassignedCount,
    });

  } catch (err) {
    console.error('Delete user error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Toggle user status
 * PATCH /api/users/:id/status
 */
const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Get current status
    const [users] = await req.db.query(
      'SELECT is_active FROM users WHERE u_id = ?',
      [id]
    );

    if (users.length === 0) {
      return response.error(res, 'User not found', 404);
    }

    const newStatus = users[0].is_active ? 0 : 1;

    await req.db.query(
      'UPDATE users SET is_active = ? WHERE u_id = ?',
      [newStatus, id]
    );

    return response.success(res, `User ${newStatus ? 'activated' : 'deactivated'} successfully`, {
      is_active: newStatus
    });

  } catch (err) {
    console.error('Toggle status error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Update own profile
 * PUT /api/users/profile
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      first_name,
      last_name,
      email,
      phone,
      phone_code,
      designation,
      department,
      gender,
      date_of_birth
    } = req.body;

    // --- 1. Update email on users table (only field that lives there) ---
    if (email !== undefined) {
      await req.db.query('UPDATE users SET email = ? WHERE u_id = ?', [email, userId]);
    }

    // --- 2. Update profile fields on user_profiles table ---
    const profileFields = { first_name, last_name, phone, phone_code, designation, department, gender, date_of_birth };
    const profileUpdates = [];
    const profileParams = [];

    Object.entries(profileFields).forEach(([key, value]) => {
      if (value !== undefined) {
        profileUpdates.push(`${key} = ?`);
        profileParams.push(key === 'date_of_birth' ? (value || null) : value);
      }
    });

    if (profileUpdates.length > 0) {
      // Check if profile row exists
      const [existing] = await req.db.query('SELECT up_id FROM user_profiles WHERE u_id = ?', [userId]);

      if (existing.length > 0) {
        // Update existing profile
        profileParams.push(userId);
        await req.db.query(
          `UPDATE user_profiles SET ${profileUpdates.join(', ')} WHERE u_id = ?`,
          profileParams
        );
      } else {
        // Insert new profile row
        const insertFields = ['u_id'];
        const insertValues = [userId];
        Object.entries(profileFields).forEach(([key, value]) => {
          if (value !== undefined) {
            insertFields.push(key);
            insertValues.push(key === 'date_of_birth' ? (value || null) : value);
          }
        });
        const placeholders = insertFields.map(() => '?').join(', ');
        await req.db.query(
          `INSERT INTO user_profiles (${insertFields.join(', ')}) VALUES (${placeholders})`,
          insertValues
        );
      }
    }

    if (!email && profileUpdates.length === 0) {
      return response.error(res, 'No fields to update', 400);
    }

    // --- 3. Fetch updated user data (join users + user_profiles) ---
    const [users] = await req.db.query(
      `SELECT u.u_id, u.username, u.email,
              up.first_name, up.last_name, up.phone, up.phone_code,
              up.designation, up.department, up.gender, up.date_of_birth,
              up.profile_image,
              r.name as role_name, r.slug as role_slug
       FROM users u
       LEFT JOIN user_profiles up ON up.u_id = u.u_id
       LEFT JOIN roles r ON u.r_id = r.r_id
       WHERE u.u_id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return response.error(res, 'User not found', 404);
    }

    const user = users[0];
    const userData = {
      user_id: user.u_id,
      username: user.username,
      email: user.email,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      full_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username,
      phone: user.phone || '',
      phone_code: user.phone_code || '',
      designation: user.designation || '',
      department: user.department || '',
      gender: user.gender || '',
      date_of_birth: user.date_of_birth || '',
      profile_image: user.profile_image || '',
      role_name: user.role_name,
      role_slug: user.role_slug,
    };

    return response.success(res, 'Profile updated successfully', { user: userData });

  } catch (err) {
    console.error('Update profile error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Change password
 * POST /api/users/change-password
 */
const changePassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { current_password, new_password } = req.body;

    // Validation
    if (!current_password || !new_password) {
      return response.error(res, 'Current password and new password are required', 400);
    }

    if (new_password.length < 4) {
      return response.error(res, 'New password must be at least 4 characters', 400);
    }

    // Get current user
    const [users] = await req.db.query(
      'SELECT password_hash FROM users WHERE u_id = ?',
      [userId]
    );

    if (users.length === 0) {
      return response.error(res, 'User not found', 404);
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, users[0].password_hash);
    if (!isValidPassword) {
      return response.error(res, 'Current password is incorrect', 400);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await req.db.query(
      'UPDATE users SET password_hash = ? WHERE u_id = ?',
      [hashedPassword, userId]
    );

    return response.success(res, 'Password changed successfully');

  } catch (err) {
    console.error('Change password error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Upload profile image
 * POST /api/users/profile/image
 */
const uploadProfileImage = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Check if file is uploaded
    if (!req.file) {
      return response.error(res, 'No file uploaded', 400);
    }

    const fileUrl = `/uploads/photos/${req.file.filename}`;

    // Get existing profile image
    const [existing] = await req.db.query(
      'SELECT profile_image FROM user_profiles WHERE u_id = ?',
      [userId]
    );

    // Delete old image if exists
    if (existing.length > 0 && existing[0].profile_image) {
      const oldImagePath = `.${existing[0].profile_image}`;
      try {
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      } catch (err) {
        console.log('Error deleting old image:', err);
      }
    }

    // Update profile image
    if (existing.length > 0) {
      await req.db.query(
        'UPDATE user_profiles SET profile_image = ? WHERE u_id = ?',
        [fileUrl, userId]
      );
    } else {
      await req.db.query(
        'INSERT INTO user_profiles (u_id, profile_image) VALUES (?, ?)',
        [userId, fileUrl]
      );
    }

    // Fetch updated user data
    const [users] = await req.db.query(
      `SELECT u.u_id, u.username, u.email,
              up.first_name, up.last_name, up.phone, up.phone_code,
              up.designation, up.department, up.gender, up.date_of_birth,
              up.profile_image,
              r.name as role_name, r.slug as role_slug
       FROM users u
       LEFT JOIN user_profiles up ON up.u_id = u.u_id
       LEFT JOIN roles r ON u.r_id = r.r_id
       WHERE u.u_id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return response.error(res, 'User not found', 404);
    }

    const user = users[0];
    const userData = {
      user_id: user.u_id,
      username: user.username,
      email: user.email,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      full_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username,
      phone: user.phone || '',
      phone_code: user.phone_code || '',
      designation: user.designation || '',
      department: user.department || '',
      gender: user.gender || '',
      date_of_birth: user.date_of_birth || '',
      profile_image: user.profile_image || '',
      role_name: user.role_name,
      role_slug: user.role_slug,
    };

    return response.success(res, 'Profile image uploaded successfully', {
      user: userData,
      profile_image: fileUrl,
    });

  } catch (err) {
    console.error('Upload profile image error:', err);
    // Delete uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(`./uploads/photos/${req.file.filename}`);
      } catch (e) {}
    }
    return response.serverError(res, err);
  }
};

/**
 * Delete profile image
 * DELETE /api/users/profile/image
 */
const deleteProfileImage = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get profile image
    const [profile] = await req.db.query(
      'SELECT profile_image FROM user_profiles WHERE u_id = ?',
      [userId]
    );

    if (profile.length === 0 || !profile[0].profile_image) {
      return response.error(res, 'No profile image found', 404);
    }

    // Delete image file
    const imagePath = `.${profile[0].profile_image}`;
    try {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    } catch (err) {
      console.log('Error deleting image file:', err);
    }

    // Update database
    await req.db.query(
      'UPDATE user_profiles SET profile_image = NULL WHERE u_id = ?',
      [userId]
    );

    return response.success(res, 'Profile image deleted successfully');

  } catch (err) {
    console.error('Delete profile image error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Get user permissions
 * GET /api/users/:id/permissions
 */
const getUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;

    // Get all permissions with user's grant status
    // role_permissions table has no `granted` column — presence = granted
    const [allPerms] = await req.db.query(
      `SELECT p.code, p.module, p.action, p.description,
              COALESCE(up.granted, CASE WHEN rp.p_id IS NOT NULL THEN 1 ELSE 0 END) as granted,
              CASE WHEN up.granted IS NOT NULL THEN 'user' ELSE 'role' END as source
       FROM permissions p
       LEFT JOIN user_permissions up ON p.p_id = up.p_id AND up.u_id = ?
       LEFT JOIN users u ON u.u_id = ?
       LEFT JOIN role_permissions rp ON p.p_id = rp.p_id AND rp.r_id = u.r_id
       ORDER BY p.module, p.display_order`,
      [id, id]
    );

    // Convert to object { code: true/false }
    // Return BOTH formats: DB code (leads.add) and frontend key (lead_add)
    const permissions = {};
    allPerms.forEach(p => {
      const granted = p.granted === 1;
      permissions[p.code] = granted; // DB format: leads.add
      // Frontend format: lead_add (singular module + underscore)
      const parts = p.code.split('.');
      if (parts.length === 2) {
        const mod = parts[0].endsWith('s') ? parts[0].slice(0, -1) : parts[0];
        permissions[`${mod}_${parts[1]}`] = granted;
      }
    });

    return response.success(res, 'Permissions fetched', { permissions });
  } catch (err) {
    console.error('Get user permissions error:', err);
    return response.serverError(res, err);
  }
};

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getDeleteInfo,
  toggleStatus,
  updateProfile,
  uploadProfileImage,
  deleteProfileImage,
  changePassword,
  getUserPermissions,
};
