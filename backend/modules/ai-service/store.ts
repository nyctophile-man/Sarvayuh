import { pool } from "../../infrastructure/database/pg";
import type { BotMessage, SessionState, SessionStore } from "../../Ai/sarvayuh-chatbot";

const TTL_MS = 30 * 60 * 1000;

/** PostgreSQL SessionStore for SarvayuhChatbot: survives restarts, works with many instances. */
export class PgSessionStore implements SessionStore {
  async get(id: string): Promise<SessionState | undefined> {
    const { rows } = await pool.query("SELECT state FROM chat_sessions WHERE id = $1", [id]);
    const s = rows[0]?.state as SessionState | undefined;
    if (!s) return undefined;
    if (Date.now() - s.touchedAt > TTL_MS) {
      await pool.query("DELETE FROM chat_sessions WHERE id = $1", [id]);
      return undefined;
    }
    return s;
  }
  async set(id: string, state: SessionState): Promise<void> {
    await pool.query(
      `INSERT INTO chat_sessions (id, state, touched_at) VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, touched_at = now()`,
      [id, JSON.stringify(state)],
    );
  }
}

/** A client-sent sessionId is reused only if no other user owns it. */
export async function isSessionUsable(sessionId: string, userId: string): Promise<boolean> {
  const r = await pool.query(
    "SELECT 1 FROM chat_messages WHERE session_id = $1 AND user_id <> $2 LIMIT 1", [sessionId, userId]);
  return r.rowCount === 0;
}

export async function saveTurn(sessionId: string, userId: string, userText: string, bot: BotMessage[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO chat_messages (session_id, user_id, role, text) VALUES ($1,$2,'user',$3)",
      [sessionId, userId, userText]);
    for (const m of bot) {
      await client.query(
        "INSERT INTO chat_messages (session_id, user_id, role, text, style) VALUES ($1,$2,'bot',$3,$4)",
        [sessionId, userId, m.text, m.style]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listConversations(userId: string, limit = 20) {
  const { rows } = await pool.query(
    `SELECT session_id AS id, min(created_at) AS "startedAt", max(created_at) AS "lastAt",
            (array_agg(text ORDER BY id DESC))[1] AS "lastText", count(*)::int AS count
     FROM chat_messages WHERE user_id = $1
     GROUP BY session_id ORDER BY max(created_at) DESC LIMIT $2`, [userId, limit]);
  return rows;
}

export async function getMessages(sessionId: string, userId: string, limit = 50, before: string | null = null) {
  const { rows } = await pool.query(
    `SELECT id, role, text, style, created_at AS "createdAt" FROM chat_messages
     WHERE session_id = $1 AND user_id = $2 AND ($3::bigint IS NULL OR id < $3::bigint)
     ORDER BY id DESC LIMIT $4`, [sessionId, userId, before, limit]);
  return rows.reverse();
}

export async function deleteConversation(sessionId: string, userId: string): Promise<number> {
  const r = await pool.query("DELETE FROM chat_messages WHERE session_id = $1 AND user_id = $2", [sessionId, userId]);
  if (r.rowCount) await pool.query("DELETE FROM chat_sessions WHERE id = $1", [sessionId]);
  return r.rowCount ?? 0;
}

export async function deleteAllForUser(userId: string): Promise<void> {
  const ids = await pool.query("SELECT DISTINCT session_id FROM chat_messages WHERE user_id = $1", [userId]);
  await pool.query("DELETE FROM chat_messages WHERE user_id = $1", [userId]);
  if (ids.rowCount) {
    await pool.query("DELETE FROM chat_sessions WHERE id = ANY($1::uuid[])", [ids.rows.map((r) => r.session_id)]);
  }
}

export async function purgeOld(retentionDays: number): Promise<void> {
  await pool.query("DELETE FROM chat_messages WHERE created_at < now() - ($1 || ' days')::interval", [String(retentionDays)]);
  await pool.query("DELETE FROM chat_sessions WHERE touched_at < now() - interval '1 day'");
}
