/**
 * Attendance Controller
 * Supports multiple punch in/out sessions per day
 */

const Attendance = require('../models/Attendance');
const response = require('../utils/response');
const path = require('path');
const fs = require('fs');

/**
 * Get today's attendance status
 * GET /api/attendance/today
 */
const getTodayStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const attendance = new Attendance(req.db);

    const sessions = await attendance.getTodaySessions(userId);
    const activeSession = await attendance.getActiveSession(userId);

    // Calculate total hours worked today across all sessions (including active)
    let todayTotalHours = 0;
    sessions.forEach(s => {
      if (s.total_hours) {
        todayTotalHours += parseFloat(s.total_hours);
      } else if (s.punch_in_time && !s.punch_out_time) {
        // Active session — calculate elapsed time
        const elapsed = (new Date() - new Date(s.punch_in_time)) / (1000 * 60 * 60);
        todayTotalHours += elapsed;
      }
    });

    // Format sessions for frontend
    const formattedSessions = sessions.map(s => ({
      att_id: s.att_id,
      session_no: s.session_no,
      punch_in_time: s.punch_in_time,
      punch_out_time: s.punch_out_time,
      punch_in_image: s.punch_in_image,
      punch_out_image: s.punch_out_image,
      punch_in_address: s.punch_in_address,
      punch_out_address: s.punch_out_address,
      punch_in_lat: s.punch_in_lat,
      punch_in_lng: s.punch_in_lng,
      punch_out_lat: s.punch_out_lat,
      punch_out_lng: s.punch_out_lng,
      total_hours: s.total_hours,
      is_late: !!s.is_late,
      status: s.status,
    }));

    return response.success(res, 'Today attendance status', {
      sessions: formattedSessions,
      activeSession: activeSession ? {
        att_id: activeSession.att_id,
        session_no: activeSession.session_no,
        punch_in_time: activeSession.punch_in_time,
        punch_in_address: activeSession.punch_in_address,
        punch_in_lat: activeSession.punch_in_lat,
        punch_in_lng: activeSession.punch_in_lng,
        punch_in_image: activeSession.punch_in_image,
      } : null,
      isPunchedIn: !!activeSession,
      totalSessions: sessions.length,
      todayTotalHours: parseFloat(todayTotalHours.toFixed(2)),
    });
  } catch (err) {
    console.error('Get today status error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Punch In
 * POST /api/attendance/punch-in
 */
const punchIn = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { lat, lng, address, image } = req.body;

    let imagePath = null;

    if (image && image.startsWith('data:image')) {
      imagePath = await saveBase64Image(userId, image, 'punch_in');
    } else if (image) {
      imagePath = image;
    }

    const attendance = new Attendance(req.db);
    await attendance.punchIn(userId, {
      lat,
      lng,
      address,
      image: imagePath,
    });

    // Return fresh status
    const sessions = await attendance.getTodaySessions(userId);
    const activeSession = await attendance.getActiveSession(userId);

    return response.success(res, 'Punched in successfully', {
      sessions,
      activeSession,
      isPunchedIn: !!activeSession,
      totalSessions: sessions.length,
    });
  } catch (err) {
    console.error('Punch in error:', err);
    if (err.message === 'Please punch out from current session first') {
      return response.error(res, err.message, 400);
    }
    return response.serverError(res, err);
  }
};

/**
 * Punch Out
 * POST /api/attendance/punch-out
 */
const punchOut = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { lat, lng, address, image } = req.body;

    let imagePath = null;

    if (image && image.startsWith('data:image')) {
      imagePath = await saveBase64Image(userId, image, 'punch_out');
    } else if (image) {
      imagePath = image;
    }

    const attendance = new Attendance(req.db);
    await attendance.punchOut(userId, {
      lat,
      lng,
      address,
      image: imagePath,
    });

    // Return fresh status
    const sessions = await attendance.getTodaySessions(userId);
    const activeSession = await attendance.getActiveSession(userId);

    let todayTotalHours = 0;
    sessions.forEach(s => {
      if (s.total_hours) todayTotalHours += parseFloat(s.total_hours);
    });

    return response.success(res, 'Punched out successfully', {
      sessions,
      activeSession,
      isPunchedIn: !!activeSession,
      totalSessions: sessions.length,
      todayTotalHours: parseFloat(todayTotalHours.toFixed(2)),
    });
  } catch (err) {
    console.error('Punch out error:', err);
    if (err.message === 'Please punch in first') {
      return response.error(res, err.message, 400);
    }
    return response.serverError(res, err);
  }
};

/**
 * Get attendance history
 * GET /api/attendance/history
 */
const getHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;

    const attendance = new Attendance(req.db);
    const history = await attendance.getHistory(userId, startDate, endDate);

    // Group sessions by date
    const grouped = {};
    history.forEach(record => {
      const dateKey = new Date(record.att_date).toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: formatDate(record.att_date),
          day: getDayName(record.att_date),
          dateKey,
          sessions: [],
          totalHours: 0,
          status: record.status,
        };
      }
      grouped[dateKey].sessions.push({
        session_no: record.session_no,
        punchIn: record.punch_in_time ? formatTime(record.punch_in_time) : '--:--',
        punchOut: record.punch_out_time ? formatTime(record.punch_out_time) : '--:--',
        hours: record.total_hours || 0,
        punchInAddress: record.punch_in_address,
        punchOutAddress: record.punch_out_address,
        // snake_case mirrors the rest of the API (first_punch_in, total_hours, etc.)
        is_late: !!record.is_late,
      });
      if (record.total_hours) grouped[dateKey].totalHours += parseFloat(record.total_hours);
      // Use best status (present > halfday)
      if (record.status === 'present') grouped[dateKey].status = 'present';
    });

    const formattedHistory = Object.values(grouped).map(day => ({
      id: day.dateKey,
      date: day.date,
      day: day.day,
      sessions: day.sessions,
      totalSessions: day.sessions.length,
      hours: day.totalHours > 0
        ? `${Math.floor(day.totalHours)}h ${Math.round((day.totalHours % 1) * 60)}m`
        : '--',
      status: day.status,
    }));

    return response.success(res, 'Attendance history', {
      history: formattedHistory,
    });
  } catch (err) {
    console.error('Get history error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Get monthly stats
 * GET /api/attendance/stats
 */
const getStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;

    const attendance = new Attendance(req.db);
    const stats = await attendance.getStats(userId, startDate, endDate);
    const weekendDays = (startDate && endDate)
      ? await attendance.countWeekendDaysForUser(userId, startDate, endDate)
      : 0;

    return response.success(res, 'Attendance stats', {
      stats: {
        presentDays: parseInt(stats.present_days) || 0,
        absentDays: parseInt(stats.absent_days) || 0,
        halfdayDays: parseInt(stats.halfday_days) || 0,
        leaveDays: parseInt(stats.leave_days) || 0,
        forgotLogoutDays: parseInt(stats.forgot_logout_days) || 0,
        weekendDays,
        totalHours: parseFloat(stats.total_hours) || 0,
        avgHours: parseFloat(stats.avg_hours) || 0,
      },
    });
  } catch (err) {
    console.error('Get stats error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Admin: Daily report for all users
 * GET /api/attendance/admin/daily?date=YYYY-MM-DD
 */
const getAdminDaily = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return response.error(res, 'date query param is required');

    const attendance = new Attendance(req.db);
    const data = await attendance.getAdminDailyRecords(date);

    return response.success(res, 'Admin daily attendance', data);
  } catch (err) {
    console.error('Get admin daily error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Admin: Monthly report for all users
 * GET /api/attendance/admin/monthly?startDate=&endDate=
 */
const getAdminMonthly = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return response.error(res, 'startDate and endDate are required');

    const attendance = new Attendance(req.db);
    const records = await attendance.getAdminMonthlySummary(startDate, endDate);

    return response.success(res, 'Admin monthly attendance', { records });
  } catch (err) {
    console.error('Get admin monthly error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Admin: User detail (drill-down) for a specific user across a range.
 * GET /api/attendance/admin/user-detail?user_id=&startDate=&endDate=
 */
const getAdminUserDetail = async (req, res) => {
  try {
    const { user_id, startDate, endDate } = req.query;
    if (!user_id || !startDate || !endDate) {
      return response.error(res, 'user_id, startDate and endDate are required');
    }

    const attendance = new Attendance(req.db);
    const history = await attendance.getHistory(user_id, startDate, endDate);
    const stats = await attendance.getStats(user_id, startDate, endDate);

    // Re-use the same shape as /history endpoint (day-grouped)
    const grouped = {};
    history.forEach(record => {
      const dateKey = new Date(record.att_date).toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: formatDate(record.att_date),
          day: getDayName(record.att_date),
          dateKey,
          sessions: [],
          totalHours: 0,
          status: record.status,
        };
      }
      grouped[dateKey].sessions.push({
        session_no: record.session_no,
        punchIn: record.punch_in_time ? formatTime(record.punch_in_time) : '--:--',
        punchOut: record.punch_out_time ? formatTime(record.punch_out_time) : '--:--',
        hours: record.total_hours || 0,
        punchInAddress: record.punch_in_address,
        punchOutAddress: record.punch_out_address,
        // snake_case mirrors the rest of the API (first_punch_in, total_hours, etc.)
        is_late: !!record.is_late,
      });
      if (record.total_hours) grouped[dateKey].totalHours += parseFloat(record.total_hours);
      if (record.status === 'present') grouped[dateKey].status = 'present';
    });

    const formattedHistory = Object.values(grouped).map(day => ({
      id: day.dateKey,
      date: day.date,
      day: day.day,
      sessions: day.sessions,
      totalSessions: day.sessions.length,
      hours: day.totalHours > 0
        ? `${Math.floor(day.totalHours)}h ${Math.round((day.totalHours % 1) * 60)}m`
        : '--',
      status: day.status,
    }));

    const weekendDays = await attendance.countWeekendDaysForUser(user_id, startDate, endDate);

    return response.success(res, 'Admin user detail', {
      history: formattedHistory,
      stats: {
        presentDays: parseInt(stats.present_days) || 0,
        absentDays: parseInt(stats.absent_days) || 0,
        halfdayDays: parseInt(stats.halfday_days) || 0,
        leaveDays: parseInt(stats.leave_days) || 0,
        forgotLogoutDays: parseInt(stats.forgot_logout_days) || 0,
        weekendDays,
        totalHours: parseFloat(stats.total_hours) || 0,
        avgHours: parseFloat(stats.avg_hours) || 0,
      },
    });
  } catch (err) {
    console.error('Get admin user detail error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Save base64 image to user folder
 */
async function saveBase64Image(userId, base64Data, type) {
  try {
    const userFolder = path.join(__dirname, '../uploads/attendance', userId.toString());
    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
    }

    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 image format');
    }

    const ext = matches[1];
    const data = matches[2];
    const buffer = Buffer.from(data, 'base64');

    const timestamp = Date.now();
    const filename = `${type}_${timestamp}.${ext}`;
    const filepath = path.join(userFolder, filename);

    fs.writeFileSync(filepath, buffer);

    return `attendance/${userId}/${filename}`;
  } catch (err) {
    console.error('Save image error:', err);
    throw err;
  }
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDayName(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

module.exports = {
  getTodayStatus,
  punchIn,
  punchOut,
  getHistory,
  getStats,
  getAdminDaily,
  getAdminMonthly,
  getAdminUserDetail,
};
