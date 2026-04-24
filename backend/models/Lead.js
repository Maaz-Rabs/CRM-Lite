/**
 * Lead Model
 * Handles all lead-related database operations
 */

class Lead {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new lead
   */
  async create(leadData, userId) {
    const {
      // Source info
      source_type = 'direct',
      src_id = null,
      broker_id = null,
      ref_name = null,
      ref_country_code = null,
      ref_mobile = null,
      ref_email = null,
      
      // Contact info
      name,
      country_code = '+91',
      mobile,
      email = null,
      alt_country_code = null,
      alt_mobile = null,
      alt_email = null,
      
      // Identity
      identity_type = null,
      identity_number = null,
      
      // Location
      country = null,
      state = null,
      city = null,
      locality = null,
      sub_locality = null,
      
      // Classification
      buyer_type = null,
      investment_type = null,
      category = null,
      
      // Status
      ls_id = null,
      lp_id = null,
      
      // Message
      initial_message = null,
      form_name = null,
      
      // Requirements (will be inserted separately)
      requirements = null,
    } = leadData;

    // Ensure columns exist before transaction
    await this.ensureRequirementColumns();
    await this.ensureLeadColumns();

    const conn = await this.db.getConnection();

    try {
      await conn.beginTransaction();

      // No default status on create — lead stays without status until user opens it
      let statusId = ls_id || null;

      // Insert lead
      const [result] = await conn.query(
        `INSERT INTO leads (
          created_by, source_type, src_id, broker_id,
          ref_name, ref_country_code, ref_mobile, ref_email,
          name, country_code, mobile, email,
          alt_country_code, alt_mobile, alt_email,
          identity_type, identity_number,
          country, state, city, locality, sub_locality,
          buyer_type, investment_type, category,
          ls_id, lp_id,
          initial_message, form_name,
          assign_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unassigned')`,
        [
          userId, source_type, src_id, broker_id,
          ref_name, ref_country_code, ref_mobile, ref_email,
          name, country_code, mobile, email,
          alt_country_code, alt_mobile, alt_email,
          identity_type, identity_number,
          country, state, city, locality, sub_locality,
          buyer_type, investment_type, category,
          statusId, lp_id,
          initial_message, form_name
        ]
      );

      const leadId = result.insertId;

      // Insert requirements if provided
      if (requirements && Object.keys(requirements).length > 0) {
        await this.addRequirement(conn, leadId, requirements);
      }

      // Create activity log
      await conn.query(
        `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source)
         VALUES (?, ?, 'system', 'Lead created', 'mobile')`,
        [leadId, userId]
      );

      await conn.commit();

      // Fetch and return the created lead
      const lead = await this.findById(leadId);
      return lead;

    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Ensure all required columns exist (run once)
   */
  async ensureRequirementColumns() {
    if (Lead._reqColsReady) return;
    try {
      await this.db.query('ALTER TABLE lead_requirements ADD COLUMN st_ids LONGTEXT NULL AFTER st_id');
    } catch(e) {}
    try {
      await this.db.query('ALTER TABLE lead_requirements ADD COLUMN pt_ids LONGTEXT NULL AFTER pt_id');
    } catch(e) {}
    Lead._reqColsReady = true;
  }

  /**
   * Ensure leads table columns exist (run once)
   */
  async ensureLeadColumns() {
    if (Lead._leadColsReady) return;
    try {
      await this.db.query('ALTER TABLE leads ADD COLUMN category VARCHAR(500) NULL AFTER investment_type');
    } catch(e) {}
    Lead._leadColsReady = true;
  }

  /**
   * Add requirement to a lead
   */
  async addRequirement(conn, leadId, req) {
    const {
      st_id = null,
      st_ids = [],
      project_ids = [],
      project_name = null,
      pt_id = null,
      pt_ids = [],
      pc_id = null,
      pc_ids = [],
      preferred_country = null,
      preferred_state = null,
      preferred_city = null,
      preferred_locality = null,
      preferred_sub_locality = null,
      min_area = null,
      max_area = null,
      area_unit = 'sqft',
      min_budget = null,
      max_budget = null,
      budget_currency = 'INR',
      handover_preference = null,
      post_handover_plan = 0,
      other_details = null,
    } = req;

    // Resolve arrays
    const stIdsArr = Array.isArray(st_ids) && st_ids.length > 0 ? st_ids : (st_id ? [st_id] : []);
    const ptIdsArr = Array.isArray(pt_ids) && pt_ids.length > 0 ? pt_ids : (pt_id ? [pt_id] : []);
    const pcIdsArr = Array.isArray(pc_ids) && pc_ids.length > 0 ? pc_ids : (pc_id ? [pc_id] : []);
    const projIdsArr = Array.isArray(project_ids) ? project_ids : [];

    const project_ids_json = projIdsArr.length > 0 ? JSON.stringify(projIdsArr) : null;
    const st_ids_json = stIdsArr.length > 0 ? JSON.stringify(stIdsArr) : null;
    const pt_ids_json = ptIdsArr.length > 0 ? JSON.stringify(ptIdsArr) : null;
    const pc_ids_json = pcIdsArr.length > 0 ? JSON.stringify(pcIdsArr) : null;

    await conn.query(
      `INSERT INTO lead_requirements (
        l_id, st_id, st_ids, project_name, project_ids, pt_id, pt_ids, pc_id, pc_ids,
        preferred_country, preferred_state, preferred_city,
        preferred_locality, preferred_sub_locality,
        min_area, max_area, area_unit,
        min_budget, max_budget, budget_currency,
        handover_preference, post_handover_plan, other_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        leadId,
        stIdsArr.length > 0 ? stIdsArr[0] : st_id,
        st_ids_json,
        project_name,
        project_ids_json,
        ptIdsArr.length > 0 ? ptIdsArr[0] : pt_id,
        pt_ids_json,
        pcIdsArr.length > 0 ? pcIdsArr[0] : pc_id,
        pc_ids_json,
        preferred_country, preferred_state, preferred_city,
        preferred_locality, preferred_sub_locality,
        min_area, max_area, area_unit,
        min_budget, max_budget, budget_currency,
        handover_preference, post_handover_plan, other_details
      ]
    );
  }

  /**
   * Update requirements for a lead
   */
  async updateRequirements(leadId, req) {
    const {
      st_id = null,
      project_ids = [],
      pt_id = null,
      pc_ids = [],
      preferred_country = null,
      preferred_state = null,
      preferred_city = null,
      preferred_locality = null,
      preferred_sub_locality = null,
      min_area = null,
      max_area = null,
      area_unit = 'sqft',
      min_budget = null,
      max_budget = null,
      budget_currency = 'INR',
      handover_preference = null,
      post_handover_plan = 0,
      other_details = null,
    } = req;

    // Support multi-select arrays
    const st_ids = req.st_ids || (st_id ? [st_id] : []);
    const pt_ids = req.pt_ids || (pt_id ? [pt_id] : []);

    // Ensure new columns exist (outside transaction)
    await this.ensureRequirementColumns();

    // Convert arrays to JSON string
    const project_ids_json = Array.isArray(project_ids) ? JSON.stringify(project_ids) : null;
    const pc_ids_json = Array.isArray(pc_ids) ? JSON.stringify(pc_ids) : null;
    const pt_ids_json = Array.isArray(pt_ids) && pt_ids.length > 0 ? JSON.stringify(pt_ids) : null;
    const st_ids_json = Array.isArray(st_ids) && st_ids.length > 0 ? JSON.stringify(st_ids) : null;

    // Check if requirement exists
    const [existing] = await this.db.query(
      'SELECT lr_id FROM lead_requirements WHERE l_id = ? AND is_active = 1 LIMIT 1',
      [leadId]
    );

    if (existing.length > 0) {
      // Update existing requirement
      await this.db.query(
        `UPDATE lead_requirements SET
          st_id = ?, st_ids = ?, project_ids = ?, pt_id = ?, pt_ids = ?, pc_ids = ?,
          preferred_country = ?, preferred_state = ?, preferred_city = ?,
          preferred_locality = ?, preferred_sub_locality = ?,
          min_area = ?, max_area = ?, area_unit = ?,
          min_budget = ?, max_budget = ?, budget_currency = ?,
          handover_preference = ?, post_handover_plan = ?, other_details = ?
        WHERE l_id = ? AND is_active = 1`,
        [
          st_ids.length > 0 ? st_ids[0] : st_id, st_ids_json, project_ids_json, pt_ids.length > 0 ? pt_ids[0] : pt_id, pt_ids_json, pc_ids_json,
          preferred_country, preferred_state, preferred_city,
          preferred_locality, preferred_sub_locality,
          min_area, max_area, area_unit,
          min_budget, max_budget, budget_currency,
          handover_preference, post_handover_plan, other_details,
          leadId
        ]
      );
    } else {
      // Insert new requirement
      await this.db.query(
        `INSERT INTO lead_requirements (
          l_id, st_id, st_ids, project_ids, pt_id, pt_ids, pc_ids,
          preferred_country, preferred_state, preferred_city,
          preferred_locality, preferred_sub_locality,
          min_area, max_area, area_unit,
          min_budget, max_budget, budget_currency,
          handover_preference, post_handover_plan, other_details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          leadId, st_ids.length > 0 ? st_ids[0] : st_id, st_ids_json, project_ids_json, pt_ids.length > 0 ? pt_ids[0] : pt_id, pt_ids_json, pc_ids_json,
          preferred_country, preferred_state, preferred_city,
          preferred_locality, preferred_sub_locality,
          min_area, max_area, area_unit,
          min_budget, max_budget, budget_currency,
          handover_preference, post_handover_plan, other_details
        ]
      );
    }
  }

  /**
   * Find lead by ID
   */
  async findById(id) {
    const [rows] = await this.db.query(
      `SELECT l.*,
        ls.name as status_name, ls.color as status_color,
        lp.name as priority_name, lp.color as priority_color,
        src.name as source_name, src.icon as source_icon,
        u.username as created_by_name,
        b.broker_name, b.company as broker_company, b.mobile_no as broker_mobile
       FROM leads l
       LEFT JOIN lead_statuses ls ON l.ls_id = ls.ls_id
       LEFT JOIN lead_priorities lp ON l.lp_id = lp.lp_id
       LEFT JOIN lead_sources src ON l.src_id = src.src_id
       LEFT JOIN users u ON l.created_by = u.u_id
       LEFT JOIN brokers b ON l.broker_id = b.b_id
       WHERE l.l_id = ?`,
      [id]
    );

    if (rows.length === 0) return null;

    const lead = rows[0];

    // Get requirements
    const [requirements] = await this.db.query(
      `SELECT lr.*, 
        st.name as service_type_name,
        pt.name as property_type_name
       FROM lead_requirements lr
       LEFT JOIN service_types st ON lr.st_id = st.st_id
       LEFT JOIN property_types pt ON lr.pt_id = pt.pt_id
       WHERE lr.l_id = ? AND lr.is_active = 1`,
      [id]
    );

    // Get configuration names and project names for JSON arrays
    for (let req of requirements) {
      // Get configuration names
      if (req.pc_ids) {
        try {
          const pcIds = typeof req.pc_ids === 'string' ? JSON.parse(req.pc_ids) : req.pc_ids;
          if (Array.isArray(pcIds) && pcIds.length > 0) {
            const [configs] = await this.db.query(
              `SELECT name FROM property_configurations WHERE pc_id IN (?) ORDER BY display_order`,
              [pcIds]
            );
            req.configuration_names = configs.map(c => c.name).join(', ');
          }
        } catch (e) {
          req.configuration_names = null;
        }
      }
      
      // Get service type names
      if (req.st_ids) {
        try {
          const stIds = typeof req.st_ids === 'string' ? JSON.parse(req.st_ids) : req.st_ids;
          if (Array.isArray(stIds) && stIds.length > 0) {
            const [sts] = await this.db.query(
              `SELECT name FROM service_types WHERE st_id IN (?) ORDER BY display_order`,
              [stIds]
            );
            req.service_type_names = sts.map(s => s.name).join(', ');
          }
        } catch (e) {
          req.service_type_names = null;
        }
      }

      // Get property type names
      if (req.pt_ids) {
        try {
          const ptIds = typeof req.pt_ids === 'string' ? JSON.parse(req.pt_ids) : req.pt_ids;
          if (Array.isArray(ptIds) && ptIds.length > 0) {
            const [pts] = await this.db.query(
              `SELECT name FROM property_types WHERE pt_id IN (?) ORDER BY display_order`,
              [ptIds]
            );
            req.property_type_names = pts.map(p => p.name).join(', ');
          }
        } catch (e) {
          req.property_type_names = null;
        }
      }

      // Get project names
      if (req.project_ids) {
        try {
          const projectIds = typeof req.project_ids === 'string' ? JSON.parse(req.project_ids) : req.project_ids;
          if (Array.isArray(projectIds) && projectIds.length > 0) {
            const [projects] = await this.db.query(
              `SELECT name FROM projects WHERE project_id IN (?) ORDER BY name`,
              [projectIds]
            );
            req.project_names = projects.map(p => p.name).join(', ');
          }
        } catch (e) {
          req.project_names = null;
        }
      }
    }

    lead.requirements = requirements;

    // Copy resolved names to lead level for easy access
    if (requirements.length > 0) {
      const r = requirements[0];
      if (r.project_names) lead.project_names = r.project_names;
      if (r.service_type_names) lead.service_type_names = r.service_type_names;
      if (r.property_type_names) lead.property_type_names = r.property_type_names;
      if (r.configuration_names) lead.configuration_names = r.configuration_names;
      // Prefer requirement-level other_details if lead-level is empty
      if (!lead.other_details && r.other_details) lead.other_details = r.other_details;
    }

    // Get assignments
    const [assignments] = await this.db.query(
      `SELECT la.*,
        u.username as assigned_to_name,
        ab.username as assigned_by_name
       FROM lead_assignments la
       LEFT JOIN users u ON la.u_id = u.u_id
       LEFT JOIN users ab ON la.assigned_by = ab.u_id
       WHERE la.l_id = ? AND la.is_active = 1`,
      [id]
    );

    lead.assignments = assignments;
    lead.assigned_by_users = [...new Set(assignments.map(a => a.assigned_by_name).filter(Boolean))].join(', ') || null;

    // Get timeline (activities)
    const [activities] = await this.db.query(
      `SELECT la.*, 
        u.username as user_name
       FROM lead_activities la
       LEFT JOIN users u ON la.u_id = u.u_id
       WHERE la.l_id = ?
       ORDER BY la.create_dt DESC
       LIMIT 50`,
      [id]
    );

    lead.timeline = activities;

    // Get followups
    const [followups] = await this.db.query(
      `SELECT lf.*, 
        u.username as created_by_name
       FROM lead_followups lf
       LEFT JOIN users u ON lf.u_id = u.u_id
       WHERE lf.l_id = ? AND lf.is_active = 1
       ORDER BY lf.followup_dt ASC`,
      [id]
    );

    lead.followups = followups;

    // Get next followup
    const [nextFollowup] = await this.db.query(
      `SELECT lf.*, 
        u.username as created_by_name
       FROM lead_followups lf
       LEFT JOIN users u ON lf.u_id = u.u_id
       WHERE lf.l_id = ? AND lf.is_active = 1 AND lf.status = 'pending'
       ORDER BY lf.followup_dt ASC
       LIMIT 1`,
      [id]
    );

    lead.next_followup = nextFollowup.length > 0 ? nextFollowup[0] : null;

    return lead;
  }

  /**
   * Get all leads with filters
   */
  async findAll(filters = {}, userId, userRole, pagination = {}) {
    const {
      status,
      statuses,
      priority,
      priorities,
      source,
      sources,
      service_types,
      projects,
      property_types,
      configurations,
      assigned_to,
      search,
      has_followup,
      followup_from,
      followup_to,
      followup_filter,
      created_from,
      created_to,
      assign_status,
      is_fresh,
      no_status,
      is_imported,
      exclude_imported,
      form_name,
      broker_id,
    } = filters;

    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    let query = `
      SELECT l.*,
        ls.name as status_name, ls.color as status_color,
        lp.name as priority_name, lp.color as priority_color,
        src.name as source_name, src.icon as source_icon,
        uc.username as created_by_name,
        (SELECT COUNT(*) FROM lead_assignments la WHERE la.l_id = l.l_id AND la.is_active = 1) as assigned_count,
        (SELECT GROUP_CONCAT(u.username SEPARATOR ', ')
         FROM lead_assignments la
         JOIN users u ON la.u_id = u.u_id
         WHERE la.l_id = l.l_id AND la.is_active = 1) as assigned_users,
        (SELECT GROUP_CONCAT(DISTINCT u.username SEPARATOR ', ')
         FROM lead_assignments la
         JOIN users u ON la.assigned_by = u.u_id
         WHERE la.l_id = l.l_id AND la.is_active = 1 AND la.assigned_by IS NOT NULL) as assigned_by_users,
        (SELECT GROUP_CONCAT(lac.comment ORDER BY lac.create_dt DESC SEPARATOR '||')
         FROM lead_activities lac
         WHERE lac.l_id = l.l_id AND lac.activity_type = 'comment' AND lac.comment IS NOT NULL
        ) as all_comments,
        (SELECT COUNT(*) FROM lead_activities lac2
         WHERE lac2.l_id = l.l_id AND lac2.activity_type = 'comment') as comment_count,
        (SELECT lf.followup_dt FROM lead_followups lf
         WHERE lf.l_id = l.l_id AND lf.is_active = 1
         ORDER BY lf.followup_dt ASC LIMIT 1) as next_followup_dt
      FROM leads l
      LEFT JOIN lead_statuses ls ON l.ls_id = ls.ls_id
      LEFT JOIN lead_priorities lp ON l.lp_id = lp.lp_id
      LEFT JOIN lead_sources src ON l.src_id = src.src_id
      LEFT JOIN users uc ON l.created_by = uc.u_id
      WHERE l.is_archived = 0
    `;

    const params = [];

    // Role-based visibility — master, admin see all leads
    if (userRole !== 'master' && userRole !== 'admin') {
      if (userRole === 'team_leader') {
        // Team leader sees: own leads + assigned to them + assigned by their SMs/telecallers
        query += ` AND (l.created_by = ? OR EXISTS (
          SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.is_active = 1
          AND (la.u_id = ? OR la.assigned_by = ? OR la.u_id IN (
            SELECT u.u_id FROM users u WHERE u.team_leader_id = ? OR u.reports_to = ?
          ))
        ))`;
        params.push(userId, userId, userId, userId, userId);
      } else if (userRole === 'sales_manager') {
        // Sales manager sees: assigned to them OR they assigned to someone else
        query += ` AND (l.created_by = ? OR EXISTS (
          SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND (la.u_id = ? OR la.assigned_by = ?) AND la.is_active = 1
        ))`;
        params.push(userId, userId, userId);
      } else {
        query += ` AND (l.created_by = ? OR EXISTS (
          SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.u_id = ? AND la.is_active = 1
        ))`;
        params.push(userId, userId);
      }
    }

    // Apply filters — multi-value (comma-separated) takes priority over single value

    // Broker filter
    if (broker_id) {
      query += ' AND l.broker_id = ?';
      params.push(broker_id);
    }

    // No status filter (unknown leads)
    if (no_status) {
      query += ' AND (l.ls_id IS NULL OR l.ls_id = 0)';
    }

    // Imported leads filter — only restrict when explicitly viewing the Imported page
    if (is_imported) {
      query += " AND l.source_type = 'import'";
    } else if (exclude_imported) {
      query += " AND (l.source_type != 'import' OR l.source_type IS NULL)";
    }

    // Status filter
    if (statuses) {
      const ids = statuses.split(',').map(Number).filter(Boolean);
      if (ids.length > 0) {
        query += ` AND l.ls_id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
    } else if (status) {
      query += ' AND l.ls_id = ?';
      params.push(status);
    }

    // Priority filter
    if (priorities) {
      const ids = priorities.split(',').map(Number).filter(Boolean);
      if (ids.length > 0) {
        query += ` AND l.lp_id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
    } else if (priority) {
      query += ' AND l.lp_id = ?';
      params.push(priority);
    }

    // Source filter
    if (sources) {
      const ids = sources.split(',').map(Number).filter(Boolean);
      if (ids.length > 0) {
        query += ` AND l.src_id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
    } else if (source) {
      query += ' AND l.src_id = ?';
      params.push(source);
    }

    // Service type filter (via lead_requirements)
    if (service_types) {
      const ids = service_types.split(',').map(Number).filter(Boolean);
      if (ids.length > 0) {
        query += ` AND EXISTS (SELECT 1 FROM lead_requirements lr WHERE lr.l_id = l.l_id AND lr.is_active = 1 AND lr.st_id IN (${ids.map(() => '?').join(',')}))`;
        params.push(...ids);
      }
    }

    // Property type filter (via lead_requirements)
    if (property_types) {
      const ids = property_types.split(',').map(Number).filter(Boolean);
      if (ids.length > 0) {
        query += ` AND EXISTS (SELECT 1 FROM lead_requirements lr WHERE lr.l_id = l.l_id AND lr.is_active = 1 AND lr.pt_id IN (${ids.map(() => '?').join(',')}))`;
        params.push(...ids);
      }
    }

    // Project filter (via lead_requirements JSON project_ids)
    if (projects) {
      const ids = projects.split(',').map(Number).filter(Boolean);
      if (ids.length > 0) {
        const projectConditions = ids.map(() => 'JSON_CONTAINS(lr.project_ids, ?)').join(' OR ');
        query += ` AND EXISTS (SELECT 1 FROM lead_requirements lr WHERE lr.l_id = l.l_id AND lr.is_active = 1 AND (${projectConditions}))`;
        params.push(...ids.map(id => JSON.stringify(id)));
      }
    }

    // Configuration filter (via lead_requirements JSON pc_ids)
    if (configurations) {
      const ids = configurations.split(',').map(Number).filter(Boolean);
      if (ids.length > 0) {
        const configConditions = ids.map(() => 'JSON_CONTAINS(lr.pc_ids, ?)').join(' OR ');
        query += ` AND EXISTS (SELECT 1 FROM lead_requirements lr WHERE lr.l_id = l.l_id AND lr.is_active = 1 AND (${configConditions}))`;
        params.push(...ids.map(id => JSON.stringify(id)));
      }
    }

    // Assigned to filter (via lead_assignments)
    if (assigned_to) {
      const ids = assigned_to.split(',').map(Number).filter(Boolean);
      if (ids.length > 0) {
        query += ` AND EXISTS (SELECT 1 FROM lead_assignments la2 WHERE la2.l_id = l.l_id AND la2.is_active = 1 AND la2.u_id IN (${ids.map(() => '?').join(',')}))`;
        params.push(...ids);
      }
    }

    if (search) {
      query += ' AND (l.name LIKE ? OR l.mobile LIKE ? OR l.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (has_followup !== undefined) {
      query += ' AND l.has_followup = ?';
      params.push(has_followup ? 1 : 0);
    }

    if (followup_from) {
      query += ' AND l.followup_dt >= ?';
      params.push(followup_from);
    }

    if (followup_to) {
      query += ' AND l.followup_dt <= ?';
      params.push(followup_to);
    }

    // Follow-up filter: today, missed, upcoming — uses lead_followups table for accuracy
    if (followup_filter) {
      if (followup_filter === 'today') {
        query += ` AND EXISTS (
          SELECT 1 FROM lead_followups lf
          WHERE lf.l_id = l.l_id AND lf.is_active = 1
          AND DATE(lf.followup_dt) = CURDATE()
        )`;
      } else if (followup_filter === 'missed') {
        query += ` AND EXISTS (
          SELECT 1 FROM lead_followups lf
          WHERE lf.l_id = l.l_id AND lf.is_active = 1
          AND lf.followup_dt < NOW()
          AND DATE(lf.followup_dt) < CURDATE()
        )`;
      } else if (followup_filter === 'upcoming') {
        query += ` AND EXISTS (
          SELECT 1 FROM lead_followups lf
          WHERE lf.l_id = l.l_id AND lf.is_active = 1
          AND lf.followup_dt > NOW()
          AND DATE(lf.followup_dt) > CURDATE()
        )`;
      }
    }

    if (created_from) {
      query += ' AND l.create_dt >= ?';
      params.push(created_from);
    }

    if (created_to) {
      query += ' AND l.create_dt <= ?';
      params.push(created_to + ' 23:59:59');
    }

    if (assign_status) {
      const isForwarder = userRole === 'sales_manager' || userRole === 'team_leader';
      if (assign_status === 'assigned') {
        if (isForwarder) {
          query += ' AND EXISTS (SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.assigned_by = ? AND la.u_id != ? AND la.is_active = 1)';
          params.push(userId, userId);
        } else {
          query += ' AND EXISTS (SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.is_active = 1)';
        }
      } else if (assign_status === 'non_assigned') {
        if (isForwarder) {
          query += ' AND NOT EXISTS (SELECT 1 FROM lead_assignments la2 WHERE la2.l_id = l.l_id AND la2.assigned_by = ? AND la2.u_id != ? AND la2.is_active = 1)';
          params.push(userId, userId);
        } else {
          query += ' AND NOT EXISTS (SELECT 1 FROM lead_assignments la WHERE la.l_id = l.l_id AND la.is_active = 1)';
        }
      }
    }

    if (form_name) {
      const names = form_name.split(',').map(n => n.trim()).filter(Boolean);
      if (names.length > 0) {
        query += ` AND l.form_name IN (${names.map(() => '?').join(',')})`;
        params.push(...names);
      }
    }

    if (is_fresh !== undefined) {
      if (is_fresh) {
        query += ' AND (l.is_viewed = 0 OR l.is_viewed IS NULL)';
      } else {
        query += ' AND l.is_viewed = 1';
      }
    }

    // Count total — extract WHERE clause and use simple count query
    const whereStart = query.indexOf('WHERE l.is_archived = 0');
    const whereClause = query.substring(whereStart);
    const countQuery = `SELECT COUNT(*) as total FROM leads l
      LEFT JOIN lead_statuses ls ON l.ls_id = ls.ls_id
      LEFT JOIN lead_priorities lp ON l.lp_id = lp.lp_id
      LEFT JOIN lead_sources src ON l.src_id = src.src_id
      ${whereClause}`;
    const [countResult] = await this.db.query(countQuery, params);
    const total = countResult[0].total;

    // Add ordering and pagination
    query += ' ORDER BY l.create_dt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await this.db.query(query, params);

    // Get project names for each lead
    for (let lead of rows) {
      const [requirements] = await this.db.query(
        `SELECT lr.project_ids, lr.pc_ids FROM lead_requirements lr WHERE lr.l_id = ? AND lr.is_active = 1 LIMIT 1`,
        [lead.l_id]
      );
      
      if (requirements.length > 0) {
        const req = requirements[0];
        
        // Get project names
        if (req.project_ids) {
          try {
            const projectIds = typeof req.project_ids === 'string' ? JSON.parse(req.project_ids) : req.project_ids;
            if (Array.isArray(projectIds) && projectIds.length > 0) {
              const [projects] = await this.db.query(
                `SELECT name FROM projects WHERE project_id IN (?) ORDER BY name`,
                [projectIds]
              );
              lead.project_names = projects.map(p => p.name).join(', ');
            }
          } catch (e) {
            lead.project_names = null;
          }
        }
      }
    }

    return {
      leads: rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update lead
   */
  async update(id, leadData, userId) {
    const allowedFields = [
      'name', 'country_code', 'mobile', 'email',
      'alt_country_code', 'alt_mobile', 'alt_email',
      'source_type', 'src_id', 'broker_id',
      'ref_name', 'ref_country_code', 'ref_mobile', 'ref_email',
      'identity_type', 'identity_number',
      'country', 'state', 'city', 'locality', 'sub_locality',
      'buyer_type', 'investment_type', 'category',
      'ls_id', 'lp_id',
      'initial_message', 'form_name',
      'is_locked', 'is_archived',
      'other_details'
    ];

    const updates = [];
    const params = [];

    for (const field of allowedFields) {
      if (leadData[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(leadData[field]);
      }
    }

    if (updates.length === 0) {
      return await this.findById(id);
    }

    params.push(id);

    await this.db.query(
      `UPDATE leads SET ${updates.join(', ')} WHERE l_id = ?`,
      params
    );

    // Log activity
    await this.db.query(
      `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source)
       VALUES (?, ?, 'system', 'Lead updated', 'mobile')`,
      [id, userId]
    );

    return await this.findById(id);
  }

  /**
   * Get lead sources
   */
  async getSources() {
    const [rows] = await this.db.query(
      'SELECT * FROM lead_sources WHERE is_active = 1 ORDER BY display_order'
    );
    return rows;
  }

  /**
   * Get lead priorities
   */
  async getPriorities() {
    const [rows] = await this.db.query(
      'SELECT * FROM lead_priorities WHERE is_active = 1 ORDER BY display_order'
    );
    return rows;
  }

  /**
   * Get service types
   */
  async getServiceTypes() {
    const [rows] = await this.db.query(
      'SELECT * FROM service_types WHERE is_active = 1 ORDER BY display_order'
    );
    return rows;
  }

  /**
   * Get property types
   */
  async getPropertyTypes() {
    const [rows] = await this.db.query(
      'SELECT * FROM property_types WHERE is_active = 1 ORDER BY display_order'
    );
    return rows;
  }

  /**
   * Get property configurations
   */
  async getPropertyConfigurations() {
    const [rows] = await this.db.query(
      'SELECT * FROM property_configurations WHERE is_active = 1 ORDER BY display_order'
    );
    return rows;
  }

  /**
   * Get all master data for dropdowns
   */
  async getMasterData() {
    const [sources, priorities, statuses, serviceTypes, propertyTypes, configurations, projects, brokers, formNames] = await Promise.all([
      this.getSources(),
      this.getPriorities(),
      this.db.query('SELECT * FROM lead_statuses WHERE is_active = 1 ORDER BY display_order').then(r => r[0]),
      this.getServiceTypes(),
      this.getPropertyTypes(),
      this.getPropertyConfigurations(),
      this.getProjects(),
      this.db.query('SELECT b_id, broker_name, company FROM brokers WHERE status = 1 ORDER BY broker_name').then(r => r[0]),
      this.db.query('SELECT DISTINCT form_name FROM leads WHERE form_name IS NOT NULL AND form_name != \'\' ORDER BY form_name').then(r => r[0].map(row => row.form_name)),
    ]);

    return {
      sources,
      priorities,
      statuses,
      service_types: serviceTypes,
      property_types: propertyTypes,
      configurations,
      projects,
      brokers,
      form_names: formNames,
    };
  }

  /**
   * Get projects
   */
  async getProjects() {
    try {
      const [rows] = await this.db.query(
        'SELECT * FROM projects WHERE is_active = 1 ORDER BY name'
      );
      return rows;
    } catch (err) {
      // Table might not exist
      return [];
    }
  }
}

module.exports = Lead;
