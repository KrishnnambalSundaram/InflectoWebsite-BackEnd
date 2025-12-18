const { Pool } = require('pg');
require('dotenv').config();


const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000, // allow slower remote connections
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
