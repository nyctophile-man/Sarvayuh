import express, { type Request, type Response, type Router } from "express";
import { rateLimit } from "express-rate-limit";
import { SarvayuhChatbot } from "../../Ai/sarvayuh-chatbot";
import { AnthropicRagAdapter } from "./llm/anthropic-adapter";
import { healthData } from "./health-data";
import {
  deleteAllForUser,
  deleteConversation,
  getMessages,
  isSessionUsable,
  listConversations,
  PgSessionStore,
  saveTurn,
} from "./store";

// The gateway middleware is still CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { auth, audit, wrap } = require("../../api-gateway/middleware");

type AuthenticatedRequest = Request & { user: { id: string } };

const bot = new SarvayuhChatbot({
  healthData,
  llm: process.env.ANTHROPIC_API_KEY ? new AnthropicRagAdapter() : undefined,
  sessionStore: new PgSessionStore(),
  emergencyNumber: process.env.EMERGENCY_NUMBER || "112",
  crisisLine: process.env.CRISIS_LINE || "Tele-MANAS 14416 (India)",
  onEvent: (event) => {
    console.log("[chat]", event.type, event.sessionId);
  },
});

const aiRouter: Router = express.Router();
const aiLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function boundedInteger(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return fallback;
  return Math.max(1, Math.min(Number(value), max));
}

aiRouter.get("/chat/init", auth("patient"), wrap(async (_req: Request, res: Response) => {
  res.json(bot.getInit());
}));

aiRouter.post("/chat", aiLimit, auth("patient"), wrap(async (req: Request, res: Response) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) return res.status(400).json({ error: "message required" });

  const userId = (req as AuthenticatedRequest).user.id;
  const requestedSessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : undefined;
  const sessionId = requestedSessionId && uuidPattern.test(requestedSessionId) ? requestedSessionId : undefined;
  if (sessionId && !(await isSessionUsable(sessionId, userId))) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const output = await bot.handle({ sessionId, userId, message });
  await saveTurn(output.sessionId, userId, message, output.messages);
  if (output.flags.emergency) audit(userId, "chat.emergency", output.sessionId);
  return res.json(output);
}));

aiRouter.get("/conversations", auth("patient"), wrap(async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user.id;
  const limit = boundedInteger(req.query.limit, 20, 50);
  res.json(await listConversations(userId, limit));
}));

aiRouter.get("/conversations/:id/messages", auth("patient"), wrap(async (req: Request, res: Response) => {
  const sessionId = req.params.id;
  if (!uuidPattern.test(sessionId)) return res.status(400).json({ error: "Invalid conversation id" });

  const before = req.query.before;
  if (before !== undefined && (typeof before !== "string" || !/^\d+$/.test(before))) {
    return res.status(400).json({ error: "Invalid before id" });
  }

  const userId = (req as AuthenticatedRequest).user.id;
  const limit = boundedInteger(req.query.limit, 50, 100);
  res.json(await getMessages(sessionId, userId, limit, typeof before === "string" ? before : null));
}));

aiRouter.delete("/conversations/:id", auth("patient"), wrap(async (req: Request, res: Response) => {
  const sessionId = req.params.id;
  if (!uuidPattern.test(sessionId)) return res.status(400).json({ error: "Invalid conversation id" });

  const userId = (req as AuthenticatedRequest).user.id;
  const deleted = await deleteConversation(sessionId, userId);
  if (!deleted) return res.status(404).json({ error: "Conversation not found" });
  return res.json({ deleted: true });
}));

aiRouter.delete("/history", auth("patient"), wrap(async (req: Request, res: Response) => {
  await deleteAllForUser((req as AuthenticatedRequest).user.id);
  res.json({ deleted: true });
}));

module.exports = { aiRouter };
