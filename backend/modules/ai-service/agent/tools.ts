/* Tools for SARVAYUH AI agent */
import { sanitize } from "../../../Ai/sarvayuh-chatbot";

export interface Tool<TArgs> {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: async (args) => Promise<{ok: boolean; content: string}>;
}

export type ToolResult = {ok: boolean; content: string};

/* TOOLS array with 6 tools */
export const TOOLS = [
  {
    name: "get_reports",
    execute: async (args) => { const u = (args as {userId?: string}).userId; return {ok: true, content: "reports"}; }
  },
  {
    name: "get_test_results",
    execute: async (args) => { const u = (args as {userId?: string}).userId; return {ok: true, content: "test results"}; }
  },
  {
    name: "get_medication_reminders",
    execute: async (args) => { const u = (args as {userId?: string}).userId; return {ok: true, content: "reminders"}; }
  },
  {
    name: "search_knowledge",
    execute: async (args) => { return {ok: true, content: "knowledge"}; }
  },
  {
    name: "call_emergency",
    execute: async (args) => { return {ok: true, content: "emergency"}; }
  },
  {
    name: "consult_doctor",
    execute: async (args) => { return {ok: true, content: "consult doctor"}; }
  },
];

/* Runtime dependencies */
export const toolDependencies = (data, retriever) => { globalThis.__healthDataProvider = data; globalThis.__retriever = retriever; };
/* ============================================================================
 * Register the runtime dependencies (health data + knowledge-retriever)
 * so the tool execute functions can fetch real data.
 * ========================================================================= */
export const toolDependencies = (data: ToolDependencyRuntime["__healthDataProvider"], retriever: ToolDependencyRuntime["__retriever"]): void => {
  const rt: ToolDependencyRuntime = {};
  if (data) rt.__healthDataProvider = data;
  if (retriever) rt.__retriever = retriever;
  (globalThis as ToolDependencyRuntime) = rt;
};
