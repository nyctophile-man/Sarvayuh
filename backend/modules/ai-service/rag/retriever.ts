import { pool } from "../../../infrastructure/database/pg";

export interface Retrieved { title: string; source: string; text: string; rank: number }

const MIN_RANK = Number(process.env.RAG_MIN_RANK ?? 0.02);

/**
 * Keyword retrieval with PostgreSQL full-text search (OR of the question's words, ranked).
 * No embedding service needed. To go semantic later, add pgvector and embed chunks at ingest time.
 */
export async function retrieve(question: string, k = 4): Promise<Retrieved[]> {
  const words = Array.from(new Set(question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])).slice(0, 12);
  if (!words.length) return [];
  const { rows } = await pool.query(
    `SELECT d.title, d.source, c.text, ts_rank(c.tsv, q) AS rank
     FROM kb_chunks c JOIN kb_documents d ON d.id = c.doc_id, to_tsquery('english', $1) q
     WHERE c.tsv @@ q
     ORDER BY rank DESC LIMIT $2`,
    [words.join(" | "), k],
  );
  return rows
    .map((r) => ({ title: r.title as string, source: r.source as string, text: r.text as string, rank: Number(r.rank) }))
    .filter((r) => r.rank >= MIN_RANK);
}
