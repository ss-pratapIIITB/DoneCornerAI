import { getDb, migrate } from "@/lib/db/sqlite";
import { handleMcpJsonRpc, type JsonRpcRequest } from "@/mcp/protocol";

export const runtime = "nodejs";

/** TrueForge sends Accept: application/json, text/event-stream. Prefer JSON-RPC JSON. */
export function mcpWantsSse(accept: string | null): boolean {
  const header = accept ?? "";
  if (!header.includes("text/event-stream")) return false;
  return !header.includes("application/json");
}

function sse(payload: unknown): Response {
  const data = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
  return new Response(data, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}

export async function GET(req: Request): Promise<Response> {
  if (mcpWantsSse(req.headers.get("accept"))) {
    return new Response("Use POST JSON-RPC", {
      status: 405,
      headers: { allow: "POST" },
    });
  }
  return Response.json({ name: "donecorner", tools: "mcp" });
}

export async function POST(req: Request): Promise<Response> {
  const wantsSse = mcpWantsSse(req.headers.get("accept"));
  const body = (await req.json()) as JsonRpcRequest | JsonRpcRequest[];
  const db = getDb();
  migrate(db);
  const messages = Array.isArray(body) ? body : [body];
  const replies = [];
  for (const msg of messages) {
    const reply = await handleMcpJsonRpc(db, msg);
    if (reply) replies.push(reply);
  }
  if (replies.length === 0) {
    return new Response(null, { status: 202 });
  }
  const payload = Array.isArray(body) ? replies : (replies[0] ?? {});
  if (wantsSse) return sse(payload);
  return Response.json(payload);
}
