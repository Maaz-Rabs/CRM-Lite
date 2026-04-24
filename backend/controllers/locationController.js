/**
 * Location Controller
 * Handles live location tracking endpoints
 */

const Location = require('../models/Location');
const response = require('../utils/response');

/**
 * Update current user's location
 * POST /api/location/update
 */
const updateLocation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { latitude, longitude, accuracy, address, battery_level } = req.body;

    console.log(`[LOCATION] User ${userId} sending: lat=${latitude}, lng=${longitude}, battery=${battery_level}`);

    if (!latitude || !longitude) {
      return response.error(res, 'Latitude and longitude are required', 400);
    }

    const location = new Location(req.db);
    const id = await location.trackLocation(userId, {
      latitude,
      longitude,
      accuracy,
      address,
      battery_level,
    });

    console.log(`[LOCATION] User ${userId} location saved, id=${id}`);
    return response.success(res, 'Location updated', { id });
  } catch (err) {
    console.error('[LOCATION] Update location error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Get all team members with their latest locations
 * GET /api/location/team
 */
const getTeamLocations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const roleLevel = req.user.roleLevel;

    // Build query based on role
    let userQuery;
    let userParams;

    if (roleLevel <= 2) {
      // Master/Admin: see all active users
      userQuery = `
        SELECT u.u_id, u.username, u.is_online,
               r.name as role_name, r.slug as role_slug,
               up.first_name, up.last_name, up.phone, up.profile_image
        FROM users u
        LEFT JOIN roles r ON u.r_id = r.r_id
        LEFT JOIN user_profiles up ON u.u_id = up.u_id
        WHERE u.is_active = 1 AND u.u_id != ?`;
      userParams = [userId];
    } else {
      // Team Leader/Sales Manager/Branch Admin: see their reports
      userQuery = `
        SELECT u.u_id, u.username, u.is_online,
               r.name as role_name, r.slug as role_slug,
               up.first_name, up.last_name, up.phone, up.profile_image
        FROM users u
        LEFT JOIN roles r ON u.r_id = r.r_id
        LEFT JOIN user_profiles up ON u.u_id = up.u_id
        WHERE u.is_active = 1
          AND (u.reports_to = ? OR u.team_leader_id = ? OR u.sales_manager_id = ?)`;
      userParams = [userId, userId, userId];
    }

    const [users] = await req.db.query(userQuery, userParams);

    if (users.length === 0) {
      return response.success(res, 'No team members found', { members: [] });
    }

    // Get latest locations
    const userIds = users.map(u => u.u_id);
    const location = new Location(req.db);
    const locations = await location.getTeamLocations(userIds);

    const locationMap = {};
    locations.forEach(loc => {
      locationMap[loc.u_id] = loc;
    });

    // Get today's attendance status
    const today = new Date().toISOString().split('T')[0];
    const attPlaceholders = userIds.map(() => '?').join(',');
    const [attendances] = await req.db.query(
      `SELECT u_id, punch_in_time, punch_out_time
       FROM attendance
       WHERE u_id IN (${attPlaceholders}) AND att_date = ?`,
      [...userIds, today]
    );

    const attendanceMap = {};
    attendances.forEach(att => {
      attendanceMap[att.u_id] = att;
    });

    // Merge users + locations + attendance
    const members = users.map(user => {
      const loc = locationMap[user.u_id] || null;
      const att = attendanceMap[user.u_id] || null;

      const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
      const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

      return {
        id: user.u_id.toString(),
        name: displayName,
        avatar: initials,
        role: user.role_name || 'User',
        role_slug: user.role_slug,
        phone: user.phone || null,
        profile_image: user.profile_image || null,
        is_online: user.is_online === 1,
        status: user.is_online === 1 ? 'online' : 'offline',
        isPunchedIn: !!(att && att.punch_in_time && !att.punch_out_time),
        location: loc ? {
          latitude: parseFloat(loc.latitude),
          longitude: parseFloat(loc.longitude),
          accuracy: loc.accuracy ? parseFloat(loc.accuracy) : null,
          address: loc.address || 'Unknown location',
          battery_level: loc.battery_level != null ? parseFloat(loc.battery_level) : null,
          tracked_at: loc.tracked_at,
        } : null,
      };
    });

    return response.success(res, 'Team locations fetched', { members });
  } catch (err) {
    console.error('Get team locations error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Request current location from a user
 * POST /api/location/request
 * Body: { target_user_id }
 * Sends a push notification to the target user asking them to share location
 */
const requestLocation = async (req, res) => {
  try {
    const requesterId = req.user.userId;
    const { target_user_id } = req.body;

    if (!target_user_id) {
      return response.error(res, 'target_user_id is required');
    }

    // Get requester name
    const [requesterRows] = await req.db.query(
      `SELECT CONCAT(COALESCE(up.first_name, u.username), ' ', COALESCE(up.last_name, '')) as name
       FROM users u LEFT JOIN user_profiles up ON u.u_id = up.u_id
       WHERE u.u_id = ?`,
      [requesterId]
    );
    const requesterName = requesterRows[0]?.name?.trim() || 'Admin';

    // Get target user's device token
    const [targetRows] = await req.db.query(
      `SELECT u.u_id, u.device_token, u.username,
              CONCAT(COALESCE(up.first_name, u.username), ' ', COALESCE(up.last_name, '')) as name
       FROM users u LEFT JOIN user_profiles up ON u.u_id = up.u_id
       WHERE u.u_id = ? AND u.is_active = 1`,
      [target_user_id]
    );

    if (targetRows.length === 0) {
      return response.error(res, 'User not found');
    }

    const targetUser = targetRows[0];

    // Create a location request record
    await req.db.query(
      `INSERT INTO location_requests (requester_id, target_id, status)
       VALUES (?, ?, 'pending')`,
      [requesterId, target_user_id]
    );

    const [insertResult] = await req.db.query('SELECT LAST_INSERT_ID() as id');
    const requestId = insertResult[0].id;

    // Send push notification
    if (targetUser.device_token) {
      const { sendNotification, storeNotification } = require('../services/notificationService');

      const title = 'Location Request';
      const body = `${requesterName} is requesting your current location`;
      const data = {
        type: 'location_request',
        request_id: String(requestId),
        requester_id: String(requesterId),
        requester_name: requesterName,
      };

      storeNotification(req.db, target_user_id, 'alert', title, body, data);
      sendNotification(targetUser.device_token, title, body, data).catch(err =>
        console.error('[LOCATION REQUEST] notify error:', err)
      );

      console.log(`[LOCATION REQUEST] ${requesterName} requested location from ${targetUser.name?.trim()}`);
    }

    return response.success(res, 'Location request sent', { request_id: requestId });
  } catch (err) {
    console.error('Request location error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Respond to a location request (accept with current location)
 * POST /api/location/request/:id/respond
 * Body: { latitude, longitude, address, battery_level }
 */
const respondLocationRequest = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { latitude, longitude, address, battery_level } = req.body;

    if (!latitude || !longitude) {
      return response.error(res, 'Latitude and longitude are required');
    }

    // Get the request
    const [requests] = await req.db.query(
      'SELECT * FROM location_requests WHERE lr_id = ? AND target_id = ? AND status = ?',
      [id, userId, 'pending']
    );

    if (requests.length === 0) {
      return response.error(res, 'Request not found or already responded');
    }

    const locationRequest = requests[0];

    // Update request with response
    await req.db.query(
      `UPDATE location_requests
       SET status = 'accepted', response_lat = ?, response_lng = ?,
           response_address = ?, response_battery = ?, responded_at = NOW()
       WHERE lr_id = ?`,
      [latitude, longitude, address || '', battery_level || null, id]
    );

    // Also update the user's tracked location
    const location = new Location(req.db);
    await location.trackLocation(userId, { latitude, longitude, address, battery_level });

    // Notify the requester
    const [requesterRows] = await req.db.query(
      `SELECT u.device_token,
              CONCAT(COALESCE(up.first_name, u.username), ' ', COALESCE(up.last_name, '')) as target_name
       FROM users u LEFT JOIN user_profiles up ON u.u_id = up.u_id
       WHERE u.u_id = ?`,
      [locationRequest.requester_id]
    );

    // Get responder name
    const [responderRows] = await req.db.query(
      `SELECT CONCAT(COALESCE(up.first_name, u.username), ' ', COALESCE(up.last_name, '')) as name
       FROM users u LEFT JOIN user_profiles up ON u.u_id = up.u_id
       WHERE u.u_id = ?`,
      [userId]
    );
    const responderName = responderRows[0]?.name?.trim() || 'User';

    if (requesterRows[0]?.device_token) {
      const { sendNotification, storeNotification } = require('../services/notificationService');

      const title = 'Location Shared';
      const body = `${responderName} shared their location: ${address || 'Location received'}`;
      const data = {
        type: 'location_response',
        request_id: String(id),
        target_user_id: String(userId),
        latitude: String(latitude),
        longitude: String(longitude),
        address: address || '',
      };

      storeNotification(req.db, locationRequest.requester_id, 'alert', title, body, data);
      sendNotification(requesterRows[0].device_token, title, body, data).catch(err =>
        console.error('[LOCATION RESPONSE] notify error:', err)
      );
    }

    return response.success(res, 'Location shared successfully');
  } catch (err) {
    console.error('Respond location request error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Get pending location requests for the current user
 * GET /api/location/requests/pending
 */
const getPendingRequests = async (req, res) => {
  try {
    const userId = req.user.userId;
    const [requests] = await req.db.query(
      `SELECT lr.lr_id, lr.requester_id, lr.status, lr.created_at,
              CONCAT(COALESCE(up.first_name, u.username), ' ', COALESCE(up.last_name, '')) as requester_name
       FROM location_requests lr
       JOIN users u ON lr.requester_id = u.u_id
       LEFT JOIN user_profiles up ON u.u_id = up.u_id
       WHERE lr.target_id = ? AND lr.status = 'pending'
         AND lr.created_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE)
       ORDER BY lr.created_at DESC`,
      [userId]
    );
    return response.success(res, 'Pending requests', requests);
  } catch (err) {
    console.error('Get pending requests error:', err);
    return response.serverError(res, err);
  }
};

module.exports = {
  updateLocation,
  getTeamLocations,
  requestLocation,
  respondLocationRequest,
  getPendingRequests,
};
