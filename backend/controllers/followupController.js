const response = require('../utils/response');

/**
 * Get followups with filter (today, missed, upcoming)
 * GET /api/followups?filter=today|missed|upcoming&page=1&limit=20
 */
const getFollowups = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.roleSlug;
    const isAdmin = userRole === 'master' || userRole === 'admin';

    const { filter = 'today', page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Role-based lead access
    let leadFilter = '';
    const params = [];
    if (!isAdmin) {
      leadFilter = `AND (l.created_by = ? OR EXISTS (
        SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.u_id = ? AND la.is_active = 1
      ))`;
      params.push(userId, userId);
    }

    // Date filter
    let dateFilter = '';
    if (filter === 'today') {
      dateFilter = 'AND DATE(lf.followup_dt) = CURDATE()';
    } else if (filter === 'missed') {
      dateFilter = 'AND lf.followup_dt < NOW() AND lf.status = \'pending\'';
    } else if (filter === 'upcoming') {
      dateFilter = 'AND lf.followup_dt > NOW() AND lf.status = \'pending\'';
    }

    // Search
    let searchFilter = '';
    if (search) {
      searchFilter = 'AND (l.name LIKE ? OR l.mobile LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Count
    const [countResult] = await req.db.query(
      `SELECT COUNT(*) as total
       FROM lead_followups lf
       JOIN leads l ON lf.l_id = l.l_id
       WHERE lf.is_active = 1 AND l.is_archived = 0
       ${leadFilter} ${dateFilter} ${searchFilter}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Data
    const dataParams = [...params, parseInt(limit), offset];
    const [followups] = await req.db.query(
      `SELECT
        lf.lf_id, lf.l_id, lf.followup_dt, lf.note, lf.status, lf.create_dt,
        l.name as lead_name, l.mobile as lead_mobile, l.country_code,
        l.email as lead_email,
        ls.name as status_name, ls.color as status_color,
        lp.name as priority_name, lp.color as priority_color,
        u.username as assigned_by_name,
        GROUP_CONCAT(DISTINCT au.username) as assigned_users
       FROM lead_followups lf
       JOIN leads l ON lf.l_id = l.l_id
       LEFT JOIN lead_statuses ls ON l.ls_id = ls.ls_id
       LEFT JOIN lead_priorities lp ON l.lp_id = lp.lp_id
       LEFT JOIN users u ON lf.u_id = u.u_id
       LEFT JOIN lead_assignments laa ON laa.l_id = l.l_id AND laa.is_active = 1
       LEFT JOIN users au ON laa.u_id = au.u_id
       WHERE lf.is_active = 1 AND l.is_archived = 0
       ${leadFilter} ${dateFilter} ${searchFilter}
       GROUP BY lf.lf_id
       ORDER BY lf.followup_dt ${filter === 'missed' ? 'DESC' : 'ASC'}
       LIMIT ? OFFSET ?`,
      dataParams
    );

    // Summary counts
    const summaryParams = isAdmin ? [] : [userId, userId];
    const [summary] = await req.db.query(
      `SELECT
        SUM(CASE WHEN DATE(lf.followup_dt) = CURDATE() AND lf.status = 'pending' THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN lf.followup_dt < NOW() AND lf.status = 'pending' THEN 1 ELSE 0 END) as missed,
        SUM(CASE WHEN lf.followup_dt > NOW() AND lf.status = 'pending' THEN 1 ELSE 0 END) as upcoming
       FROM lead_followups lf
       JOIN leads l ON lf.l_id = l.l_id
       WHERE lf.is_active = 1 AND l.is_archived = 0
       ${isAdmin ? '' : `AND (l.created_by = ? OR EXISTS (SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.u_id = ? AND la.is_active = 1))`}`,
      summaryParams
    );

    return response.success(res, 'Followups fetched', {
      followups,
      summary: summary[0] || { today: 0, missed: 0, upcoming: 0 },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get followups error:', err);
    return response.serverError(res, err);
  }
};

module.exports = { getFollowups };
