import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pool } from "../../../infrastructure/database/pg";

const DIR = path.join(__dirname, "..", "knowledge");

function chunk(md: string, max = 700): string[] {
  const out: string[] = [];
  let cur = "";
  for (const para of md.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    if (cur && cur.length + para.length > max) { out.push(cur); cur = ""; }
    cur = cur ? cur + "\n\n" + para : para;
  }
  if (cur) out.push(cur);
  return out;
}

(async () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(DIR, file), "utf8");
    const md = raw.replace(/<!--[\s\S]*?-->/g, "").trim();
    const hash = crypto.createHash("sha256").update(md).digest("hex");
    const title = md.match(/^#\s+(.+)$/m)?.[1] ?? file.replace(/\.md$/, "");

    const existing = await pool.query("SELECT id, content_hash FROM kb_documents WHERE source = $1", [file]);
    if (existing.rows[0]?.content_hash === hash) { console.log(`unchanged  ${file}`); continue; }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const doc = await client.query(
        `INSERT INTO kb_documents (source, title, content_hash) VALUES ($1,$2,$3)
         ON CONFLICT (source) DO UPDATE SET title = EXCLUDED.title, content_hash = EXCLUDED.content_hash, updated_at = now()
         RETURNING id`, [file, title, hash]);
      const id = doc.rows[0].id as number;
      await client.query("DELETE FROM kb_chunks WHERE doc_id = $1", [id]);
      const parts = chunk(md);
      for (let i = 0; i < parts.length; i++) {
        await client.query("INSERT INTO kb_chunks (doc_id, idx, text) VALUES ($1,$2,$3)", [id, i, parts[i]]);
      }
      await client.query("COMMIT");
      console.log(`ingested   ${file} (${parts.length} chunks)`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  // remove documents whose files were deleted
  await pool.query("DELETE FROM kb_documents WHERE NOT (source = ANY($1::text[]))", [files]);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
