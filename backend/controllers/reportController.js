// ============================================================================
// REPORT CONTROLLER
// User performance reports with lead, activity, attendance, call,
// location, login history & conversion data
// ============================================================================

const response = require('../utils/response');

/**
 * GET /api/reports/users
 * Returns list of users with summary stats for the report selection screen
 */
const getUsersList = async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.userId;
    const userRole = req.user.roleSlug;
    const { start_date, end_date } = req.query;

    const now = new Date();
    const sd = start_date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const ed = end_date || now.toISOString().split('T')[0];

    // Calculate previous period (same duration, shifted back)
    const startDt = new Date(sd);
    const endDt = new Date(ed);
    const diffMs = endDt.getTime() - startDt.getTime() + 86400000; // +1 day inclusive
    const prevEnd = new Date(startDt.getTime() - 86400000); // day before current start
    const prevStart = new Date(prevEnd.getTime() - diffMs + 86400000);
    const psd = prevStart.toISOString().split('T')[0];
    const ped = prevEnd.toISOString().split('T')[0];

    // Hierarchy filter
    let hierarchyFilter = '';
    const hierarchyParams = [];
    if (userRole === 'sales_manager') {
      hierarchyFilter = ' AND u.u_id != ? AND (u.sales_manager_id = ? OR u.reports_to = ?)';
      hierarchyParams.push(userId, userId, userId);
    } else if (userRole === 'team_leader') {
      hierarchyFilter = ' AND u.u_id != ? AND (u.team_leader_id = ? OR u.reports_to = ? OR u.sales_manager_id IN (SELECT u2.u_id FROM users u2 WHERE u2.team_leader_id = ? OR u2.reports_to = ?))';
      hierarchyParams.push(userId, userId, userId, userId, userId);
    }
    // Master/Admin see all users

    const [[users], [prevUsers]] = await Promise.all([
      db.query(`
        SELECT
          u.u_id,
          u.username,
          COALESCE(CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, '')), u.username) as full_name,
          up.designation,
          up.profile_image,
          r.name as role_name,
          u.is_active,
          u.last_login_at,
          (SELECT COUNT(*) FROM lead_assignments la JOIN leads l ON la.l_id = l.l_id WHERE la.u_id = u.u_id AND la.is_active = 1 AND l.is_archived = 0) as total_leads,
          (SELECT COUNT(*) FROM lead_activities la2 WHERE la2.u_id = u.u_id AND la2.create_dt >= ? AND la2.create_dt <= CONCAT(?, ' 23:59:59')) as total_activities,
          (SELECT COUNT(*) FROM lead_activities la3 WHERE la3.u_id = u.u_id AND la3.activity_type = 'call' AND la3.create_dt >= ? AND la3.create_dt <= CONCAT(?, ' 23:59:59')) as total_calls,
          (SELECT ROUND(SUM(IFNULL(la4.call_duration, 0)) / 60, 1) FROM lead_activities la4 WHERE la4.u_id = u.u_id AND la4.activity_type = 'call' AND la4.create_dt >= ? AND la4.create_dt <= CONCAT(?, ' 23:59:59')) as call_duration_mins,
          (SELECT COUNT(DISTINCT att_date) FROM attendance a WHERE a.u_id = u.u_id AND a.status = 'present' AND a.att_date >= ? AND a.att_date <= ?) as present_days
        FROM users u
        LEFT JOIN user_profiles up ON u.u_id = up.u_id
        LEFT JOIN roles r ON u.r_id = r.r_id
        WHERE u.is_active = 1 AND r.level > 2${hierarchyFilter}
        ORDER BY full_name ASC
      `, [sd, ed, sd, ed, sd, ed, sd, ed, ...hierarchyParams]),

      // Previous period stats per user
      db.query(`
        SELECT
          u.u_id,
          (SELECT COUNT(*) FROM lead_activities la2 WHERE la2.u_id = u.u_id AND la2.create_dt >= ? AND la2.create_dt <= CONCAT(?, ' 23:59:59')) as prev_activities,
          (SELECT COUNT(*) FROM lead_activities la3 WHERE la3.u_id = u.u_id AND la3.activity_type = 'call' AND la3.create_dt >= ? AND la3.create_dt <= CONCAT(?, ' 23:59:59')) as prev_calls
        FROM users u
        LEFT JOIN roles r ON u.r_id = r.r_id
        WHERE u.is_active = 1 AND r.level > 2${hierarchyFilter}
      `, [psd, ped, psd, ped, ...hierarchyParams]),
    ]);

    // Build previous period lookup
    const prevMap = {};
    (prevUsers || []).forEach(p => { prevMap[p.u_id] = p; });

    const mapped = users.map(u => {
      const prev = prevMap[u.u_id] || {};
      const prevAct = prev.prev_activities || 0;
      const prevCalls = prev.prev_calls || 0;
      const curAct = u.total_activities || 0;
      const curCalls = u.total_calls || 0;

      // Calculate percentage change (activities as primary metric)
      let changePercent = null;
      if (prevAct > 0) {
        changePercent = Math.round(((curAct - prevAct) / prevAct) * 100);
      } else if (curAct > 0) {
        changePercent = 100; // all new
      }

      return {
        ...u,
        full_name: (u.full_name || '').trim() || u.username,
        prev_activities: prevAct,
        prev_calls: prevCalls,
        change_percent: changePercent,
      };
    });

    return response.success(res, 'Users list fetched', { users: mapped, start_date: sd, end_date: ed, prev_start_date: psd, prev_end_date: ped });
  } catch (err) {
    console.error('Report users list error:', err);
    return response.serverError(res, err);
  }
};

/**
 * GET /api/reports/users/:id
 * Returns complete report for a single user
 */
const getUserReport = async (req, res) => {
  try {
    const db = req.db;
    const userId = req.params.id;
    const { start_date, end_date } = req.query;

    const now = new Date();
    const sd = start_date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const ed = end_date || now.toISOString().split('T')[0];

    // Run all queries in parallel
    const [
      [userRows],
      [leadStats],
      [activityBreakdown],
      [followupStats],
      [attendanceStats],
      [callStats],
      [statusBreakdown],
      [recentActivities],
      [conversionStats],
      [overdueFollowups],
      [loginHistory],
      [lastLocation],
      [callRecordingCount],
    ] = await Promise.all([
      // User info with join date
      db.query(`
        SELECT u.u_id, u.username, u.email, u.is_active, u.last_login_at, u.last_login_ip,
          u.device_platform,
          COALESCE(CONCAT(COALESCE(up.first_name, ''), ' ', COALESCE(up.last_name, '')), u.username) as full_name,
          up.phone, up.designation, up.department, up.profile_image, up.join_date,
          r.name as role_name,
          (SELECT username FROM users WHERE u_id = u.reports_to) as reports_to_name
        FROM users u
        LEFT JOIN user_profiles up ON u.u_id = up.u_id
        LEFT JOIN roles r ON u.r_id = r.r_id
        WHERE u.u_id = ?
      `, [userId]),

      // Lead stats
      db.query(`
        SELECT
          (SELECT COUNT(*) FROM lead_assignments la JOIN leads l ON la.l_id = l.l_id WHERE la.u_id = ? AND la.is_active = 1 AND l.is_archived = 0) as assigned_leads,
          (SELECT COUNT(*) FROM leads l WHERE l.created_by = ? AND l.is_archived = 0 AND DATE(l.create_dt) >= ? AND DATE(l.create_dt) <= ?) as created_leads,
          (SELECT COUNT(*) FROM lead_assignments la2
            JOIN leads l2 ON la2.l_id = l2.l_id
            WHERE la2.u_id = ? AND la2.is_active = 1 AND l2.is_archived = 0
              AND DATE(la2.create_dt) >= ? AND DATE(la2.create_dt) <= ?) as new_assignments
      `, [userId, userId, sd, ed, userId, sd, ed]),

      // Activity breakdown by type
      db.query(`
        SELECT activity_type, COUNT(*) as count
        FROM lead_activities
        WHERE u_id = ? AND create_dt >= ? AND create_dt <= CONCAT(?, ' 23:59:59')
        GROUP BY activity_type
        ORDER BY count DESC
      `, [userId, sd, ed]),

      // Followup stats
      db.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
        FROM lead_followups
        WHERE u_id = ? AND DATE(create_dt) >= ? AND DATE(create_dt) <= ?
      `, [userId, sd, ed]),

      // Attendance stats
      db.query(`
        SELECT
          COUNT(DISTINCT att_date) as total_days,
          COUNT(DISTINCT CASE WHEN status = 'present' THEN att_date END) as present_days,
          COUNT(DISTINCT CASE WHEN status = 'absent' THEN att_date END) as absent_days,
          COUNT(DISTINCT CASE WHEN status = 'halfday' THEN att_date END) as halfday_days,
          COUNT(DISTINCT CASE WHEN status = 'leave' THEN att_date END) as leave_days,
          ROUND(SUM(IFNULL(total_hours, 0)), 1) as total_hours,
          ROUND(SUM(IFNULL(total_hours, 0)) / NULLIF(COUNT(DISTINCT att_date), 0), 1) as avg_hours
        FROM attendance
        WHERE u_id = ? AND att_date >= ? AND att_date <= ?
      `, [userId, sd, ed]),

      // Call stats
      db.query(`
        SELECT
          COUNT(*) as total_calls,
          SUM(CASE WHEN call_type = 'outgoing' THEN 1 ELSE 0 END) as outgoing,
          SUM(CASE WHEN call_type = 'incoming' THEN 1 ELSE 0 END) as incoming,
          SUM(CASE WHEN call_type = 'missed' THEN 1 ELSE 0 END) as missed,
          ROUND(SUM(IFNULL(call_duration, 0)) / 60, 1) as total_duration_mins,
          ROUND(AVG(IFNULL(call_duration, 0)), 0) as avg_duration_secs
        FROM lead_activities
        WHERE u_id = ? AND activity_type = 'call'
          AND create_dt >= ? AND create_dt <= CONCAT(?, ' 23:59:59')
      `, [userId, sd, ed]),

      // Lead status breakdown (for assigned leads)
      db.query(`
        SELECT
          COALESCE(ls.name, 'Unassigned') as status_name,
          ls.color as status_color,
          COALESCE(ls.is_positive, 0) as is_positive,
          COALESCE(ls.is_negative, 0) as is_negative,
          COUNT(*) as count
        FROM lead_assignments la
        JOIN leads l ON la.l_id = l.l_id
        LEFT JOIN lead_statuses ls ON l.ls_id = ls.ls_id
        WHERE la.u_id = ? AND la.is_active = 1 AND l.is_archived = 0
        GROUP BY ls.name, ls.color, ls.is_positive, ls.is_negative
        ORDER BY count DESC
      `, [userId]),

      // Recent 10 activities
      db.query(`
        SELECT
          la.lac_id, la.activity_type, la.comment, la.call_type, la.call_duration, la.create_dt,
          l.name as lead_name
        FROM lead_activities la
        LEFT JOIN leads l ON la.l_id = l.l_id
        WHERE la.u_id = ? AND la.create_dt >= ? AND la.create_dt <= CONCAT(?, ' 23:59:59')
        ORDER BY la.create_dt DESC
        LIMIT 10
      `, [userId, sd, ed]),

      // ─── NEW: Conversion stats (positive/negative outcomes) ───
      db.query(`
        SELECT
          SUM(CASE WHEN ls.is_positive = 1 THEN 1 ELSE 0 END) as won_leads,
          SUM(CASE WHEN ls.is_negative = 1 THEN 1 ELSE 0 END) as lost_leads,
          COUNT(*) as total_assigned
        FROM lead_assignments la
        JOIN leads l ON la.l_id = l.l_id
        LEFT JOIN lead_statuses ls ON l.ls_id = ls.ls_id
        WHERE la.u_id = ? AND la.is_active = 1 AND l.is_archived = 0
      `, [userId]),

      // ─── NEW: Overdue followups ───
      db.query(`
        SELECT COUNT(*) as overdue
        FROM lead_followups
        WHERE u_id = ? AND status = 'pending' AND is_active = 1 AND followup_dt < NOW()
      `, [userId]),

      // ─── NEW: Login history ───
      db.query(`
        SELECT
          COUNT(*) as total_logins,
          MIN(login_at) as first_login,
          MAX(login_at) as last_login,
          (SELECT device_platform FROM login_history WHERE u_id = ? AND status = 'success' ORDER BY login_at DESC LIMIT 1) as last_device
        FROM login_history
        WHERE u_id = ? AND status = 'success'
          AND login_at >= ? AND login_at <= CONCAT(?, ' 23:59:59')
      `, [userId, userId, sd, ed]),

      // ─── NEW: Last known location ───
      db.query(`
        SELECT latitude, longitude, address, battery_level, tracked_at
        FROM user_locations
        WHERE u_id = ?
        ORDER BY tracked_at DESC
        LIMIT 1
      `, [userId]),

      // ─── NEW: Calls with recordings ───
      db.query(`
        SELECT COUNT(*) as recorded_calls
        FROM lead_activities
        WHERE u_id = ? AND activity_type = 'call'
          AND call_recording_url IS NOT NULL AND call_recording_url != ''
          AND create_dt >= ? AND create_dt <= CONCAT(?, ' 23:59:59')
      `, [userId, sd, ed]),
    ]);

    if (userRows.length === 0) {
      return response.error(res, 'User not found', 404);
    }

    const user = userRows[0];
    user.full_name = (user.full_name || '').trim() || user.username;

    // Calculate tenure
    let tenureDays = null;
    if (user.join_date) {
      const joinDt = new Date(user.join_date);
      tenureDays = Math.floor((new Date() - joinDt) / (1000 * 60 * 60 * 24));
    }

    // Activity breakdown map
    const activityMap = {};
    (activityBreakdown || []).forEach(a => { activityMap[a.activity_type] = a.count; });

    // Conversion calculations
    const totalAssigned = conversionStats[0]?.total_assigned || 0;
    const wonLeads = conversionStats[0]?.won_leads || 0;
    const lostLeads = conversionStats[0]?.lost_leads || 0;
    const conversionRate = totalAssigned > 0 ? Math.round((wonLeads / totalAssigned) * 100) : 0;

    // Followup completion rate
    const fuTotal = followupStats[0]?.total || 0;
    const fuCompleted = followupStats[0]?.completed || 0;
    const followupCompletionRate = fuTotal > 0 ? Math.round((fuCompleted / fuTotal) * 100) : 0;

    return response.success(res, 'User report fetched', {
      user,
      dateRange: { start_date: sd, end_date: ed },
      tenure: {
        joinDate: user.join_date || null,
        days: tenureDays,
      },
      leads: {
        assigned: leadStats[0]?.assigned_leads || 0,
        created: leadStats[0]?.created_leads || 0,
        newAssignments: leadStats[0]?.new_assignments || 0,
        statusBreakdown: statusBreakdown || [],
      },
      conversion: {
        won: wonLeads,
        lost: lostLeads,
        total: totalAssigned,
        rate: conversionRate,
      },
      activities: {
        total: Object.values(activityMap).reduce((s, v) => s + v, 0),
        breakdown: activityMap,
      },
      followups: {
        total: fuTotal,
        completed: fuCompleted,
        pending: followupStats[0]?.pending || 0,
        cancelled: followupStats[0]?.cancelled || 0,
        overdue: overdueFollowups[0]?.overdue || 0,
        completionRate: followupCompletionRate,
      },
      attendance: {
        totalDays: attendanceStats[0]?.total_days || 0,
        presentDays: attendanceStats[0]?.present_days || 0,
        absentDays: attendanceStats[0]?.absent_days || 0,
        halfdayDays: attendanceStats[0]?.halfday_days || 0,
        leaveDays: attendanceStats[0]?.leave_days || 0,
        totalHours: attendanceStats[0]?.total_hours || 0,
        avgHours: attendanceStats[0]?.avg_hours || 0,
      },
      calls: {
        total: callStats[0]?.total_calls || 0,
        outgoing: callStats[0]?.outgoing || 0,
        incoming: callStats[0]?.incoming || 0,
        missed: callStats[0]?.missed || 0,
        totalDurationMins: callStats[0]?.total_duration_mins || 0,
        avgDurationSecs: callStats[0]?.avg_duration_secs || 0,
        recorded: callRecordingCount[0]?.recorded_calls || 0,
      },
      login: {
        totalLogins: loginHistory[0]?.total_logins || 0,
        lastLogin: loginHistory[0]?.last_login || user.last_login_at || null,
        lastDevice: loginHistory[0]?.last_device || user.device_platform || null,
        lastIp: user.last_login_ip || null,
      },
      location: lastLocation[0] || null,
      recentActivities: recentActivities || [],
    });
  } catch (err) {
    console.error('User report error:', err);
    return response.serverError(res, err);
  }
};

module.exports = {
  getUsersList,
  getUserReport,
};
