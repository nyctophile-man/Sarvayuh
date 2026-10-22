const { Pool } = require('pg'), fs = require('fs'), path = require('path');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = (text, params) => pool.query(text, params).then((r) => r.rows);          // all rows
const tx = async (fn) => {                                                          // transaction
  const c = await pool.connect();
  try { await c.query('begin'); const r = await fn(c); await c.query('commit'); return r; }
  catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
};
const migrate = () => pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
module.exports = { pool, q, tx, migrate };
