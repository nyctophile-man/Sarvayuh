/**
 * Example: attach SARVAYUH AI to your existing Express backend.
 * Adapt the provider methods to your own database. Everything else works as is.
 */
import express from "express";
import { HealthDataProvider, SarvayuhChatbot } from "./sarvayuh-chatbot";

// 1. Connect the bot to YOUR data. Replace the TODOs with real queries.
const healthData: HealthDataProvider = {
  async getRecentReports(userId, limit) {
    // TODO: e.g. return db.reports.findMany({ where: { userId }, take: limit, orderBy: { date: "desc" } })
    return [];
  },
  async getTestResults(userId, limit) {
    // TODO: map your lab rows to { name, value, unit, refLow, refHigh, date }
    return [];
  },
  async getMedicationReminders(userId) {
    // TODO: map prescriptions/reminders to { medicine, dosage, times, instructions }
    return [];
  },
};

// 2. Create the bot once at startup.
const bot = new SarvayuhChatbot({
  healthData,
  emergencyNumber: "112",
  // llm: yourLlmAdapter,   // optional; see the LlmAdapter interface
  onEvent: (e) => console.log("chatbot-event", e.type, e.sessionId), // audit log, contains no message text
});

// 3. Two routes are all your UI needs.
export const chatRouter = express.Router();

// Called when the chat screen opens: header, greeting, the four quick-action chips, disclaimer.
chatRouter.get("/chat/init", (_req, res) => res.json(bot.getInit()));

// Called for every message (typed or chip tap).
chatRouter.post("/chat", express.json({ limit: "10kb" }), async (req, res) => {
  const userId = (req as any).user?.id as string | undefined; // set by YOUR auth middleware
  const response = await bot.handle({
    sessionId: req.body?.sessionId,
    userId,
    message: String(req.body?.message ?? ""),
  });
  res.json(response);
});

/*
 * UI side (what your existing screen does):
 *
 *   const init = await fetch("/api/chat/init").then(r => r.json());   // show greeting + chips + disclaimer
 *   let sessionId: string | undefined;
 *
 *   async function send(message: string) {
 *     const res = await fetch("/api/chat", {
 *       method: "POST",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify({ sessionId, message }),
 *     }).then(r => r.json());
 *     sessionId = res.sessionId;
 *     // render res.messages (style "emergency" = red card, "notice" = amber card)
 *     // render res.quickReplies as chips under the last message
 *     // if res.actions has { type: "consult_doctor" } show a "Consult a doctor" button
 *     // footer text = res.disclaimer
 *   }
 */
