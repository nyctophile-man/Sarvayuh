import type { Tool, ToolResult } from "./tools";

/* ---- The agent protocol ---- */
export interface Agent {
  run(userText: string, ctx: AgentContext): Promise<AgentObservations>;
}

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/* A tool call is what the agent *plans*; the host decides how/where to run it. */
export interface AgentToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AgentObservations {
  /** Tool calls this step of the agent decided to make. */
  toolCalls: AgentToolCall[];
  /** Final answer (only present when the agent decided not to call more tools). */
  finalAnswer?: string;
}

/**
 * Agent context: what the agent knows about the current conversation turn.
 * The `data` / `knowledgeRetriever` / `onEvent` are passed in by the host
 * (routes.ts) so the agent's tools can reach into the app's data layer.
 */
export interface AgentContext {
  userId?: string;
  sessionId?: string;
  systemPrompt?: string;
  data?: import("../../../Ai/sarvayuh-chatbot").HealthDataProvider;
  emergencyNumber?: string;
  crisisLine?: string;
  onEvent?: (e: import("../../../Ai/sarvayuh-chatbot").ChatEvent) => void;
}

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/* A tool call is what the agent *plans*; the host decides how/where to run it. */
export interface AgentToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AgentObservations {
  /** Tool calls this step of the agent decided to make. */
  toolCalls: AgentToolCall[];
  /** Final answer (only present when the agent decided not to call more tools). */
  finalAnswer?: string;
}

/**
 * Minimal LLM interface so the agent doesn't hard-depend on a specific
 * provider (Anthropic, Groq, OpenAI, …). The host wires it at startup.
 */
export interface Llm {
  chat(messages: AgentMessage[]): Promise<{ content: string }>;
}

/* ---- Durable concerns (now part of the agent, not the chatbot) ---- */
export class TokenBucket {
  private remaining: number;
  private refillRate: number; // tokens per ms
  private lastRefill: number;

  constructor(public capacity: number, public defaultTokens: number) {
    this.remaining = defaultTokens;
    this.refillRate = capacity / 60_000; // 1 minute window
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.remaining <= 0) {
      const waitMs = (1 - this.remaining) / this.refillRate;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      this.refill();
    }
    this.remaining -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.remaining = Math.min(this.capacity, this.remaining + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

/* ============================================================================
 * ReAct loop: each turn the agent (a) builds the prompt, (b) asks the LLM
 * for the next move, (c) executes every tool call, (d) observes results,
 * and (e) either hands back a final answer or continues.
 * ========================================================================= */
export class SingleTurnAgent {
  private tools: Map<string, Tool<Record<string, unknown>>>;
  private llm: Llm;
  private bucket: TokenBucket;

  constructor(tools: Tool<Record<string, unknown>>[], llm: Llm, bucket?: TokenBucket) {
    this.tools = new Map(tools.map((t) => [t.name, t]));
    this.llm = llm;
    this.bucket = bucket ?? new TokenBucket(60, 60);
  }

  async run(userText: string, context: AgentContext): Promise<AgentObservations> {
    await this.bucket.acquire();
    const messages = this.buildPrompt(userText, context);
    const response = await this.llm.chat(messages);
    const move = this.parseMove(response.content);
    if (move.finalAnswer !== undefined) return move;
    // Execute the planned tool calls (host-driven).
    const results = await Promise.all(
      move.toolCalls.map(async (call) => {
        const tool = this.tools.get(call.name);
        if (!tool) return { name: call.name, result: { ok: false, content: `Unknown tool "${call.name}".` } };
        try {
          const args = tool.parameters.type === "object" ? (call.args as Record<string, unknown>) : {};
          const r = await tool.execute(args);
          return { name: call.name, result: r };
        } catch (e) {
          return { name: call.name, result: { ok: false, content: String((e as Error).message), error: String((e as Error).message) } };
        }
      }),
    );
    return this.observe(results);
  }

  /* ---- helpers ---- */
  private buildPrompt(userText: string, context: AgentContext): AgentMessage[] {
    const system = `${context.systemPrompt ?? ""}\n\n` +
      `Available tools:\n${Array.from(this.tools.values())
        .map((t) => `- ${t.name}: ${t.description}\n  args: ${JSON.stringify(t.parameters)}`)
        .join("\n")}`;
    return [
      { role: "system", content: system },
      { role: "user", content: userText },
    ];
  }

  private parseMove(assistantText: string): AgentObservations {
    try {
      const parsed = JSON.parse(assistantText) as AgentObservations;
      if (!parsed || typeof parsed !== "object") return { toolCalls: [] };
      return {
        toolCalls: Array.isArray(parsed.toolCalls) ? parsed.toolCalls.filter((t) => t && typeof t.name === "string") : [],
        finalAnswer: typeof parsed.finalAnswer === "string" ? parsed.finalAnswer : undefined,
      };
    } catch {
      return { toolCalls: [] };
    }
  }

  private observe(results: Array<{ name: string; result: ToolResult }>): AgentObservations {
    const lines = results
      .map((r) => `${r.name} -> ${r.result.ok ? "yes" : "no"}: ${r.result.content.slice(0, 120)}`)
      .join("\n");
    return {
      toolCalls: [],
      finalAnswer: `I did what I could:\n${lines}\n\nBased on the above, how would you like to proceed?`,
    };
  }
}

