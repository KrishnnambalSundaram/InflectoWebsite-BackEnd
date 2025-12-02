const { Pool } = require('pg');
require('dotenv').config();

// Determine SSL configuration
// If connecting to a remote server, SSL is often required.
// We use rejectUnauthorized: false to allow self-signed certificates common in dev/intranets.
const sslConfig = process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1'
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: sslConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased timeout for remote connections
});

console.log("Attempting to connect to DB at:", process.env.DB_HOST, "Database:", process.env.DB_NAME);

// Immediate connection test
(async () => {
  let client;
  try {
    client = await pool.connect();
    console.log("✅ DB CONNECTED SUCCESSFULLY");
    const res = await client.query('SELECT NOW()');
    console.log('🕒 Database Time:', res.rows[0].now);
  } catch (err) {
    console.error("❌ DATABASE CONNECTION ERROR:");
    console.error("Message:", err.message);
    console.error("Code:", err.code);
    if (err.code === 'ECONNREFUSED') {
      console.error("Hint: Check if the database server is running and accessible at the specified IP/Port.");
    }
  } finally {
    if (client) client.release();
  }
})();

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
