/**
 * Lead Schedule Cron
 * Runs every 5 minutes — picks up unassigned leads and assigns them
 * based on active lead_schedules rules (round robin / manual).
 */

const cron = require('node-cron');
const { getPool } = require('../config/database');

let isRunning = false;

const runScheduler = async () => {
  if (isRunning) return; // prevent overlap
  isRunning = true;

  try {
    // Only process default DB — no extra connections to discover tenants
    // Multi-tenant: each API request already uses the right DB via middleware
    // Cron handles the default/primary tenant only (sufficient for most setups)
    const defaultDb = process.env.DEFAULT_DB || process.env.DB_NAME;
    if (!defaultDb) { isRunning = false; return; }

    try {
      await processDatabase(defaultDb);
    } catch (e) {
      console.log(`[LEAD-CRON] Error processing ${defaultDb}:`, e.message);
    }
  } catch (err) {
    console.error('[LEAD-CRON] Fatal error:', err);
  } finally {
    isRunning = false;
  }
};

const processDatabase = async (dbName) => {
  let db;
  try {
    db = getPool(dbName);
  } catch (e) {
    return; // DB not available
  }

  // Check if lead_schedules table exists
  try {
    await db.query('SELECT 1 FROM lead_schedules LIMIT 1');
  } catch (e) {
    return; // table doesn't exist yet
  }

  // Get active schedules
  const [schedules] = await db.query(
    `SELECT * FROM lead_schedules WHERE status = 'active' ORDER BY ls_id ASC`
  );
  if (schedules.length === 0) return;

  // Get unassigned leads (no active assignment)
  const [unassignedLeads] = await db.query(
    `SELECT l.l_id, l.create_dt, l.src_id, l.city, l.source_type
     FROM leads l
     WHERE l.is_archived = 0
       AND NOT EXISTS (
         SELECT 1 FROM lead_assignments la
         WHERE la.l_id = l.l_id AND la.is_active = 1
       )
     ORDER BY l.create_dt ASC
     LIMIT 100`
  );

  if (unassignedLeads.length === 0) return;

  let totalAssigned = 0;

  for (const lead of unassignedLeads) {
    const leadDate = lead.create_dt
      ? new Date(lead.create_dt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    for (const schedule of schedules) {
      // Check date range
      if (schedule.date_from && leadDate < new Date(schedule.date_from).toISOString().split('T')[0]) continue;
      if (schedule.date_to && leadDate > new Date(schedule.date_to).toISOString().split('T')[0]) continue;

      // Check source filter
      let sourceIds = [];
      try { sourceIds = typeof schedule.source_ids === 'string' ? JSON.parse(schedule.source_ids) : (schedule.source_ids || []); } catch (e) {}
      if (sourceIds.length > 0 && lead.src_id && !sourceIds.includes(Number(lead.src_id))) continue;

      // Check city filter
      let cities = [];
      try { cities = typeof schedule.cities === 'string' ? JSON.parse(schedule.cities) : (schedule.cities || []); } catch (e) {}
      if (cities.length > 0 && lead.city) {
        if (!cities.some(c => c.toLowerCase() === lead.city.toLowerCase())) continue;
      }

      // Check project filter (via lead_requirements)
      let projIds = [];
      try { projIds = typeof schedule.project_ids === 'string' ? JSON.parse(schedule.project_ids) : (schedule.project_ids || []); } catch (e) {}
      if (projIds.length > 0) {
        const [reqs] = await db.query(
          `SELECT project_ids FROM lead_requirements WHERE l_id = ? AND is_active = 1 LIMIT 1`,
          [lead.l_id]
        );
        if (reqs.length > 0 && reqs[0].project_ids) {
          let leadProjIds = [];
          try { leadProjIds = typeof reqs[0].project_ids === 'string' ? JSON.parse(reqs[0].project_ids) : reqs[0].project_ids; } catch (e) {}
          const hasMatch = projIds.some(pid => leadProjIds.includes(pid));
          if (!hasMatch) continue;
        } else {
          continue; // lead has no project, schedule requires one
        }
      }

      // Check service type filter (via lead_requirements)
      let stIds = [];
      try { stIds = typeof schedule.service_type_ids === 'string' ? JSON.parse(schedule.service_type_ids) : (schedule.service_type_ids || []); } catch (e) {}
      if (stIds.length > 0) {
        const [reqs] = await db.query(
          `SELECT st_ids FROM lead_requirements WHERE l_id = ? AND is_active = 1 LIMIT 1`,
          [lead.l_id]
        );
        if (reqs.length > 0 && reqs[0].st_ids) {
          let leadStIds = [];
          try { leadStIds = typeof reqs[0].st_ids === 'string' ? JSON.parse(reqs[0].st_ids) : reqs[0].st_ids; } catch (e) {}
          const hasMatch = stIds.some(sid => leadStIds.includes(sid));
          if (!hasMatch) continue;
        } else {
          continue;
        }
      }

      // Schedule matches — determine user
      let userIds = [];
      try { userIds = typeof schedule.user_ids === 'string' ? JSON.parse(schedule.user_ids) : (schedule.user_ids || []); } catch (e) {}
      if (userIds.length === 0) continue;

      let assignToUserId;
      if (schedule.schedule_type === 'manual') {
        assignToUserId = userIds[0];
      } else {
        // Round Robin
        const nextIndex = (schedule.last_assigned_index + 1) % userIds.length;
        assignToUserId = userIds[nextIndex];
        await db.query('UPDATE lead_schedules SET last_assigned_index = ? WHERE ls_id = ?', [nextIndex, schedule.ls_id]);
      }

      // Assign
      await db.query(
        `INSERT INTO lead_assignments (l_id, u_id, assigned_by, is_active) VALUES (?, ?, 0, 1)`,
        [lead.l_id, assignToUserId]
      );

      // Activity log
      const [assignedUser] = await db.query('SELECT username FROM users WHERE u_id = ?', [assignToUserId]);
      const name = assignedUser[0]?.username || `User #${assignToUserId}`;
      await db.query(
        `INSERT INTO lead_activities (l_id, u_id, activity_type, comment, source) VALUES (?, ?, 'system', ?, 'system')`,
        [lead.l_id, assignToUserId, `Auto-assigned to ${name} via ${schedule.schedule_type} schedule (cron)`]
      );

      totalAssigned++;
      break; // assigned — move to next lead
    }
  }

  if (totalAssigned > 0) {
    console.log(`[LEAD-CRON] ${dbName}: Assigned ${totalAssigned} leads`);
  }
};

const startLeadScheduleCron = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    runScheduler();
  });

  // Also run once on startup (after 10 sec delay so DB is ready)
  setTimeout(() => runScheduler(), 10000);

  console.log('[LEAD-CRON] Lead scheduling cron started (every 5 min)');
};

module.exports = { startLeadScheduleCron, runScheduler };
