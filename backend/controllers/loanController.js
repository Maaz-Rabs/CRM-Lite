/**
 * Loan Controller
 * Per-tenant DB via req.db (from authenticate middleware).
 * Table is auto-created on first use.
 */

const response = require('../utils/response');

let _tableEnsured = false;

async function ensureTable(db) {
  if (_tableEnsured) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS loans (
      loan_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      lead_id INT UNSIGNED DEFAULT NULL,
      applicant_name VARCHAR(150) NOT NULL,
      applicant_phone VARCHAR(30) NOT NULL,
      applicant_email VARCHAR(150) DEFAULT NULL,
      loan_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
      loan_type VARCHAR(50) NOT NULL DEFAULT 'Home Loan',
      tenure_months SMALLINT UNSIGNED DEFAULT 0,
      interest_rate DECIMAL(5, 2) DEFAULT NULL,
      status ENUM('Pending', 'Approved', 'Rejected', 'Active', 'Closed') NOT NULL DEFAULT 'Pending',
      lender_name VARCHAR(150) DEFAULT NULL,
      loan_reference VARCHAR(100) DEFAULT NULL,
      approval_date DATE DEFAULT NULL,
      start_date DATE DEFAULT NULL,
      emi_amount DECIMAL(12, 2) DEFAULT NULL,
      documents LONGTEXT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_by INT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_type (loan_type),
      INDEX idx_lead (lead_id)
    )
  `);
  _tableEnsured = true;
}

const parseDocs = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
};

// POST /api/loans
exports.createLoan = async (req, res) => {
  try {
    await ensureTable(req.db);

    const {
      lead_id = null,
      applicant_name, applicant_phone, applicant_email = null,
      loan_amount, loan_type,
      tenure_months = 0, interest_rate = null,
      status = 'Pending',
      lender_name = null, loan_reference = null,
      approval_date = null, start_date = null,
      emi_amount = null,
      documents = [], notes = null,
    } = req.body;

    if (!applicant_name || !applicant_phone || loan_amount === undefined || loan_amount === '' || !loan_type) {
      return response.error(res, 'Missing required fields: applicant_name, applicant_phone, loan_amount, loan_type');
    }

    const [result] = await req.db.query(
      `INSERT INTO loans
        (lead_id, applicant_name, applicant_phone, applicant_email,
         loan_amount, loan_type, tenure_months, interest_rate, status,
         lender_name, loan_reference, approval_date, start_date,
         emi_amount, documents, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lead_id || null,
        applicant_name, applicant_phone, applicant_email,
        loan_amount, loan_type,
        tenure_months || 0, interest_rate || null,
        status,
        lender_name, loan_reference,
        approval_date || null, start_date || null,
        emi_amount || null,
        JSON.stringify(documents || []),
        notes,
        req.user?.userId || null,
      ]
    );

    return response.success(res, 'Loan created', { loan_id: result.insertId }, 201);
  } catch (err) {
    console.error('Create loan error:', err);
    return response.serverError(res, err);
  }
};

// GET /api/loans
exports.getAllLoans = async (req, res) => {
  try {
    await ensureTable(req.db);

    const { status, search, loan_type, page = 1, limit = 50 } = req.query;
    const where = [];
    const params = [];

    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (loan_type) {
      where.push('loan_type = ?');
      params.push(loan_type);
    }
    if (search) {
      where.push('(applicant_name LIKE ? OR applicant_phone LIKE ? OR loan_reference LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await req.db.query(
      `SELECT * FROM loans ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const data = rows.map(l => ({ ...l, documents: parseDocs(l.documents) }));
    return response.success(res, 'Loans fetched', data);
  } catch (err) {
    console.error('Get all loans error:', err);
    return response.serverError(res, err);
  }
};

// GET /api/loans/stats
exports.getLoanStats = async (req, res) => {
  try {
    await ensureTable(req.db);

    const [[total]] = await req.db.query('SELECT COUNT(*) as total FROM loans');
    const [byStatus] = await req.db.query('SELECT status, COUNT(*) as count FROM loans GROUP BY status');
    const [byType] = await req.db.query('SELECT loan_type, COUNT(*) as count FROM loans GROUP BY loan_type');
    const [[amt]] = await req.db.query('SELECT COALESCE(SUM(loan_amount), 0) as total_amount FROM loans');

    return response.success(res, 'Stats fetched', {
      total: total.total || 0,
      by_status: byStatus,
      by_type: byType,
      total_amount: Number(amt.total_amount) || 0,
    });
  } catch (err) {
    console.error('Get loan stats error:', err);
    return response.serverError(res, err);
  }
};

// GET /api/loans/:id
exports.getLoanById = async (req, res) => {
  try {
    await ensureTable(req.db);
    const [rows] = await req.db.query('SELECT * FROM loans WHERE loan_id = ?', [req.params.id]);
    if (rows.length === 0) return response.error(res, 'Loan not found', 404);
    const loan = { ...rows[0], documents: parseDocs(rows[0].documents) };
    return response.success(res, 'Loan fetched', loan);
  } catch (err) {
    console.error('Get loan by ID error:', err);
    return response.serverError(res, err);
  }
};

// PUT /api/loans/:id
exports.updateLoan = async (req, res) => {
  try {
    await ensureTable(req.db);

    const [existing] = await req.db.query('SELECT * FROM loans WHERE loan_id = ?', [req.params.id]);
    if (existing.length === 0) return response.error(res, 'Loan not found', 404);

    const cur = existing[0];
    const body = req.body || {};
    const merged = {
      applicant_name: body.applicant_name ?? cur.applicant_name,
      applicant_phone: body.applicant_phone ?? cur.applicant_phone,
      applicant_email: body.applicant_email ?? cur.applicant_email,
      loan_amount: body.loan_amount ?? cur.loan_amount,
      loan_type: body.loan_type ?? cur.loan_type,
      tenure_months: body.tenure_months ?? cur.tenure_months,
      interest_rate: body.interest_rate ?? cur.interest_rate,
      status: body.status ?? cur.status,
      lender_name: body.lender_name ?? cur.lender_name,
      loan_reference: body.loan_reference ?? cur.loan_reference,
      approval_date: body.approval_date ?? cur.approval_date,
      start_date: body.start_date ?? cur.start_date,
      emi_amount: body.emi_amount ?? cur.emi_amount,
      documents: body.documents ?? parseDocs(cur.documents),
      notes: body.notes ?? cur.notes,
    };

    await req.db.query(
      `UPDATE loans SET
        applicant_name = ?, applicant_phone = ?, applicant_email = ?,
        loan_amount = ?, loan_type = ?, tenure_months = ?, interest_rate = ?,
        status = ?, lender_name = ?, loan_reference = ?,
        approval_date = ?, start_date = ?, emi_amount = ?,
        documents = ?, notes = ?
       WHERE loan_id = ?`,
      [
        merged.applicant_name, merged.applicant_phone, merged.applicant_email,
        merged.loan_amount, merged.loan_type, merged.tenure_months || 0, merged.interest_rate,
        merged.status, merged.lender_name, merged.loan_reference,
        merged.approval_date || null, merged.start_date || null, merged.emi_amount,
        JSON.stringify(merged.documents || []), merged.notes,
        req.params.id,
      ]
    );

    return response.success(res, 'Loan updated');
  } catch (err) {
    console.error('Update loan error:', err);
    return response.serverError(res, err);
  }
};

// DELETE /api/loans/:id
exports.deleteLoan = async (req, res) => {
  try {
    await ensureTable(req.db);
    const [result] = await req.db.query('DELETE FROM loans WHERE loan_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return response.error(res, 'Loan not found', 404);
    return response.success(res, 'Loan deleted');
  } catch (err) {
    console.error('Delete loan error:', err);
    return response.serverError(res, err);
  }
};
