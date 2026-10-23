import { retrieve } from "../rag/retriever";

/** re-export of the RAG retriever, exposed on `globalThis.__retriever` for the tools. */
export type retriever = typeof retrieve;
export { retrieve };
