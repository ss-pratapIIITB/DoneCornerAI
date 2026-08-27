import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, migrate } from "@/lib/db/sqlite";
import { handleMcpJsonRpc } from "@/mcp/protocol";

function freshDb() {
  process.env.DONECORNER_DB = join(
    mkdtempSync(join(tmpdir(), "dc-mcp-http-")),
    "t.sqlite",
  );
  const db = getDb();
  migrate(db);
  return db;
}

describe("MCP JSON-RPC", () => {
  beforeEach(() => {
    delete process.env.TRUEFORGE_SANDBOX;
  });

  it("initializes and lists close-pack tools", async () => {
    const db = freshDb();
    const init = await handleMcpJsonRpc(db, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    });
    expect(init).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: { serverInfo: { name: "donecorner" } },
    });
    const listed = await handleMcpJsonRpc(db, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });
    const names = (
      listed as { result: { tools: { name: string }[] } }
    ).result.tools.map((t) => t.name);
    expect(names).toContain("load_sample_pack");
    expect(names).toContain("query_cube");
    expect(names).toContain("request_publish_org");
  });

  it("calls load_sample_pack and returns periods", async () => {
    const db = freshDb();
    const res = await handleMcpJsonRpc(db, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "load_sample_pack", arguments: {} },
    });
    const body = JSON.parse(
      (res as { result: { content: { text: string }[] } }).result.content[0].text,
    ) as { periods: number };
    expect(body.periods).toBeGreaterThan(0);
  });
});

describe("MCP HTTP route", () => {
  it("returns 202 for notifications with no JSON-RPC body", async () => {
    process.env.DONECORNER_DB = join(
      mkdtempSync(join(tmpdir(), "dc-mcp-route-")),
      "t.sqlite",
    );
    const { POST } = await import("@/app/api/mcp/route");
    const res = await POST(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
      }),
    );
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });
});
