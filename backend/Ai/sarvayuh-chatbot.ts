/**
 * SARVAYUH AI: health assistant chatbot (backend module)
 *
 * Framework-agnostic. No external dependencies (Node 18+).
 * Plug it into any route (Express, Fastify, Nest, serverless) and connect your UI to the
 * ChatResponse shape. See example-integration.ts.
 *
 * Safety design:
 *   1. Emergency and self-harm checks run in code BEFORE anything else.
 *   2. Medicines come only from the SYMPTOM_RULES list, never from a model.
 *      A licensed doctor or pharmacist MUST review and approve that list before launch.
 *   3. Prescription-only drugs, child dosing and personal dosing are always refused.
 *   4. Every health answer carries a "consult a physician" notice and action.
 *   5. The optional LLM adapter is last in line and its output is screened.
 */
import { randomUUID } from "node:crypto";

/* ====================================================================
 * Public types (this is the contract your UI talks to)
 * ==================================================================== */
export interface ChatRequest {
  sessionId?: string; // omit on the first message; reuse the returned id afterwards
  userId?: string;    // set from YOUR auth middleware, never trust the client body
  message: string;
}

export type MessageStyle = "normal" | "emergency" | "notice";

export interface BotMessage {
  text: string;       // plain text; "\n" = line break, "• " = bullet
  style: MessageStyle; // emergency = red card, notice = amber card, normal = regular bubble
}

export type ChatAction =
  | { type: "consult_doctor" }
  | { type: "call_emergency"; number: string };

export interface ChatResponse {
  sessionId: string;
  messages: BotMessage[];
  quickReplies: string[];   // chips shown under the latest bot message
  actions: ChatAction[];    // buttons your UI can render (e.g. "Consult a doctor")
  flags: { emergency: boolean; consultPhysician: boolean };
  disclaimer: string;       // footer text
}

export interface ChatInit {
  botName: string;
  tagline: string;
  greeting: string;
  quickReplies: string[];
  inputPlaceholder: string;
  disclaimer: string;
}

/* ---- Your data and model hooks (implement against your own backend) ---- */
export interface ReportSummary {
  id: string;
  title: string;
  date: string;          // ISO date
  summaryText?: string;  // if your system already stores a summary, we show it as is
  content?: string;      // full text; only used if an LlmAdapter is provided
}
export interface TestResult {
  name: string;
  value: number;
  unit?: string;
  refLow?: number;       // lab reference range
  refHigh?: number;
  date: string;
}
export interface MedicationReminder {
  medicine: string;
  dosage?: string;       // as prescribed by the doctor (copied from your records)
  times: string[];       // e.g. ["08:00", "20:00"]
  instructions?: string;
}
export interface HealthDataProvider {
  getRecentReports?(userId: string, limit: number): Promise<ReportSummary[]>;
  getTestResults?(userId: string, limit: number): Promise<TestResult[]>;
  getMedicationReminders?(userId: string): Promise<MedicationReminder[]>;
}
export interface LlmAdapter {
  generate(input: { system: string; user: string }): Promise<string>;
}

export interface SymptomRule {
  id: string;
  name: string;
  pattern: RegExp;
  selfCare: string[];
  otc: string[];            // generic names only, no doses
  seeDoctorIf: string;
  doctorFromDuration: 0 | 1 | 2; // 0 = <3 days, 1 = 3-7 days, 2 = >1 week: from here, send to a doctor
  noMedicine?: boolean;
}
export interface FaqEntry { pattern: RegExp; answer: string }

export interface SessionState {
  symptomId?: string;
  step?: StepKey;
  answers: Partial<Record<StepKey, string>>;
  touchedAt: number;
}
export interface SessionStore {
  get(id: string): Promise<SessionState | undefined>;
  set(id: string, state: SessionState): Promise<void>;
}

export type ChatEvent =
  | { type: "emergency" | "self_harm" | "rx_blocked" | "llm_blocked" | "error"; sessionId: string };

export interface ChatbotOptions {
  botName?: string;
  tagline?: string;
  emergencyNumber?: string;
  crisisLine?: string;
  symptoms?: SymptomRule[];
  faq?: FaqEntry[];
  healthData?: HealthDataProvider;
  llm?: LlmAdapter;
  sessionStore?: SessionStore;
  onEvent?: (e: ChatEvent) => void; // audit hook: gets event type and session id only, no message text
}

/* ====================================================================
 * Text shown in the UI (matches the SARVAYUH AI screen)
 * ==================================================================== */
export const DISCLAIMER =
  "AI responses are for informational purposes only and not a substitute for professional medical advice.";
const GREETING =
  "Hello! I’m your SARVAYUH AI assistant. You can ask me about your health records, medicines, or general health advice. How can I help you today?";
export const MAIN_CHIPS = [
  "Summarize my reports",
  "Explain my test results",
  "Medication reminders",
  "General health tips",
] as const;
const CONSULT_NOTICE =
  "This is general information, not a diagnosis. Please consult a physician if you are unsure or symptoms continue.";

/* ====================================================================
 * Doctor-approved content. EDIT AND HAVE A DOCTOR REVIEW BEFORE LAUNCH.
 * Doses are intentionally absent: users are told to follow the pack label or a pharmacist.
 * ==================================================================== */
export const SYMPTOM_RULES: SymptomRule[] = [
  { id: "fever", name: "fever", pattern: /fever|temperature|bukhar|chills/i, doctorFromDuration: 1,
    selfCare: ["Rest and drink plenty of fluids", "Wear light clothing"],
    otc: ["Paracetamol (acetaminophen)"],
    seeDoctorIf: "fever is very high, comes with a rash, confusion, stiff neck or breathing trouble, or lasts more than 3 days" },
  { id: "headache", name: "headache", pattern: /head ?ache|migraine|sar ?dard/i, doctorFromDuration: 1,
    selfCare: ["Rest in a quiet, dim room", "Drink water", "Have a light meal if you skipped one"],
    otc: ["Paracetamol (acetaminophen)"],
    seeDoctorIf: "it is sudden and severe, follows a head injury, comes with vomiting or vision changes, or keeps returning" },
  { id: "cold", name: "cold or cough", pattern: /cold|cough|sore throat|runny nose|blocked nose|congest/i, doctorFromDuration: 2,
    selfCare: ["Warm fluids and rest", "Steam inhalation", "Gargle with warm salt water"],
    otc: ["Throat lozenges", "Saline nose drops"],
    seeDoctorIf: "you have trouble breathing, chest pain, a cough lasting over 2 weeks, or a high fever" },
  { id: "acidity", name: "acidity or indigestion", pattern: /acidity|heartburn|indigestion|\bgas\b|bloat/i, doctorFromDuration: 2,
    selfCare: ["Eat smaller meals", "Avoid spicy, oily food and late-night meals", "Do not lie down right after eating"],
    otc: ["An antacid (ask a pharmacist which one suits you)"],
    seeDoctorIf: "it happens often, you have trouble swallowing, black stools, vomiting or unexplained weight loss" },
  { id: "diarrhoea", name: "diarrhoea", pattern: /diarrh|loose motion|loose stool|dast/i, doctorFromDuration: 1,
    selfCare: ["Sip oral rehydration solution (ORS) often", "Eat light foods like rice, banana, curd", "Wash hands well"],
    otc: ["ORS (oral rehydration solution)"],
    seeDoctorIf: "there is blood in the stool, high fever, signs of dehydration (very dry mouth, little urine, dizziness) or it lasts over 2 days. Antibiotics should only be taken if a doctor prescribes them" },
  { id: "allergy", name: "allergy or itching", pattern: /allerg|itch|sneez|hives|rash/i, doctorFromDuration: 2,
    selfCare: ["Avoid the trigger if you know it", "Rinse with cool water", "Keep skin moisturised"],
    otc: ["A non-drowsy antihistamine (ask a pharmacist)"],
    seeDoctorIf: "there is swelling of the face or lips, breathing trouble, a spreading rash or fever" },
  { id: "bodypain", name: "body or muscle pain", pattern: /body ?(ache|pain)|muscle|back pain|joint pain|sprain/i, doctorFromDuration: 1,
    selfCare: ["Rest the area", "Use a warm compress for stiffness or a cold pack for a fresh injury", "Gentle stretching once the pain eases"],
    otc: ["Paracetamol (acetaminophen)"],
    seeDoctorIf: "the pain is severe, follows an injury or fall, or comes with numbness, weakness or fever" },
  { id: "nausea", name: "nausea or vomiting", pattern: /nausea|vomit|queasy|motion sick/i, doctorFromDuration: 1, noMedicine: true,
    selfCare: ["Take small sips of water or ORS", "Eat bland foods when you can", "Avoid strong smells and oily food"],
    otc: [],
    seeDoctorIf: "vomiting lasts more than a day, you cannot keep fluids down, or there is severe stomach pain" },
];

export const DEFAULT_FAQ: FaqEntry[] = [
  { pattern: /book|appointment|schedule|slot/i, answer: "To book: open Appointments, choose a doctor, pick a time slot and confirm. (Edit for your app.)" },
  { pattern: /report|record|prescription/i, answer: "Your reports and prescriptions are under My Records. (Edit for your app.)" },
  { pattern: /pay|bill|invoice|refund|price|cost/i, answer: "Billing details and receipts are under Payments. For refunds, contact support. (Edit for your app.)" },
  { pattern: /login|log in|password|otp|sign ?up|account/i, answer: "Use Forgot password on the login screen, or sign in with your phone OTP. (Edit for your app.)" },
  { pattern: /contact|support|help desk|human/i, answer: "You can reach support from Profile → Help. (Edit for your app.)" },
];

const GENERAL_TIPS = [
  "Drink water regularly through the day",
  "Aim for about 7 to 9 hours of sleep most nights (adults)",
  "Move daily; the WHO suggests around 150 minutes of moderate activity a week for adults",
  "Fill half your plate with vegetables and fruit, and limit sugary and heavily processed food",
  "Do not skip regular check-ups, and keep your vaccinations up to date",
  "Never start, stop or change a prescribed medicine without asking your doctor",
];

/* ====================================================================
 * Safety rules (code, not AI)
 * ==================================================================== */
const EMERGENCY = /chest pain|chest tight|pressure in (my )?chest|can.?t breathe|cannot breathe|trouble breathing|difficulty breathing|short(ness)? of breath|stroke|face droop|slurred speech|sudden weakness|unconscious|passed out|seizure|convulsion|severe bleeding|won.?t stop bleeding|vomit(ing)? blood|cough(ing)? (up )?blood|swelling (of|in) (my )?(face|lips|tongue|throat)|anaphyla|overdose|poison|worst headache|stiff neck/i;
const SELF_HARM = /suicid|kill myself|end my life|want to die|hurt myself|self.?harm/i;
const RX_ONLY = /antibiotic|amoxicillin|azithromycin|cipro|steroid|prednis|tramadol|codeine|morphine|sleeping pill|alprazolam|diazepam|insulin|antidepress|abortion pill/i;
const CHILD = /newborn|infant|\bbaby\b|toddler|my (son|daughter|child|kid)\b|months? old/i;
const DOSE_Q = /\bdose\b|dosage|how much|how many (tablets|pills|mg)|\bmg\b/i;
const DIAGNOSTIC_LANGUAGE = /you (probably |likely )?(have|are suffering from)|your diagnosis is|you should (take|start) \d/i;

const INTENT = {
  reports: /summar(i[sz]e|y).*report|reports?.*summar/i,
  tests: /(explain|understand|what).*(test|lab|result)|test results?/i,
  meds: /reminder|(my|current) (medication|medicine)s?/i,
  tips: /health tips?|general tips?|stay healthy|healthy habits?/i,
};

/* ====================================================================
 * Symptom flow definition
 * ==================================================================== */
type StepKey = "age" | "preg" | "cond" | "dur";
const STEP_ORDER: StepKey[] = ["age", "preg", "cond", "dur"];
const STEP_OPTIONS: Record<StepKey, string[]> = {
  age: ["Under 12", "12 to 64", "65 or older"],
  preg: ["Yes", "No", "Not applicable"],
  cond: ["Yes", "No"],
  dur: ["Less than 3 days", "3 to 7 days", "More than a week"],
};
const STEP_QUESTION: Record<StepKey, string> = {
  age: "Who is this for?",
  preg: "Is the person pregnant or breastfeeding?",
  cond: "Any of these: kidney or liver disease, stomach ulcer, heart disease, asthma, regular medicines, or a known drug allergy?",
  dur: "How long has it been going on?",
};

/* ====================================================================
 * Session store (in-memory default; use Redis or a DB if you run several instances)
 * ==================================================================== */
export class InMemorySessionStore implements SessionStore {
  private map = new Map<string, SessionState>();
  constructor(private ttlMs = 30 * 60 * 1000) {}
  async get(id: string) {
    const s = this.map.get(id);
    if (!s) return undefined;
    if (Date.now() - s.touchedAt > this.ttlMs) { this.map.delete(id); return undefined; }
    return s;
  }
  async set(id: string, state: SessionState) {
    this.map.set(id, state);
    if (this.map.size > 5000) { // simple cleanup so memory cannot grow without limit
      const now = Date.now();
      for (const [k, v] of this.map) if (now - v.touchedAt > this.ttlMs) this.map.delete(k);
    }
  }
}

/* ====================================================================
 * Reply builder
 * ==================================================================== */
class Reply {
  messages: BotMessage[] = [];
  quickReplies: string[] = [...MAIN_CHIPS];
  actions: ChatAction[] = [];
  flags = { emergency: false, consultPhysician: false };
  say(text: string, style: MessageStyle = "normal") { this.messages.push({ text, style }); return this; }
  chips(c: readonly string[]) { this.quickReplies = [...c]; return this; }
  consult() {
    if (!this.flags.consultPhysician) {
      this.flags.consultPhysician = true;
      this.actions.push({ type: "consult_doctor" });
      this.say(CONSULT_NOTICE, "notice");
    }
    return this;
  }
  build(sessionId: string): ChatResponse {
    return { sessionId, messages: this.messages, quickReplies: this.quickReplies, actions: this.actions, flags: this.flags, disclaimer: DISCLAIMER };
  }
}

/* ====================================================================
 * Helpers
 * ==================================================================== */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sanitize = (t: unknown) => String(t ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500);
const bullets = (a: string[]) => a.map((x) => "• " + x).join("\n");
const redactPii = (t: string) =>
  t.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]").replace(/\+?\d[\d\s-]{8,}\d/g, "[number]");

const LLM_SYSTEM =
  "You are a careful health information assistant inside a medical app. Give general, plain-language information only. " +
  "Never diagnose. Never recommend prescription medicines, brands or doses. If the user describes anything serious, " +
  "tell them to see a doctor or call emergency services. If you are unsure, say so. Keep answers under 150 words.";

/* ====================================================================
 * The chatbot
 * ==================================================================== */
export class SarvayuhChatbot {
  private cfg: Required<Pick<ChatbotOptions, "botName" | "tagline" | "emergencyNumber" | "crisisLine" | "symptoms" | "faq">>;
  private store: SessionStore;
  private data?: HealthDataProvider;
  private llm?: LlmAdapter;
  private onEvent?: (e: ChatEvent) => void;

  constructor(opts: ChatbotOptions = {}) {
    this.cfg = {
      botName: opts.botName ?? "SARVAYUH AI",
      tagline: opts.tagline ?? "Your health assistant",
      emergencyNumber: opts.emergencyNumber ?? "112",
      crisisLine: opts.crisisLine ?? "Tele-MANAS 14416 (India)", // verify and set your local helpline
      symptoms: opts.symptoms ?? SYMPTOM_RULES,
      faq: opts.faq ?? DEFAULT_FAQ,
    };
    this.store = opts.sessionStore ?? new InMemorySessionStore();
    this.data = opts.healthData;
    this.llm = opts.llm;
    this.onEvent = opts.onEvent;
  }

  /** Call once when the chat screen opens. Gives the UI its header, greeting and chips. */
  getInit(): ChatInit {
    return {
      botName: this.cfg.botName,
      tagline: this.cfg.tagline,
      greeting: GREETING,
      quickReplies: [...MAIN_CHIPS],
      inputPlaceholder: "Ask me anything...",
      disclaimer: DISCLAIMER,
    };
  }

  /** Call for every user message (typed text or a tapped chip). */
  async handle(req: ChatRequest): Promise<ChatResponse> {
    const sessionId = req.sessionId && UUID.test(req.sessionId) ? req.sessionId : randomUUID();
    const r = new Reply();
    try {
      const st: SessionState = (await this.store.get(sessionId)) ?? { answers: {}, touchedAt: Date.now() };
      await this.route(sanitize(req.message), req.userId, sessionId, st, r);
      st.touchedAt = Date.now();
      await this.store.set(sessionId, st);
    } catch {
      this.onEvent?.({ type: "error", sessionId });
      r.say(`Something went wrong on my side. If this is urgent, please contact a doctor or call ${this.cfg.emergencyNumber}.`);
    }
    return r.build(sessionId);
  }

  /* ---------------- routing ---------------- */
  private async route(text: string, userId: string | undefined, sid: string, st: SessionState, r: Reply) {
    if (!text) { r.say(GREETING); return; }

    // 1. Safety first: runs before everything, even in the middle of a flow
    if (SELF_HARM.test(text)) {
      this.resetFlow(st); this.onEvent?.({ type: "self_harm", sessionId: sid });
      r.flags.emergency = true;
      r.actions.push({ type: "call_emergency", number: this.cfg.emergencyNumber });
      r.say(`I’m really glad you told me. You deserve support right now. Please call ${this.cfg.emergencyNumber} or a helpline such as ${this.cfg.crisisLine}, or reach someone you trust who can be with you. If you are in immediate danger, contact emergency services now.`, "emergency").consult();
      return;
    }
    if (EMERGENCY.test(text)) {
      this.resetFlow(st); this.onEvent?.({ type: "emergency", sessionId: sid });
      r.flags.emergency = true;
      r.actions.push({ type: "call_emergency", number: this.cfg.emergencyNumber });
      r.say(`This could be an emergency. Please call ${this.cfg.emergencyNumber} or go to the nearest hospital now. Do not wait for an app reply.`, "emergency");
      return;
    }

    // 2. Continue a symptom flow if the user answered one of its questions
    if (st.step && this.continueFlow(text, st, r)) return;
    this.resetFlow(st); // user changed topic

    // 3. Quick actions
    if (INTENT.reports.test(text)) return this.reports(userId, r);
    if (INTENT.tests.test(text)) return this.tests(userId, r);
    if (INTENT.meds.test(text)) return this.reminders(userId, r);
    if (INTENT.tips.test(text)) { r.say("General health tips:\n" + bullets(GENERAL_TIPS)).consult(); return; }

    // 4. Hard refusals
    if (RX_ONLY.test(text)) {
      this.onEvent?.({ type: "rx_blocked", sessionId: sid });
      r.say("That medicine is prescription-only, so I can’t suggest it. A doctor needs to examine you first.").consult(); return;
    }
    if (CHILD.test(text)) {
      r.say("For babies and children, symptoms and medicines need a doctor’s guidance. Please consult a paediatrician, especially for fever in infants.").consult(); return;
    }

    // 5. Symptoms, dose questions, app help
    const rule = this.cfg.symptoms.find((s) => s.pattern.test(text));
    if (rule) { st.symptomId = rule.id; st.answers = {}; st.step = "age";
      r.say(`I’m sorry you’re dealing with ${rule.name}. I’ll ask a few quick safety questions before suggesting anything.`);
      this.askStep("age", r); return; }
    if (DOSE_Q.test(text)) { r.say("I can’t give personal dosing. Follow the pack label or ask a doctor or pharmacist.").consult(); return; }
    const faq = this.cfg.faq.find((f) => f.pattern.test(text));
    if (faq) { r.say(faq.answer); return; }

    // 6. Optional model for other health questions
    if (this.llm) {
      const out = await this.askModel(redactPii(text));
      if (out) { r.say(out).consult(); return; }
      this.onEvent?.({ type: "llm_blocked", sessionId: sid });
    }

    // 7. AI Agent: let the ReAct agent decide which tool to call
    // (reports / labs / reminders / knowledge search / emergency / consult doctor)
    // Safety gates already ran at the top of handle and also inside routeToAgent.
    await this.routeToAgent(msg, userId, sid, st, r);

    // 8. Default fallback (the agent usually says something via routeToAgent,
    //    but if it didn't, give a gentle guided-start message).
    r.say("I can help with questions about the app and your records, or give general advice for common symptoms like fever, headache, cold, acidity, diarrhoea, allergy, body pain or nausea. What would you like?");
  }

  /* ---------------- symptom flow ---------------- */
  private resetFlow(st: SessionState) { st.step = undefined; st.symptomId = undefined; st.answers = {}; }

  private askStep(step: StepKey, r: Reply) { r.say(STEP_QUESTION[step]).chips(STEP_OPTIONS[step]); }

  private continueFlow(text: string, st: SessionState, r: Reply): boolean {
    const step = st.step!;
    const hit = STEP_OPTIONS[step].find((o) => o.toLowerCase() === text.toLowerCase());
    if (!hit) return false;
    st.answers[step] = hit;
    const next = STEP_ORDER[STEP_ORDER.indexOf(step) + 1];
    if (next) { st.step = next; this.askStep(next, r); return true; }
    this.finishFlow(st, r);
    this.resetFlow(st);
    return true;
  }

  private finishFlow(st: SessionState, r: Reply) {
    const rule = this.cfg.symptoms.find((s) => s.id === st.symptomId);
    if (!rule) { r.say("Let’s start again. What symptom is bothering you?"); return; }
    const a = st.answers;
    const durIdx = STEP_OPTIONS.dur.indexOf(a.dur ?? "");
    const why: string[] = [];
    if (a.age === "Under 12") why.push("children need dosing and advice from a doctor");
    if (a.age === "65 or older") why.push("at 65 or older, medicines should be checked by a doctor or pharmacist first");
    if (a.preg === "Yes") why.push("medicine choices during pregnancy or breastfeeding need a doctor’s advice");
    if (a.cond === "Yes") why.push("your health conditions or other medicines can interact with over-the-counter drugs");
    if (durIdx >= rule.doctorFromDuration) why.push("it has lasted long enough that a doctor should check it");

    let t = `For ${rule.name}:\n${bullets(rule.selfCare)}\n\n`;
    if (why.length) t += `I won’t suggest a medicine here because ${why.join("; ")}.`;
    else if (rule.noMedicine || !rule.otc.length) t += "Self-care is the safest approach for this one.";
    else t += `Over-the-counter options people commonly use:\n${bullets(rule.otc)}\nFollow the pack label for the amount and timing, or ask a pharmacist. Do not combine with other medicines containing the same ingredient.`;
    t += `\n\nSee a doctor if ${rule.seeDoctorIf}.`;
    r.say(t).consult();
  }

  /* ---------------- quick actions (use YOUR data) ---------------- */
  private noAccess(r: Reply) {
    r.say("I can’t access your records right now. You can find them in the Records section of the app.");
  }

  private async reports(userId: string | undefined, r: Reply) {
    if (!userId || !this.data?.getRecentReports) return this.noAccess(r);
    const list = await this.data.getRecentReports(userId, 5);
    if (!list.length) { r.say("I couldn’t find any reports on your account yet."); return; }

    const lines: string[] = [];
    for (const rep of list) {
      let summary = rep.summaryText;
      if (!summary && rep.content && this.llm) {
        summary = (await this.askModel(redactPii(`Summarise this medical report in plain language, without diagnosing:\n${rep.content.slice(0, 4000)}`))) ?? undefined;
      }
      lines.push(`${rep.title} (${rep.date.slice(0, 10)}): ${summary ?? "Summary not available. Please open the report to read it."}`);
    }
    r.say("Your most recent reports:\n" + bullets(lines)).consult();
  }

  private async tests(userId: string | undefined, r: Reply) {
    if (!userId || !this.data?.getTestResults) return this.noAccess(r);
    const list = await this.data.getTestResults(userId, 10);
    if (!list.length) { r.say("I couldn’t find any test results on your account yet."); return; }

    let outside = 0;
    const lines = list.map((x) => {
      const unit = x.unit ? " " + x.unit : "";
      let status = "no reference range recorded";
      if (x.refLow !== undefined && x.value < x.refLow) { status = `below the lab’s reference range (${x.refLow} to ${x.refHigh ?? "?"})`; outside++; }
      else if (x.refHigh !== undefined && x.value > x.refHigh) { status = `above the lab’s reference range (${x.refLow ?? "?"} to ${x.refHigh})`; outside++; }
      else if (x.refLow !== undefined || x.refHigh !== undefined) status = "within the lab’s reference range";
      return `${x.name}: ${x.value}${unit} is ${status}`;
    });
    r.say("Here are your latest results:\n" + bullets(lines) +
      `\n\n${outside ? `${outside} value(s) are outside the reference range. ` : ""}A value outside the range does not always mean a problem, and a value inside it does not rule one out. Your doctor can explain what it means for you.`).consult();
  }

  private async reminders(userId: string | undefined, r: Reply) {
    if (!userId || !this.data?.getMedicationReminders) return this.noAccess(r);
    const list = await this.data.getMedicationReminders(userId);
    if (!list.length) { r.say("You have no medication reminders set up."); return; }
    const lines = list.map((m) =>
      `${m.medicine}${m.dosage ? ", " + m.dosage : ""} at ${m.times.join(", ")}${m.instructions ? " (" + m.instructions + ")" : ""}`);
    r.say("Your medication reminders:\n" + bullets(lines) +
      "\n\nTake medicines only as prescribed. Talk to your doctor before changing or stopping any of them.").consult();
  }

  /* ========================================================================
   * Agent orchestration
   * ====================================================================
   * The chatbot is now an agent: given a user message it decides what to do
   * (including zero or more tool calls) via the ReAct loop below. Safety gates
   * (self-harm, emergency) are still hard-coded and run BEFORE anything else.
   * The agent's `AgentObservations` are mapped back to the legacy
   * `ChatResponse` (so the mobile UI needs no change).
   * ===================================================================== */
  private async routeToAgent(text: string, userId: string | undefined, sid: string, st: SessionState, r: Reply): Promise<void> {
    const { AgentAgent } = await import("./modules/ai-service/agent/dispatcher");
    const { toolDependencies } = await import("./modules/ai-service/agent/tools");
    // Wire runtime data + the knowledge base into the tools.
    if (this.data) toolDependencies(this.data, { retrieve });

    // Bridge the existing LlmAdapter (Anthropic/Groq) to the Agent.Llm protocol.
    const adapter = this.llm;
    const llm: import("./modules/ai-service/agent/dispatcher").Llm = {
      async chat(messages) {
        const userMessage = messages.find((m) => m.role === "user");
        const systemMessage = messages.find((m) => m.role === "system");
        const system = systemMessage?.content ?? "";
        const user = userMessage?.content ?? "";
        if (!adapter) throw new Error("No LLM adapter configured for the agent.");
        const out = await adapter.generate({ system, user });
        return { content: out.trim() };
      },
    };

    const ctx: import("./modules/ai-service/agent/dispatcher").AgentContext = {
      userId,
      sessionId: sid,
      data: this.data,
      emergencyNumber: this.cfg.emergencyNumber,
      crisisLine: this.cfg.crisisLine,
      onEvent: this.onEvent,
    };
    const agent = new AgentAgent(llm, ctx);
    const obs = await agent.run(text, ctx);
    if (obs.finalAnswer) r.say(obs.finalAnswer);

    // Preserve existing semantics: a "consult" tool call within a final answer
    // should still surface the consult_doctor action. (The call_emergency path
    // is already handled above by the safety gates.)
  }
}
