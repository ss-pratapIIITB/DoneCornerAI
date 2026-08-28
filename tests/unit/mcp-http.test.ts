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
    expect(names).toContain("query_lake");
    expect(names).toContain("query_sql");
    expect(names).toContain("present_chart");
    const present = (
      listed as { result: { tools: { name: string; description: string }[] } }
    ).result.tools.find((t) => t.name === "present_chart");
    expect(present?.description).toMatch(/filters\.period|month vs month/i);
    expect(names).toContain("load_lake");
    expect(names).toContain("list_dashboard_primitives");
    expect(names).toContain("validate_dashboard");
    expect(names).toContain("preview_dashboard");
    expect(names).toContain("save_personal_dashboard");
    expect(names).toContain("request_publish_org");
    expect(names).toContain("lookup_public_company");
    expect(names).toContain("fetch_public_url");
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

  it("returns JSON-RPC JSON when Accept lists JSON and event-stream", async () => {
    process.env.DONECORNER_DB = join(
      mkdtempSync(join(tmpdir(), "dc-mcp-accept-")),
      "t.sqlite",
    );
    const { POST } = await import("@/app/api/mcp/route");
    const res = await POST(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "0" },
          },
        }),
      }),
    );
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = (await res.json()) as {
      result: { serverInfo: { name: string } };
    };
    expect(body.result.serverInfo.name).toBe("donecorner");
  });

  it("returns 405 for GET event-stream so TrueForge uses POST JSON-RPC", async () => {
    const { GET } = await import("@/app/api/mcp/route");
    const res = await GET(
      new Request("http://localhost/api/mcp", {
        headers: { accept: "text/event-stream" },
      }),
    );
    expect(res.status).toBe(405);
  });
});

