const express = require('express');
const router = express.Router();
const {authenticate} = require('../middleware/auth');
const {uploadPhoto, handleUploadError} = require('../middleware/upload');
const response = require('../utils/response');

router.use(authenticate);

// Self-heal: ensure support_tickets table exists (with image_path)
let tableEnsured = false;
const ensureTable = async (db) => {
  if (tableEnsured) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        st_id INT AUTO_INCREMENT PRIMARY KEY,
        u_id INT NOT NULL,
        category VARCHAR(50) NOT NULL,
        subject VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        image_path VARCHAR(500) DEFAULT NULL,
        status ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (u_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Add image_path column if table already existed without it
    try {
      await db.query(`ALTER TABLE support_tickets ADD COLUMN image_path VARCHAR(500) DEFAULT NULL`);
    } catch (_) { /* column already exists */ }
    tableEnsured = true;
  } catch (e) {
    console.log('ensure support_tickets error:', e.message);
  }
};

// POST /api/support-tickets — create ticket (optional image attachment)
router.post('/', uploadPhoto.single('image'), handleUploadError, async (req, res) => {
  try {
    await ensureTable(req.db);
    const {category, subject, description} = req.body;
    const userId = req.user.userId;

    if (!subject || !subject.trim()) return response.error(res, 'Subject is required');
    if (!description || !description.trim()) return response.error(res, 'Description is required');

    const imagePath = req.file ? `/uploads/photos/${req.file.filename}` : null;

    const [result] = await req.db.query(
      `INSERT INTO support_tickets (u_id, category, subject, description, image_path, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [userId, category || 'other', subject.trim(), description.trim(), imagePath]
    );

    return response.success(res, 'Ticket created successfully', {st_id: result.insertId, image_path: imagePath}, 201);
  } catch (err) {
    console.error('Create support ticket error:', err);
    return response.serverError(res, err);
  }
});

// GET /api/support-tickets — list current user's tickets
router.get('/', async (req, res) => {
  try {
    await ensureTable(req.db);
    const userId = req.user.userId;
    const [rows] = await req.db.query(
      `SELECT * FROM support_tickets WHERE u_id = ? ORDER BY created_at DESC LIMIT 100`,
      [userId]
    );
    return response.success(res, 'Tickets fetched', {tickets: rows});
  } catch (err) {
    console.error('List support tickets error:', err);
    return response.serverError(res, err);
  }
});

module.exports = router;
