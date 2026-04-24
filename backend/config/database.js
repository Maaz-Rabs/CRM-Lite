// ============================================================================
// DATABASE CONFIG - Multi-Database Architecture
// Each client has their own database (rabsconnect_clientname)
// We maintain a pool per database, cached for reuse
// ============================================================================

const mysql = require('mysql2/promise');

// Pool cache: { 'rabsconnect_aarohan': pool, 'rabsconnect_client2': pool }
const poolCache = {};

/**
 * Get or create a connection pool for a specific client database
 * @param {string} dbName - Database name e.g. 'rabsconnect_aarohan'
 * @returns {mysql2.Pool}
 */
const getPool = (dbName) => {
  if (!dbName) {
    throw new Error('Database name is required');
  }

  if (!poolCache[dbName]) {
    poolCache[dbName] = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: dbName,
      port: parseInt(process.env.DB_PORT || '3306'),
      waitForConnections: true,
      connectionLimit: parseInt(process.env.DB_POOL_LIMIT || '10'),
      queueLimit: 50,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      idleTimeout: 60000, // close idle connections after 1 min
      // Timezone for proper datetime handling (IST)
      timezone: '+05:30',
      // Return dates as strings (not JS Date objects)
      dateStrings: true,
    });

    console.log(`[DB] Pool created for: ${dbName}`);
  }

  return poolCache[dbName];
};

/**
 * Get a connection from the default database pool
 * Used when no specific client database is needed
 */
const getDefaultPool = () => {
  const dbName = process.env.DB_NAME || 'rabsconnect_aarohan';
  return getPool(dbName);
};

/**
 * Execute a query on a specific database
 * @param {string} dbName - Database name
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>}
 */
const query = async (dbName, sql, params = []) => {
  const pool = getPool(dbName);
  const [rows] = await pool.execute(sql, params);
  return rows;
};

/**
 * Execute a query on the default database
 */
const queryDefault = async (sql, params = []) => {
  const pool = getDefaultPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
};

/**
 * Test database connection
 */
const testConnection = async (dbName) => {
  try {
    const pool = getPool(dbName);
    const connection = await pool.getConnection();
    console.log(`[DB] Connected to: ${dbName}`);
    connection.release();
    return true;
  } catch (err) {
    console.error(`[DB] Connection failed for ${dbName}:`, err.message);
    return false;
  }
};

/**
 * Close all pools (for graceful shutdown)
 */
const closeAllPools = async () => {
  for (const [dbName, pool] of Object.entries(poolCache)) {
    try {
      await pool.end();
      console.log(`[DB] Pool closed: ${dbName}`);
    } catch (err) {
      console.error(`[DB] Error closing pool ${dbName}:`, err.message);
    }
  }
};

module.exports = {
  getPool,
  getDefaultPool,
  query,
  queryDefault,
  testConnection,
  closeAllPools,
};
