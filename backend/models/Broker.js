class Broker {
  constructor(db) {
    this.db = db;
  }

  // Get all brokers with pagination and filters
  async getAll(options = {}) {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      specialization = '',
      location = '',
      created_from = '',
      created_to = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    let whereConditions = ['deleted_at IS NULL'];
    let params = [];

    if (search) {
      whereConditions.push(`(
        broker_name LIKE ? OR
        broker_email LIKE ? OR
        mobile_no LIKE ? OR
        company LIKE ? OR
        rera_no LIKE ?
      )`);
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    if (specialization) {
      whereConditions.push('specialization = ?');
      params.push(specialization);
    }

    if (location) {
      whereConditions.push('(location LIKE ? OR address LIKE ?)');
      params.push(`%${location}%`, `%${location}%`);
    }

    if (created_from) {
      whereConditions.push('DATE(created_at) >= ?');
      params.push(created_from);
    }

    if (created_to) {
      whereConditions.push('DATE(created_at) <= ?');
      params.push(created_to);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const allowedSortColumns = ['created_at', 'broker_name', 'company', 'status', 'updated_at'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countQuery = `SELECT COUNT(*) as total FROM brokers ${whereClause}`;
    const [countResult] = await this.db.query(countQuery, params);
    const total = countResult[0].total;

    const dataQuery = `
      SELECT
        b_id, broker_name, broker_email, country_code, mobile_no,
        company, rera_no, location, address, remark,
        document_path, document_name, status, commission_percentage,
        specialization, profile_photo, license_expiry_date, languages,
        experience_years, created_at, updated_at
      FROM brokers
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), parseInt(offset));
    const [rows] = await this.db.query(dataQuery, params);

    return {
      data: rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  // Get single broker by ID
  async getById(id) {
    const query = `
      SELECT b.*
      FROM brokers b
      WHERE b.b_id = ? AND b.deleted_at IS NULL
    `;
    const [rows] = await this.db.execute(query, [id]);
    if (!rows[0]) return null;

    // Fetch documents separately (compatible with older MySQL versions)
    const docQuery = `SELECT bd_id, document_type, document_name, document_path, uploaded_at FROM broker_documents WHERE b_id = ?`;
    const [docs] = await this.db.execute(docQuery, [id]);
    rows[0].documents = docs.length > 0 ? docs : null;

    return rows[0];
  }

  // Check if broker exists by RERA or mobile
  async checkExists(reraNo, countryCode, mobileNo, excludeId = null) {
    let query = `
      SELECT b_id, rera_no, mobile_no
      FROM brokers
      WHERE deleted_at IS NULL AND (rera_no = ? OR (country_code = ? AND mobile_no = ?))
    `;
    let params = [reraNo, countryCode, mobileNo];

    if (excludeId) {
      query += ' AND b_id != ?';
      params.push(excludeId);
    }

    const [rows] = await this.db.execute(query, params);
    return rows;
  }

  // Create new broker
  async create(brokerData) {
    const {
      broker_name,
      broker_email,
      country_code = '+971',
      mobile_no,
      company,
      rera_no,
      location,
      address,
      remark,
      document_path,
      document_name,
      status = 'active',
      commission_percentage = 0,
      specialization = 'both',
      profile_photo,
      license_expiry_date,
      languages,
      experience_years = 0,
      created_by
    } = brokerData;

    const query = `
      INSERT INTO brokers (
        broker_name, broker_email, country_code, mobile_no, company,
        rera_no, location, address, remark, document_path, document_name,
        status, commission_percentage, specialization, profile_photo,
        license_expiry_date, languages, experience_years, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      broker_name,
      broker_email || null,
      country_code,
      mobile_no,
      company,
      rera_no,
      location || null,
      address,
      remark || null,
      document_path || null,
      document_name || null,
      status,
      commission_percentage,
      specialization,
      profile_photo || null,
      license_expiry_date || null,
      languages ? JSON.stringify(languages) : null,
      experience_years,
      created_by || null
    ];

    const [result] = await this.db.execute(query, params);
    return { b_id: result.insertId, ...brokerData };
  }

  // Update broker
  async update(id, brokerData) {
    const allowedFields = [
      'broker_name', 'broker_email', 'country_code', 'mobile_no', 'company',
      'rera_no', 'location', 'address', 'remark', 'document_path', 'document_name',
      'status', 'commission_percentage', 'specialization', 'profile_photo',
      'license_expiry_date', 'languages', 'experience_years', 'updated_by'
    ];

    const updates = [];
    const params = [];

    for (const field of allowedFields) {
      if (brokerData[field] !== undefined) {
        updates.push(`${field} = ?`);
        if (field === 'languages' && typeof brokerData[field] === 'object') {
          params.push(JSON.stringify(brokerData[field]));
        } else {
          params.push(brokerData[field]);
        }
      }
    }

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    params.push(id);

    const query = `UPDATE brokers SET ${updates.join(', ')} WHERE b_id = ? AND deleted_at IS NULL`;
    const [result] = await this.db.execute(query, params);

    return result.affectedRows > 0;
  }

  // Soft delete broker
  async delete(id, deletedBy = null) {
    const query = `
      UPDATE brokers
      SET deleted_at = CURRENT_TIMESTAMP, updated_by = ?
      WHERE b_id = ? AND deleted_at IS NULL
    `;
    const [result] = await this.db.execute(query, [deletedBy, id]);
    return result.affectedRows > 0;
  }

  // Hard delete broker (permanent)
  async hardDelete(id) {
    const query = 'DELETE FROM brokers WHERE b_id = ?';
    const [result] = await this.db.execute(query, [id]);
    return result.affectedRows > 0;
  }

  // Update broker status
  async updateStatus(id, status, updatedBy = null) {
    const query = `
      UPDATE brokers
      SET status = ?, updated_by = ?
      WHERE b_id = ? AND deleted_at IS NULL
    `;
    const [result] = await this.db.execute(query, [status, updatedBy, id]);
    return result.affectedRows > 0;
  }

  // Add document to broker
  async addDocument(brokerId, documentData) {
    const { document_type, document_name, document_path } = documentData;
    const query = `
      INSERT INTO broker_documents (b_id, document_type, document_name, document_path)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await this.db.execute(query, [brokerId, document_type, document_name, document_path]);
    return { bd_id: result.insertId, ...documentData };
  }

  // Remove document from broker
  async removeDocument(documentId) {
    const query = 'DELETE FROM broker_documents WHERE bd_id = ?';
    const [result] = await this.db.execute(query, [documentId]);
    return result.affectedRows > 0;
  }

  // Get broker documents
  async getDocuments(brokerId) {
    const query = 'SELECT * FROM broker_documents WHERE b_id = ? ORDER BY uploaded_at DESC';
    const [rows] = await this.db.execute(query, [brokerId]);
    return rows;
  }

  // ---- Broker Notes ----

  // Ensure broker_notes table exists
  async ensureNotesTable() {
    const createTable = `
      CREATE TABLE IF NOT EXISTS broker_notes (
        bn_id INT AUTO_INCREMENT PRIMARY KEY,
        b_id INT NOT NULL,
        note TEXT NOT NULL,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_broker_notes_b_id (b_id)
      )
    `;
    await this.db.execute(createTable);
  }

  // Get notes for a broker
  async getNotes(brokerId) {
    await this.ensureNotesTable();
    const query = `
      SELECT bn.bn_id, bn.note, bn.created_by, bn.created_at,
             u.username as created_by_name
      FROM broker_notes bn
      LEFT JOIN users u ON bn.created_by = u.u_id
      WHERE bn.b_id = ?
      ORDER BY bn.created_at DESC
    `;
    const [rows] = await this.db.execute(query, [brokerId]);
    return rows;
  }

  // Add a note
  async addNote(brokerId, note, createdBy = null) {
    await this.ensureNotesTable();
    const query = `INSERT INTO broker_notes (b_id, note, created_by) VALUES (?, ?, ?)`;
    const [result] = await this.db.execute(query, [brokerId, note, createdBy]);
    return { bn_id: result.insertId, b_id: brokerId, note, created_by: createdBy, created_at: new Date() };
  }

  // Delete a note
  async deleteNote(noteId) {
    await this.ensureNotesTable();
    const query = `DELETE FROM broker_notes WHERE bn_id = ?`;
    const [result] = await this.db.execute(query, [noteId]);
    return result.affectedRows > 0;
  }

  // Get broker statistics
  async getStats() {
    const query = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended,
        SUM(CASE WHEN specialization = 'residential' THEN 1 ELSE 0 END) as residential,
        SUM(CASE WHEN specialization = 'commercial' THEN 1 ELSE 0 END) as commercial,
        SUM(CASE WHEN specialization = 'both' THEN 1 ELSE 0 END) as both_types
      FROM brokers
      WHERE deleted_at IS NULL
    `;
    const [rows] = await this.db.execute(query);
    return rows[0];
  }
}

module.exports = Broker;
