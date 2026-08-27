import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, migrate } from "@/lib/db/sqlite";
import { createArtifact } from "@/lib/artifacts/store";
import { savePersonalDashboard } from "@/lib/dashboards/store";
import { callTool } from "@/mcp/tools";

function freshDb() {
  process.env.DONECORNER_DB = join(mkdtempSync(join(tmpdir(), "dc-mcp-")), "t.sqlite");
  const db = getDb();
  migrate(db);
  return db;
}

describe("MCP tools", () => {
  beforeEach(() => {
    delete process.env.TRUEFORGE_SANDBOX;
  });

  it("load_sample_pack returns periods", async () => {
    const db = freshDb();
    const result = await callTool(db, "load_sample_pack", {});
    expect(result).toMatchObject({ periods: expect.any(Number) });
    expect((result as { periods: number }).periods).toBeGreaterThan(0);
  });

  it("describe_schema includes facts_pnl", async () => {
    const db = freshDb();
    const result = (await callTool(db, "describe_schema", {})) as {
      tables: { name: string }[];
    };
    expect(result.tables.some((t) => t.name === "facts_pnl")).toBe(true);
  });

  it("query_cube returns revenue rows after load", async () => {
    const db = freshDb();
    await callTool(db, "load_sample_pack", {});
    const result = (await callTool(db, "query_cube", {
      metric: "revenue",
      grain: "period",
      filters: { scenario: "actual" },
    })) as { rows: unknown[] };
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it("save_personal_dashboard rejects the legacy unversioned dashboard shape", async () => {
    const db = freshDb();
    const org = (await callTool(db, "get_dashboard", { id: "org-close" })) as {
      id: string;
      widgets: unknown[];
    };
    expect(org.id).toBe("org-close");
    const result = (await callTool(db, "save_personal_dashboard", {
      userId: "cfo",
      dashboard: {
        id: "personal-cfo-test",
        name: "CFO draft",
        owner: "cfo",
        forkedFrom: "org-close",
        widgets: [
          {
            id: "w1",
            type: "kpi",
            title: "revenue",
            query: { metric: "revenue", grain: "period", filters: { scenario: "actual" } },
            note: "",
          },
        ],
      },
    })) as { valid: boolean; findings: Array<{ code: string }> };
    expect(result.valid).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unsupported_dsl_version" }),
      ]),
    );
    const orgAfter = (await callTool(db, "get_dashboard", { id: "org-close" })) as {
      widgets: unknown[];
    };
    expect(orgAfter.widgets).toHaveLength(0);
  });

  it("request_publish_org queues pending and does not overwrite org Close", async () => {
    const db = freshDb();
    const personal = savePersonalDashboard(db, "cfo", {
      id: "personal-cfo-pub",
      name: "CFO draft",
      owner: "cfo",
      forkedFrom: "org-close",
      widgets: [
        {
          id: "w-pub",
          type: "kpi",
          title: "revenue",
          query: {
            metric: "revenue",
            grain: "period",
            filters: { scenario: "actual" },
          },
          note: "",
        },
      ],
    });
    const result = await callTool(db, "request_publish_org", {
      userId: "cfo",
      personalId: personal.id,
    });
    expect(result).toMatchObject({ state: "pending" });
    const orgAfter = (await callTool(db, "get_dashboard", { id: "org-close" })) as {
      widgets: { id: string }[];
    };
    expect(orgAfter.widgets).toHaveLength(0);
  });

  it("request_publish_org requires userId", async () => {
    const db = freshDb();
    await expect(
      callTool(db, "request_publish_org", { personalId: "personal-cfo-pub" }),
    ).rejects.toThrow(/userId/i);
  });

  it("upload_close_file rejects when sandbox is off", async () => {
    const db = freshDb();
    await expect(
      callTool(db, "upload_close_file", {
        filename: "pnl.csv",
        bytes: Buffer.from("period,amount\n2026-01,1").toString("base64"),
      }),
    ).rejects.toThrow(/sandbox/i);
  });

  it("upload_close_file stores bytes when sandbox is on", async () => {
    process.env.TRUEFORGE_SANDBOX = "1";
    process.env.DONECORNER_UPLOADS = join(
      mkdtempSync(join(tmpdir(), "dc-up-")),
      "u",
    );
    const db = freshDb();
    const result = (await callTool(db, "upload_close_file", {
      filename: "pnl.csv",
      bytes: Buffer.from("period,amount\n2026-01,1").toString("base64"),
    })) as { storedPath: string; instruction: string };
    expect(result.storedPath).toContain("pnl.csv");
    expect(result.instruction).toMatch(/source=upload/);
  });

  it("inspects an artifact handle and proposes an approval-bound mapping", async () => {
    process.env.DONECORNER_UPLOADS = join(
      mkdtempSync(join(tmpdir(), "dc-handle-")),
      "q",
    );
    const db = freshDb();
    const artifact = createArtifact(db, {
      ownerId: "cfo",
      filename: "lake.csv",
      mediaType: "text/csv",
      bytes: Buffer.from(
        "period,entity_id,account,amount,currency,scenario\n2026-01,co-a,revenue,10,USD,actual",
      ),
    });
    const inspected = (await callTool(db, "inspect_file", {
      artifactId: artifact.id,
      runId: "run-not-persisted",
      userId: "cfo",
    })) as { profile: { rowCount: number }; nextTool: string };
    expect(inspected.profile.rowCount).toBe(1);
    expect(inspected.nextTool).toBe("get_mapping_proposal");

    const proposal = (await callTool(db, "get_mapping_proposal", {
      artifactId: artifact.id,
      runId: "run-demo",
      userId: "cfo",
    })) as { id: string; hash: string; status: string };
    expect(proposal.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(proposal.status).toBe("waiting_approval");
    await expect(
      callTool(db, "apply_mapping", {
        proposalId: proposal.id,
        proposalHash: "stale",
        runId: "run-demo",
        userId: "cfo",
      }),
    ).rejects.toThrow(/changed after review/i);
    await expect(
      callTool(db, "apply_mapping", {
        proposalId: proposal.id,
        proposalHash: proposal.hash,
        runId: "run-demo",
        userId: "cfo",
      }),
    ).rejects.toThrow(/approval/i);
  });

  it("runs a sandbox cleaner and loads upload rows into the cube", async () => {
    process.env.TRUEFORGE_SANDBOX = "1";
    process.env.DONECORNER_UPLOADS = join(
      mkdtempSync(join(tmpdir(), "dc-up2-")),
      "u",
    );
    const db = freshDb();
    const csv = [
      "period,entity,function,account,amount,currency,scenario,source",
      "2026-01,northstar,other,subscription,100,USD,actual,upload",
    ].join("\n");
    const result = (await callTool(db, "upload_close_file", {
      filename: "facts_pnl.csv",
      bytes: Buffer.from(csv).toString("base64"),
    })) as {
      ranIn: string;
      rowsLoaded: number;
      analysis: { pnl: { metric: string } } | null;
    };
    expect(result.ranIn).toBe("child");
    expect(result.rowsLoaded).toBe(1);
    expect(result.analysis?.pnl.metric).toBe("revenue");
    const cube = (await callTool(db, "query_cube", {
      metric: "revenue",
      grain: "period",
      filters: { scenario: "actual" },
    })) as { rows: { key: string; value: number }[] };
    expect(cube.rows.some((r) => r.key === "2026-01" && r.value === 100)).toBe(
      true,
    );
  });

  it("query_sql rejects mutating statements before touching Postgres", async () => {
    const db = freshDb();
    await expect(callTool(db, "query_sql", { sql: "DELETE FROM facts" })).rejects.toThrow(
      /select/i,
    );
  });
});
