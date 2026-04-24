// ============================================================================
// NOTIFICATION CONTROLLER
// ============================================================================

const Notification = require('../models/Notification');
const response = require('../utils/response');

/**
 * GET /api/notifications
 * Returns all notifications + unread count for the logged-in user
 */
const getAll = async (req, res) => {
  try {
    const userId = req.user.userId;
    const [notifications, unreadCount] = await Promise.all([
      Notification.getAll(req.db, userId),
      Notification.getUnreadCount(req.db, userId),
    ]);

    // Parse JSON data field
    const parsed = notifications.map(n => ({
      ...n,
      data: n.data ? (typeof n.data === 'string' ? JSON.parse(n.data) : n.data) : null,
    }));

    return response.success(res, 'Notifications fetched', {
      notifications: parsed,
      unreadCount,
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    return response.serverError(res, err);
  }
};

/**
 * GET /api/notifications/unread-count
 * Returns just the unread count (for badge)
 */
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.db, req.user.userId);
    return response.success(res, 'Unread count', { unreadCount: count });
  } catch (err) {
    console.error('Unread count error:', err);
    return response.serverError(res, err);
  }
};

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read
 */
const markRead = async (req, res) => {
  try {
    const nId = req.params.id;
    await Notification.markRead(req.db, nId, req.user.userId);
    return response.success(res, 'Marked as read');
  } catch (err) {
    console.error('Mark read error:', err);
    return response.serverError(res, err);
  }
};

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
const markAllRead = async (req, res) => {
  try {
    await Notification.markAllRead(req.db, req.user.userId);
    return response.success(res, 'All marked as read');
  } catch (err) {
    console.error('Mark all read error:', err);
    return response.serverError(res, err);
  }
};

/**
 * DELETE /api/notifications/:id
 * Delete a single notification
 */
const remove = async (req, res) => {
  try {
    await Notification.remove(req.db, req.params.id, req.user.userId);
    return response.success(res, 'Notification deleted');
  } catch (err) {
    console.error('Delete notification error:', err);
    return response.serverError(res, err);
  }
};

/**
 * DELETE /api/notifications
 * Delete all notifications
 */
const removeAll = async (req, res) => {
  try {
    await Notification.removeAll(req.db, req.user.userId);
    return response.success(res, 'All notifications cleared');
  } catch (err) {
    console.error('Clear all notifications error:', err);
    return response.serverError(res, err);
  }
};

module.exports = {
  getAll,
  getUnreadCount,
  markRead,
  markAllRead,
  remove,
  removeAll,
};
