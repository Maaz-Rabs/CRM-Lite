/**
 * Location Model
 * Handles user_locations table operations for live tracking
 */

class Location {
  constructor(db) {
    this.db = db;
  }

  /**
   * Insert a new location record
   */
  async trackLocation(userId, data) {
    try {
      const [result] = await this.db.query(
        `INSERT INTO user_locations (u_id, latitude, longitude, accuracy, address, battery_level, tracked_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [userId, data.latitude, data.longitude, data.accuracy || null, data.address || null, data.battery_level ?? null]
      );
      return result.insertId;
    } catch (err) {
      // Fallback: battery_level column might not exist on older DB
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        const [result] = await this.db.query(
          `INSERT INTO user_locations (u_id, latitude, longitude, accuracy, address, tracked_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [userId, data.latitude, data.longitude, data.accuracy || null, data.address || null]
        );
        return result.insertId;
      }
      throw err;
    }
  }

  /**
   * Get latest location for each team member (within last 24 hours)
   */
  async getTeamLocations(userIds) {
    if (!userIds || userIds.length === 0) return [];

    const placeholders = userIds.map(() => '?').join(',');

    try {
      const [rows] = await this.db.query(
        `SELECT ul.ul_id, ul.u_id, ul.latitude, ul.longitude, ul.accuracy, ul.address, ul.battery_level, ul.tracked_at
         FROM user_locations ul
         INNER JOIN (
           SELECT u_id, MAX(ul_id) as max_id
           FROM user_locations
           WHERE u_id IN (${placeholders})
             AND tracked_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
           GROUP BY u_id
         ) latest ON ul.ul_id = latest.max_id`,
        userIds
      );
      return rows;
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        const [rows] = await this.db.query(
          `SELECT ul.ul_id, ul.u_id, ul.latitude, ul.longitude, ul.accuracy, ul.address, NULL as battery_level, ul.tracked_at
           FROM user_locations ul
           INNER JOIN (
             SELECT u_id, MAX(ul_id) as max_id
             FROM user_locations
             WHERE u_id IN (${placeholders})
               AND tracked_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
             GROUP BY u_id
           ) latest ON ul.ul_id = latest.max_id`,
          userIds
        );
        return rows;
      }
      throw err;
    }
  }
}

module.exports = Location;
