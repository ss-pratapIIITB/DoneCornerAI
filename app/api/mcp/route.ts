import { getDb, migrate } from "@/lib/db/sqlite";
import { handleMcpJsonRpc, type JsonRpcRequest } from "@/mcp/protocol";

export const runtime = "nodejs";

function sse(payload: unknown): Response {
  const data = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
  return new Response(data, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}

export async function GET(): Promise<Response> {
  return Response.json({ name: "donecorner", tools: "mcp" });
}

export async function POST(req: Request): Promise<Response> {
  const wantsSse = (req.headers.get("accept") ?? "").includes("text/event-stream");
  const body = (await req.json()) as JsonRpcRequest | JsonRpcRequest[];
  const db = getDb();
  migrate(db);
  const messages = Array.isArray(body) ? body : [body];
  const replies = [];
  for (const msg of messages) {
    const reply = await handleMcpJsonRpc(db, msg);
    if (reply) replies.push(reply);
  }
  const payload = Array.isArray(body) ? replies : (replies[0] ?? {});
  if (wantsSse) return sse(payload);
  return Response.json(payload);
}
