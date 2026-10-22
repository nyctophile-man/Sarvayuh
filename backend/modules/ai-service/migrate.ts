import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../../infrastructure/database/pg";

(async () => {
  await pool.query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  console.log("ai-service migration done");
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
