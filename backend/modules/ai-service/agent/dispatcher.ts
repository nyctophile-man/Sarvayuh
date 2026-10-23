/* ============================================================================
 * Agent implementation that uses the ReAct loop. It keeps the existing
 * bot's safety-first ordering, but *routes through the tool system*: a data
 * question (reports / labs / reminders / tips) becomes a `get_*` or
 * `search_knowledge` tool call instead of a hard-coded `if` branch.
 *
 * The host (routes.ts) wires up the LLM provider, the tool set, and the
 * runtime data (healthData + knowledge base) on first start.
 * ========================================================================= */
import type { Agent, AgentContext, Llm, SingleTurnAgent } from "./agent";
import type { ToolResult } from "./tools";
import { TOOLS } from "./tools";
import { TokenBucket } from "./agent";

/* ---- Safety predicates (copied from the existing chatbot so emergency and
 * self-harm stay hard-code-gated and *never* reach the LLM). ---- */
function isEmergency(text: string): boolean {
  return /chest pain|chest tight|pressure in (my )?chest|can.?t breathe|cannot breathe|trouble breathing|difficulty breathing|short(ness)? of breath|stroke|face droop|slurred speech|sudden weakness|unconscious|passed out|seizure|convulsion|severe bleeding|won.?t stop bleeding|vomit(ing)? blood|cough(ing)? (up )?blood|swelling (of|in) (my )?(face|lips|tongue|throat)|anaphyla|overdose|poison|worst headache|stiff neck/i.test(text);
}

function isSelfHarm(text: string): boolean {
  return /suicid|kill myself|end my life|want to die|hurt myself|self.?harm/i.test(text);
}

export interface AgentContext extends import("./agent").AgentContext {
  emergencyNumber: string;
  crisisLine: string;
}

/**
 * ReAct agent: keeps the existing chatbot's safety-first ordering, but *routes
 * through the tool system*. A data question (reports / labs / reminders / tips)
 * becomes a `get_*` or `search_knowledge` tool call instead of a hard-coded
 * `if` branch, so a future LLM could write its own plan, chain tools, and ask
 * follow-ups.
 */
export class AgentAgent implements Agent {
  private agent: SingleTurnAgent;

  constructor(llm: Llm, ctx: AgentContext) {
    // Token budget per minute so an agent can't hammer the provider.
    const bucket = new TokenBucket(60, 60);
    this.agent = new SingleTurnAgent(TOOLS, llm, bucket);
  }

  async run(userText: string, ctx: AgentContext): Promise<import("./agent").AgentObservations> {
    // 1. Hard safety gates run before the LLM (and before ANY tool).
    if (isSelfHarm(userText)) {
      ctx.onEvent?.({ type: "self_harm", sessionId: ctx.sessionId ?? "" });
      return {
        toolCalls: [],
        finalAnswer: `I'm really glad you told me. Please call ${ctx.emergencyNumber} or a helpline such as Tele-MANAS 14416 (India), or reach someone you trust who can be with you. If you are in immediate danger, contact emergency services now.`,
      };
    }
    if (isEmergency(userText)) {
      ctx.onEvent?.({ type: "emergency", sessionId: ctx.sessionId ?? "" });
      return {
        toolCalls: [{ name: "call_emergency", args: { number: ctx.emergencyNumber } }],
        finalAnswer: `This could be an emergency. Please call the emergency number now.`,
      };
    }

    // 2. Wire the runtime data into the tools, then run the ReAct loop.
    const { toolDependencies } = await import("./tools");
    if (ctx.data) toolDependencies(ctx.data, { retrieve });
    return this.agent.run(userText, ctx);
  }
}
