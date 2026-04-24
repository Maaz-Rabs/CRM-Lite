const db = require('../config/db');

class Loan {
  static async create(data) {
    const {
      lead_id,
      applicant_name,
      applicant_phone,
      applicant_email,
      loan_amount,
      loan_type,
      tenure_months,
      interest_rate,
      status,
      lender_name,
      loan_reference,
      approval_date,
      start_date,
      emi_amount,
      documents,
      notes,
      created_by,
      client_code,
    } = data;

    const query = `
      INSERT INTO loans (
        lead_id, applicant_name, applicant_phone, applicant_email,
        loan_amount, loan_type, tenure_months, interest_rate,
        status, lender_name, loan_reference, approval_date, start_date,
        emi_amount, documents, notes, created_by, client_code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const values = [
      lead_id || null,
      applicant_name,
      applicant_phone,
      applicant_email,
      loan_amount,
      loan_type,
      tenure_months,
      interest_rate,
      status || 'Pending',
      lender_name,
      loan_reference,
      approval_date || null,
      start_date || null,
      emi_amount || null,
      JSON.stringify(documents || []),
      notes || null,
      created_by,
      client_code,
    ];

    try {
      const result = await db.execute(query, values);
      return {
        success: true,
        data: { loan_id: result.insertId, ...data },
      };
    } catch (err) {
      console.error('Loan creation error:', err);
      return { success: false, message: err.message };
    }
  }

  static async getAll(filters = {}, clientCode) {
    let query = 'SELECT * FROM loans WHERE client_code = ?';
    const values = [clientCode];

    if (filters.status) {
      query += ' AND status = ?';
      values.push(filters.status);
    }

    if (filters.search) {
      query += ' AND (applicant_name LIKE ? OR applicant_phone LIKE ? OR loan_reference LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      values.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.loan_type) {
      query += ' AND loan_type = ?';
      values.push(filters.loan_type);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.page && filters.limit) {
      const offset = (filters.page - 1) * filters.limit;
      query += ` LIMIT ${filters.limit} OFFSET ${offset}`;
    }

    try {
      const loans = await db.execute(query, values);
      // Parse documents JSON
      const parsedLoans = loans.map(l => ({
        ...l,
        documents: l.documents ? JSON.parse(l.documents) : [],
      }));
      return { success: true, data: parsedLoans };
    } catch (err) {
      console.error('Get loans error:', err);
      return { success: false, message: err.message, data: [] };
    }
  }

  static async getById(loanId, clientCode) {
    const query = 'SELECT * FROM loans WHERE loan_id = ? AND client_code = ?';

    try {
      const results = await db.execute(query, [loanId, clientCode]);
      if (!results.length) {
        return { success: false, message: 'Loan not found' };
      }

      const loan = results[0];
      loan.documents = loan.documents ? JSON.parse(loan.documents) : [];
      return { success: true, data: loan };
    } catch (err) {
      console.error('Get loan by ID error:', err);
      return { success: false, message: err.message };
    }
  }

  static async update(loanId, data, clientCode) {
    const {
      applicant_name,
      applicant_phone,
      applicant_email,
      loan_amount,
      loan_type,
      tenure_months,
      interest_rate,
      status,
      lender_name,
      loan_reference,
      approval_date,
      start_date,
      emi_amount,
      documents,
      notes,
    } = data;

    const query = `
      UPDATE loans SET
        applicant_name = ?,
        applicant_phone = ?,
        applicant_email = ?,
        loan_amount = ?,
        loan_type = ?,
        tenure_months = ?,
        interest_rate = ?,
        status = ?,
        lender_name = ?,
        loan_reference = ?,
        approval_date = ?,
        start_date = ?,
        emi_amount = ?,
        documents = ?,
        notes = ?,
        updated_at = NOW()
      WHERE loan_id = ? AND client_code = ?
    `;

    const values = [
      applicant_name,
      applicant_phone,
      applicant_email,
      loan_amount,
      loan_type,
      tenure_months,
      interest_rate,
      status,
      lender_name,
      loan_reference,
      approval_date,
      start_date,
      emi_amount,
      JSON.stringify(documents || []),
      notes,
      loanId,
      clientCode,
    ];

    try {
      await db.execute(query, values);
      return { success: true, message: 'Loan updated successfully' };
    } catch (err) {
      console.error('Loan update error:', err);
      return { success: false, message: err.message };
    }
  }

  static async delete(loanId, clientCode) {
    const query = 'DELETE FROM loans WHERE loan_id = ? AND client_code = ?';

    try {
      await db.execute(query, [loanId, clientCode]);
      return { success: true, message: 'Loan deleted successfully' };
    } catch (err) {
      console.error('Loan delete error:', err);
      return { success: false, message: err.message };
    }
  }

  static async getStats(clientCode) {
    try {
      const totalQuery = 'SELECT COUNT(*) as total FROM loans WHERE client_code = ?';
      const statusQuery = 'SELECT status, COUNT(*) as count FROM loans WHERE client_code = ? GROUP BY status';
      const typeQuery = 'SELECT loan_type, COUNT(*) as count FROM loans WHERE client_code = ? GROUP BY loan_type';
      const amountQuery = 'SELECT SUM(loan_amount) as total_amount FROM loans WHERE client_code = ?';

      const [totalResult, statusResult, typeResult, amountResult] = await Promise.all([
        db.execute(totalQuery, [clientCode]),
        db.execute(statusQuery, [clientCode]),
        db.execute(typeQuery, [clientCode]),
        db.execute(amountQuery, [clientCode]),
      ]);

      return {
        success: true,
        data: {
          total: totalResult[0]?.total || 0,
          by_status: statusResult,
          by_type: typeResult,
          total_amount: amountResult[0]?.total_amount || 0,
        },
      };
    } catch (err) {
      console.error('Get loan stats error:', err);
      return { success: false, message: err.message };
    }
  }
}

module.exports = Loan;
