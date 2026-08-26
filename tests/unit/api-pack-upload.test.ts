import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { POST } from "@/app/api/pack/upload/route";
import { getDb, migrate } from "@/lib/db/sqlite";

const PNL_HEADER =
  "period,entity,function,account,amount,currency,scenario,source";

function setup() {
  process.env.DONECORNER_DB = join(
    mkdtempSync(join(tmpdir(), "dc-up-api-")),
    "t.sqlite",
  );
  process.env.DONECORNER_UPLOADS = join(
    mkdtempSync(join(tmpdir(), "dc-up-api-files-")),
    "u",
  );
  const db = getDb();
  migrate(db);
  return db;
}

function req(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/pack/upload", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/pack/upload", () => {
  beforeEach(() => {
    delete process.env.TRUEFORGE_SANDBOX;
  });

  it("returns 403 for viewer", async () => {
    setup();
    process.env.TRUEFORGE_SANDBOX = "1";
    const res = await POST(
      req(
        { filename: "facts_pnl.csv", bytes: Buffer.from("x").toString("base64") },
        { "x-demo-user": "viewer" },
      ),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when sandbox is off", async () => {
    setup();
    const res = await POST(
      req({
        filename: "facts_pnl.csv",
        bytes: Buffer.from("x").toString("base64"),
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/sandbox/i) });
  });

  it("returns 400 for Excel workbooks", async () => {
    setup();
    process.env.TRUEFORGE_SANDBOX = "1";
    const res = await POST(
      req({
        filename: "facts.xls",
        bytes: Buffer.from("not-excel").toString("base64"),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/csv/i);
  });

  it("returns analysis after a recognized CSV", async () => {
    setup();
    process.env.TRUEFORGE_SANDBOX = "1";
    const csv = [
      PNL_HEADER,
      "2026-01,northstar,other,subscription,100,USD,actual,upload",
    ].join("\n");
    const res = await POST(
      req({
        filename: "facts_pnl.csv",
        bytes: Buffer.from(csv).toString("base64"),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rowsLoaded: number;
      ranIn: string;
      analysis: { pnl: { metric: string } } | null;
    };
    expect(body.ranIn).toBe("child");
    expect(body.rowsLoaded).toBe(1);
    expect(body.analysis?.pnl.metric).toBe("revenue");
  });

  it("skips analysis when the CSV shape is unknown", async () => {
    setup();
    process.env.TRUEFORGE_SANDBOX = "1";
    const res = await POST(
      req({
        filename: "notes.csv",
        bytes: Buffer.from("period,amount\n2026-01,1").toString("base64"),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rowsLoaded: number;
      analysis: unknown;
    };
    expect(body.rowsLoaded).toBe(0);
    expect(body.analysis).toBeNull();
  });
});
