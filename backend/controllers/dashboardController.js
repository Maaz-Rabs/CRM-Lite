// Dashboard Controller - aggregates data for the mobile app dashboard

exports.getSummary = async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.userId;
    const roleLevel = req.user.roleLevel;
    const roleSlug = req.user.roleSlug;

    // Role-based filtering
    const isAdmin = roleSlug === 'master' || roleSlug === 'admin';
    const isSM = roleSlug === 'sales_manager';
    const isTL = roleSlug === 'team_leader';

    // Build WHERE clause for lead filtering (matches Lead.findAll logic)
    let leadFilter, leadParams;
    if (isAdmin) {
      leadFilter = 'l.is_archived = 0';
      leadParams = [];
    } else if (isTL) {
      leadFilter = `l.is_archived = 0 AND (l.created_by = ? OR EXISTS (
        SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.is_active = 1
        AND (la.u_id = ? OR la.assigned_by = ? OR la.u_id IN (
          SELECT u.u_id FROM users u WHERE u.team_leader_id = ? OR u.reports_to = ?
        ))
      ))`;
      leadParams = [userId, userId, userId, userId, userId];
    } else if (isSM) {
      leadFilter = `l.is_archived = 0 AND (l.created_by = ? OR EXISTS (
        SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND (la.u_id = ? OR la.assigned_by = ?) AND la.is_active = 1
      ))`;
      leadParams = [userId, userId, userId];
    } else {
      leadFilter = `l.is_archived = 0 AND (l.created_by = ? OR EXISTS (
        SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.u_id = ? AND la.is_active = 1
      ))`;
      leadParams = [userId, userId];
    }

    // Run all queries in parallel
    const [
      [leadStats],
      [todayLeadStats],
      [brokerStats],
      [pipelineData],
      [recentLeads],
      [upcomingFollowups],
      [leadSourceData],
      [todayActivity],
    ] = await Promise.all([
      // Total leads (non-archived)
      db.execute(`
        SELECT COUNT(*) as totalLeads
        FROM leads l
        WHERE ${leadFilter}
      `, [...leadParams]),

      // Today's leads
      db.execute(`
        SELECT COUNT(*) as todayLeads
        FROM leads l
        WHERE ${leadFilter} AND DATE(l.create_dt) = CURDATE()
      `, [...leadParams]),

      // Broker stats (admins only, others get 0)
      isAdmin
        ? db.execute(`
            SELECT
              COUNT(*) as totalBrokers,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeBrokers
            FROM brokers
            WHERE deleted_at IS NULL
          `)
        : Promise.resolve([[{ totalBrokers: 0, activeBrokers: 0 }]]),

      // Lead pipeline (by status)
      db.execute(`
        SELECT
          ls.ls_id,
          ls.name as label,
          ls.color,
          COUNT(l.l_id) as count
        FROM lead_statuses ls
        LEFT JOIN leads l ON l.ls_id = ls.ls_id AND ${leadFilter}
        WHERE ls.is_active = 1
        GROUP BY ls.ls_id, ls.name, ls.color
        ORDER BY ls.display_order ASC
      `, [...leadParams]),

      // Recent 5 leads
      db.execute(`
        SELECT
          l.l_id, l.name, l.mobile, l.email, l.source_type,
          l.create_dt,
          ls.name as status_name, ls.color as status_color
        FROM leads l
        LEFT JOIN lead_statuses ls ON l.ls_id = ls.ls_id
        WHERE ${leadFilter}
        ORDER BY l.create_dt DESC
        LIMIT 5
      `, [...leadParams]),

      // Upcoming 5 followups
      db.execute(`
        SELECT
          lf.lf_id, lf.followup_dt, lf.note,
          l.name as lead_name, l.mobile as lead_mobile,
          ls.name as status_name, ls.color as status_color
        FROM lead_followups lf
        JOIN leads l ON lf.l_id = l.l_id
        LEFT JOIN lead_statuses ls ON l.ls_id = ls.ls_id
        WHERE lf.is_active = 1
          AND lf.followup_dt >= NOW()
          AND ${leadFilter}
        ORDER BY lf.followup_dt ASC
        LIMIT 5
      `, [...leadParams]),

      // Lead sources breakdown
      db.execute(`
        SELECT
          COALESCE(src.name, l.source_type) as source,
          COUNT(*) as count
        FROM leads l
        LEFT JOIN lead_sources src ON l.src_id = src.src_id
        WHERE ${leadFilter}
        GROUP BY COALESCE(src.name, l.source_type)
        ORDER BY count DESC
      `, [...leadParams]),

      // Today's activity
      isAdmin
        ? db.execute(`
            SELECT
              (SELECT COUNT(*) FROM leads WHERE is_archived = 0 AND DATE(create_dt) = CURDATE()) as newLeads,
              (SELECT COUNT(*) FROM lead_followups lf
               JOIN leads l2 ON lf.l_id = l2.l_id
               WHERE lf.is_active = 1 AND DATE(lf.followup_dt) = CURDATE() AND l2.is_archived = 0
              ) as todayFollowups,
              (SELECT COUNT(*) FROM lead_activities la
               WHERE DATE(la.create_dt) = CURDATE()
              ) as totalActivities
          `)
        : db.execute(`
            SELECT
              (SELECT COUNT(*) FROM leads l
               WHERE l.is_archived = 0 AND DATE(l.create_dt) = CURDATE()
                 AND l.l_id IN (SELECT la.l_id FROM lead_assignments la WHERE la.u_id = ? AND la.is_active = 1)
              ) as newLeads,
              (SELECT COUNT(*) FROM lead_followups lf
               JOIN leads l2 ON lf.l_id = l2.l_id
               WHERE lf.is_active = 1 AND DATE(lf.followup_dt) = CURDATE() AND l2.is_archived = 0
                 AND l2.l_id IN (SELECT la.l_id FROM lead_assignments la WHERE la.u_id = ? AND la.is_active = 1)
              ) as todayFollowups,
              (SELECT COUNT(*) FROM lead_activities la
               WHERE DATE(la.create_dt) = CURDATE() AND la.u_id = ?
              ) as totalActivities
          `, [userId, userId, userId]),
    ]);

    // Project-wise leads with role-based filter
    let projectLeads = [];
    try {
      const projQuery = `
        SELECT p.project_id, p.name, COUNT(DISTINCT l.l_id) as count
        FROM projects p
        LEFT JOIN lead_requirements lr ON lr.is_active = 1
          AND JSON_CONTAINS(lr.project_ids, CAST(p.project_id AS CHAR))
        LEFT JOIN leads l ON l.l_id = lr.l_id AND ${leadFilter}
        WHERE p.is_active = 1
        GROUP BY p.project_id, p.name
        ORDER BY count DESC
      `;
      const [projRows] = await db.execute(projQuery, leadParams);
      projectLeads = projRows || [];
    } catch (e) {
      console.log('Project leads query failed:', e.message);
    }

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalLeads: leadStats[0]?.totalLeads || 0,
          todayLeads: todayLeadStats[0]?.todayLeads || 0,
          totalBrokers: brokerStats[0]?.totalBrokers || 0,
          activeBrokers: brokerStats[0]?.activeBrokers || 0,
        },
        pipeline: pipelineData || [],
        recentLeads: recentLeads || [],
        upcomingFollowups: upcomingFollowups || [],
        leadSources: leadSourceData || [],
        projectLeads: projectLeads,
        todayActivity: {
          newLeads: todayActivity[0]?.newLeads || 0,
          todayFollowups: todayActivity[0]?.todayFollowups || 0,
          totalActivities: todayActivity[0]?.totalActivities || 0,
        },
      },
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message,
    });
  }
};

// ─── PROJECT LEADS with status breakdown ────────────────────
exports.getProjectLeads = async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.userId;
    const roleSlug = req.user.roleSlug;
    const projectId = String(req.params.id);
    const ls_id = req.query.ls_id || null;
    const isAdmin = roleSlug === 'master' || roleSlug === 'admin';
    const isSM = roleSlug === 'sales_manager';
    const isTL = roleSlug === 'team_leader';

    // Role-based lead filter (matches Lead.findAll)
    let userFilter = '';
    let userParams = [];
    if (!isAdmin) {
      if (isTL) {
        userFilter = ` AND (l.created_by = ? OR EXISTS (
          SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.is_active = 1
          AND (la.u_id = ? OR la.assigned_by = ? OR la.u_id IN (
            SELECT u.u_id FROM users u WHERE u.team_leader_id = ? OR u.reports_to = ?
          ))
        ))`;
        userParams = [userId, userId, userId, userId, userId];
      } else if (isSM) {
        userFilter = ` AND (l.created_by = ? OR EXISTS (
          SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND (la.u_id = ? OR la.assigned_by = ?) AND la.is_active = 1
        ))`;
        userParams = [userId, userId, userId];
      } else {
        userFilter = ` AND (l.created_by = ? OR EXISTS (
          SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.u_id = ? AND la.is_active = 1
        ))`;
        userParams = [userId, userId];
      }
    }

    // Get status breakdown for this project
    const [statuses] = await db.execute(`
      SELECT
        ls.ls_id, ls.name, ls.color,
        COUNT(DISTINCT l.l_id) as count
      FROM lead_statuses ls
      LEFT JOIN leads l ON l.ls_id = ls.ls_id AND l.is_archived = 0
        AND l.l_id IN (
          SELECT lr2.l_id FROM lead_requirements lr2
          WHERE lr2.is_active = 1
            AND JSON_CONTAINS(lr2.project_ids, ?)
        )${userFilter}
      WHERE ls.is_active = 1
      GROUP BY ls.ls_id, ls.name, ls.color
      HAVING count > 0
      ORDER BY count DESC
    `, [projectId, ...userParams]);

    // Get leads for this project (optionally filtered by status)
    let leadsQuery = `
      SELECT l.*,
        ls.name as status_name, ls.color as status_color,
        lp.name as priority_name, lp.color as priority_color,
        src.name as source_name, src.icon as source_icon,
        (SELECT COUNT(*) FROM lead_assignments la WHERE la.l_id = l.l_id AND la.is_active = 1) as assigned_count,
        (SELECT GROUP_CONCAT(u.username SEPARATOR ', ')
         FROM lead_assignments la
         JOIN users u ON la.u_id = u.u_id
         WHERE la.l_id = l.l_id AND la.is_active = 1) as assigned_users,
        (SELECT GROUP_CONCAT(lac.comment ORDER BY lac.create_dt DESC SEPARATOR '||')
         FROM lead_activities lac
         WHERE lac.l_id = l.l_id AND lac.activity_type = 'comment' AND lac.comment IS NOT NULL
        ) as all_comments,
        (SELECT lf.followup_dt FROM lead_followups lf
         WHERE lf.l_id = l.l_id AND lf.is_active = 1
         ORDER BY lf.followup_dt ASC LIMIT 1) as next_followup_dt,
        (SELECT GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ')
         FROM lead_requirements lr
         JOIN projects p ON JSON_CONTAINS(lr.project_ids, CAST(p.project_id AS CHAR))
         WHERE lr.l_id = l.l_id AND lr.is_active = 1) as project_names
      FROM leads l
      LEFT JOIN lead_statuses ls ON l.ls_id = ls.ls_id
      LEFT JOIN lead_priorities lp ON l.lp_id = lp.lp_id
      LEFT JOIN lead_sources src ON l.src_id = src.src_id
      WHERE l.is_archived = 0
        AND l.l_id IN (
          SELECT lr2.l_id FROM lead_requirements lr2
          WHERE lr2.is_active = 1
            AND JSON_CONTAINS(lr2.project_ids, ?)
        )${userFilter}
    `;
    const params = [projectId, ...userParams];

    if (ls_id) {
      leadsQuery += ' AND l.ls_id = ?';
      params.push(ls_id);
    }

    leadsQuery += ' ORDER BY l.create_dt DESC LIMIT 100';

    const [leads] = await db.execute(leadsQuery, params);

    res.json({ success: true, data: { statuses: statuses || [], leads: leads || [] } });
  } catch (error) {
    console.error('Project leads error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch project leads' });
  }
};

// ─── SOURCE LEADS ────────────────────────────────────────────
exports.getSourceLeads = async (req, res) => {
  try {
    const db = req.db;
    const userId = req.user.userId;
    const roleSlug = req.user.roleSlug;
    const source = req.params.source;
    const isAdmin = roleSlug === 'master' || roleSlug === 'admin';
    const isSM = roleSlug === 'sales_manager';
    const isTL = roleSlug === 'team_leader';

    // Role-based lead filter
    let assignFilter = '';
    let assignParams = [];
    if (!isAdmin) {
      if (isTL) {
        assignFilter = ` AND (l.created_by = ? OR EXISTS (
          SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.is_active = 1
          AND (la.u_id = ? OR la.assigned_by = ? OR la.u_id IN (
            SELECT u.u_id FROM users u WHERE u.team_leader_id = ? OR u.reports_to = ?
          ))
        ))`;
        assignParams = [userId, userId, userId, userId, userId];
      } else if (isSM) {
        assignFilter = ` AND (l.created_by = ? OR EXISTS (
          SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND (la.u_id = ? OR la.assigned_by = ?) AND la.is_active = 1
        ))`;
        assignParams = [userId, userId, userId];
      } else {
        assignFilter = ` AND (l.created_by = ? OR EXISTS (
          SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.u_id = ? AND la.is_active = 1
        ))`;
        assignParams = [userId, userId];
      }
    }

    const [leads] = await db.execute(`
      SELECT
        l.l_id, l.name, l.mobile, l.email, l.source_type, l.create_dt,
        ls.name as status_name, ls.color as status_color
      FROM leads l
      LEFT JOIN lead_statuses ls ON l.ls_id = ls.ls_id
      LEFT JOIN lead_sources src ON l.src_id = src.src_id
      WHERE l.is_archived = 0
        AND (src.name = ? OR l.source_type = ?)${assignFilter}
      ORDER BY l.create_dt DESC
      LIMIT 100
    `, [source, source, ...assignParams]);

    res.json({ success: true, data: { leads: leads || [] } });
  } catch (error) {
    console.error('Source leads error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch source leads' });
  }
};
