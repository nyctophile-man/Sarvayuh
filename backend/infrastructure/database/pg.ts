/**
 * Shares the SAME PostgreSQL connection pool as infrastructure/postgresql/db.js,
 * so the whole backend runs on one pool.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("../postgresql/db");

export const pool: import("pg").Pool = db.pool ?? db.default ?? db;
