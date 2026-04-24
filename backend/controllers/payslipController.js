/**
 * Payslip Controller
 * Admin/Master can CRUD payslips for any user.
 * Regular users can only view their own.
 */

const response = require('../utils/response');

let _tableEnsured = false;

async function ensureTable(db) {
  if (_tableEnsured) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS payslips (
      ps_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      u_id INT UNSIGNED NOT NULL,
      period CHAR(7) NOT NULL COMMENT 'YYYY-MM',
      working_days TINYINT UNSIGNED DEFAULT 0,
      present_days TINYINT UNSIGNED DEFAULT 0,
      basic DECIMAL(12, 2) NOT NULL DEFAULT 0,
      hra DECIMAL(12, 2) NOT NULL DEFAULT 0,
      allowances DECIMAL(12, 2) NOT NULL DEFAULT 0,
      bonus DECIMAL(12, 2) NOT NULL DEFAULT 0,
      deductions DECIMAL(12, 2) NOT NULL DEFAULT 0,
      tax DECIMAL(12, 2) NOT NULL DEFAULT 0,
      net_pay DECIMAL(12, 2) NOT NULL DEFAULT 0,
      notes TEXT DEFAULT NULL,
      status ENUM('draft', 'paid') NOT NULL DEFAULT 'draft',
      paid_on DATE DEFAULT NULL,
      created_by INT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_period (u_id, period),
      INDEX idx_user (u_id),
      INDEX idx_period (period)
    )
  `);
  _tableEnsured = true;
}

const isAdminRole = (role) => role === 'master' || role === 'admin';

const computeNet = (d) => {
  const n = (v) => Number(v || 0);
  return Math.max(0, n(d.basic) + n(d.hra) + n(d.allowances) + n(d.bonus) - n(d.deductions) - n(d.tax));
};

// GET /api/payslips  — admin: all; user: own
exports.list = async (req, res) => {
  try {
    await ensureTable(req.db);
    const { period, u_id } = req.query;
    const where = [];
    const params = [];

    if (!isAdminRole(req.user.roleSlug)) {
      where.push('p.u_id = ?');
      params.push(req.user.userId);
    } else if (u_id) {
      where.push('p.u_id = ?');
      params.push(u_id);
    }

    if (period) {
      where.push('p.period = ?');
      params.push(period);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await req.db.query(
      `SELECT p.*, u.username,
              CONCAT(COALESCE(up.first_name, u.username), ' ', COALESCE(up.last_name, '')) AS name,
              r.name AS role_name
       FROM payslips p
       LEFT JOIN users u ON p.u_id = u.u_id
       LEFT JOIN user_profiles up ON u.u_id = up.u_id
       LEFT JOIN roles r ON u.r_id = r.r_id
       ${whereSql}
       ORDER BY p.period DESC, p.created_at DESC`,
      params
    );

    return response.success(res, 'Payslips fetched', rows);
  } catch (err) {
    console.error('Payslip list error:', err);
    return response.serverError(res, err);
  }
};

// GET /api/payslips/:id
exports.getOne = async (req, res) => {
  try {
    await ensureTable(req.db);
    const [rows] = await req.db.query(
      `SELECT p.*, u.username,
              CONCAT(COALESCE(up.first_name, u.username), ' ', COALESCE(up.last_name, '')) AS name,
              u.email, r.name AS role_name
       FROM payslips p
       LEFT JOIN users u ON p.u_id = u.u_id
       LEFT JOIN user_profiles up ON u.u_id = up.u_id
       LEFT JOIN roles r ON u.r_id = r.r_id
       WHERE p.ps_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return response.error(res, 'Payslip not found', 404);

    const ps = rows[0];
    if (!isAdminRole(req.user.roleSlug) && ps.u_id !== req.user.userId) {
      return response.error(res, 'Forbidden', 403);
    }
    return response.success(res, 'Payslip fetched', ps);
  } catch (err) {
    console.error('Payslip get error:', err);
    return response.serverError(res, err);
  }
};

// POST /api/payslips — admin only
exports.create = async (req, res) => {
  try {
    await ensureTable(req.db);
    const {
      u_id, period,
      working_days = 0, present_days = 0,
      basic = 0, hra = 0, allowances = 0, bonus = 0,
      deductions = 0, tax = 0,
      notes = null, status = 'draft', paid_on = null,
    } = req.body;

    if (!u_id || !period) return response.error(res, 'u_id and period are required');
    if (!/^\d{4}-\d{2}$/.test(period)) return response.error(res, 'period must be YYYY-MM');

    const net_pay = computeNet({ basic, hra, allowances, bonus, deductions, tax });

    try {
      const [result] = await req.db.query(
        `INSERT INTO payslips
         (u_id, period, working_days, present_days, basic, hra, allowances, bonus,
          deductions, tax, net_pay, notes, status, paid_on, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          u_id, period, working_days, present_days,
          basic, hra, allowances, bonus, deductions, tax, net_pay,
          notes, status, paid_on, req.user.userId,
        ]
      );
      return response.success(res, 'Payslip created', { ps_id: result.insertId, net_pay }, 201);
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return response.error(res, 'A payslip already exists for this user and period', 409);
      }
      throw err;
    }
  } catch (err) {
    console.error('Payslip create error:', err);
    return response.serverError(res, err);
  }
};

// PUT /api/payslips/:id — admin only
exports.update = async (req, res) => {
  try {
    await ensureTable(req.db);
    const [existing] = await req.db.query('SELECT * FROM payslips WHERE ps_id = ?', [req.params.id]);
    if (existing.length === 0) return response.error(res, 'Payslip not found', 404);

    const merged = { ...existing[0], ...req.body };
    const net_pay = computeNet(merged);

    await req.db.query(
      `UPDATE payslips SET
        u_id = ?, period = ?, working_days = ?, present_days = ?,
        basic = ?, hra = ?, allowances = ?, bonus = ?,
        deductions = ?, tax = ?, net_pay = ?,
        notes = ?, status = ?, paid_on = ?
       WHERE ps_id = ?`,
      [
        merged.u_id, merged.period, merged.working_days, merged.present_days,
        merged.basic, merged.hra, merged.allowances, merged.bonus,
        merged.deductions, merged.tax, net_pay,
        merged.notes, merged.status, merged.paid_on || null,
        req.params.id,
      ]
    );

    return response.success(res, 'Payslip updated', { net_pay });
  } catch (err) {
    console.error('Payslip update error:', err);
    return response.serverError(res, err);
  }
};

// DELETE /api/payslips/:id — admin only
exports.remove = async (req, res) => {
  try {
    await ensureTable(req.db);
    const [result] = await req.db.query('DELETE FROM payslips WHERE ps_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return response.error(res, 'Payslip not found', 404);
    return response.success(res, 'Payslip deleted');
  } catch (err) {
    console.error('Payslip delete error:', err);
    return response.serverError(res, err);
  }
};
