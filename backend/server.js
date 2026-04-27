const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const leadRoutes = require('./routes/leads');
const attendanceRoutes = require('./routes/attendance');
const leadStatusRoutes = require('./routes/leadStatus');
const brokerRoutes = require('./routes/brokerRoutes');
const dashboardRoutes = require('./routes/dashboard');
const locationRoutes = require('./routes/location');
const leadPriorityRoutes = require('./routes/leadPriority');
const attendancePolicyRoutes = require('./routes/attendancePolicy');
const notificationRoutes = require('./routes/notification');
const reportRoutes = require('./routes/report');
const reminderSettingsRoutes = require('./routes/reminderSettings');
const loanRoutes = require('./routes/loans');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // In production, specify allowed origins
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-client-db']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Force-download endpoint: ?path=/uploads/... &name=filename.ext
// Sets Content-Disposition: attachment so the browser/OS triggers native download
app.get('/download', (req, res) => {
  try {
    const rawPath = String(req.query.path || '');
    const suggestedName = String(req.query.name || 'download');
    if (!rawPath) return res.status(400).send('Missing path');

    // Normalize and security check: must stay inside uploads/
    const normalized = rawPath.replace(/^\/+/, '');
    if (!normalized.startsWith('uploads/')) return res.status(400).send('Invalid path');
    const absPath = path.resolve(path.join(__dirname, normalized));
    const uploadsRoot = path.resolve(path.join(__dirname, 'uploads'));
    if (!absPath.startsWith(uploadsRoot)) return res.status(400).send('Invalid path');

    return res.download(absPath, suggestedName);
  } catch (err) {
    console.error('Download error:', err);
    return res.status(500).send('Download failed');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'RABS Connect CRM API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/lead-statuses', leadStatusRoutes);
app.use('/api/brokers', brokerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/lead-priorities', leadPriorityRoutes);
app.use('/api/attendance-policies', attendancePolicyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reminder-settings', reminderSettingsRoutes);
app.use('/api/followups', require('./routes/followups'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/share', require('./routes/share'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/candidate-options', require('./routes/candidateOptions'));
app.use('/api/loans', loanRoutes);
app.use('/api/support-tickets', require('./routes/supportTickets'));
app.use('/api/lead-scheduling', require('./routes/leadScheduling'));
app.use('/api/ticket-webhook', require('./routes/ticketWebhook'));
app.use('/api/dynamic-fields', require('./routes/dynamicFields'));
app.use('/api/payslips', require('./routes/payslips'));
app.use('/api/lead-integration', require('./routes/leadIntegration'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Schedulers
const { startFollowupScheduler } = require('./services/followupScheduler');
const { startAttendanceScheduler } = require('./services/attendanceScheduler');
const { startLeadScheduleCron } = require('./services/leadScheduleCron');

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 API URL: http://localhost:${PORT}/api`);

  // Start cron jobs
  startFollowupScheduler();
  startAttendanceScheduler();
  startLeadScheduleCron();
});

module.exports = app;
