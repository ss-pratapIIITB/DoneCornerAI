import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, migrate } from "@/lib/db/sqlite";
import { callTool } from "@/mcp/tools";
import { uploadCloseFile } from "@/lib/pack/parse-upload";

const PNL_HEADER =
  "period,entity,function,account,amount,currency,scenario,source";

function freshDb() {
  process.env.DONECORNER_DB = join(
    mkdtempSync(join(tmpdir(), "dc-clean-")),
    "t.sqlite",
  );
  process.env.DONECORNER_UPLOADS = join(
    mkdtempSync(join(tmpdir(), "dc-clean-up-")),
    "u",
  );
  process.env.TRUEFORGE_SANDBOX = "1";
  const db = getDb();
  migrate(db);
  return db;
}

function b64(csv: string): string {
  return Buffer.from(csv).toString("base64");
}

async function upload(db: ReturnType<typeof getDb>, filename: string, csv: string) {
  return callTool(db, "upload_close_file", {
    filename,
    bytes: b64(csv),
  });
}

describe("sandbox cleaner", () => {
  beforeEach(() => {
    process.env.TRUEFORGE_SANDBOX = "1";
  });

  it("loads quoted CSV fields that contain commas", async () => {
    const db = freshDb();
    const csv = [
      PNL_HEADER,
      '2026-01,"northstar, inc",other,subscription,100,USD,actual,upload',
    ].join("\n");
    const result = (await upload(db, "facts_pnl.csv", csv)) as {
      rowsLoaded: number;
    };
    expect(result.rowsLoaded).toBe(1);
    const cube = (await callTool(db, "query_cube", {
      metric: "revenue",
      grain: "period",
      filters: { scenario: "actual" },
    })) as { rows: { key: string; value: number }[] };
    expect(cube.rows.some((r) => r.key === "2026-01" && r.value === 100)).toBe(
      true,
    );
  });

  it("does not load non-USD amounts as USD", async () => {
    const db = freshDb();
    const csv = [
      PNL_HEADER,
      "2026-01,northstar,other,subscription,100,EUR,actual,upload",
    ].join("\n");
    const result = (await upload(db, "facts_pnl.csv", csv)) as {
      rowsLoaded: number;
    };
    expect(result.rowsLoaded).toBe(0);
    const cube = (await callTool(db, "query_cube", {
      metric: "revenue",
      grain: "period",
      filters: { scenario: "actual" },
    })) as { rows: { value: number }[] };
    expect(cube.rows.reduce((s, r) => s + r.value, 0)).toBe(0);
  });

  it("keeps the prior upload when a later file is malformed", async () => {
    const db = freshDb();
    const good = [
      PNL_HEADER,
      "2026-01,northstar,other,subscription,100,USD,actual,upload",
    ].join("\n");
    await upload(db, "facts_pnl.csv", good);

    const bad = [PNL_HEADER, "too,few,cols"].join("\n");
    await expect(upload(db, "facts_pnl.csv", bad)).rejects.toThrow();

    const cube = (await callTool(db, "query_cube", {
      metric: "revenue",
      grain: "period",
      filters: { scenario: "actual" },
    })) as { rows: { key: string; value: number }[] };
    expect(cube.rows.some((r) => r.key === "2026-01" && r.value === 100)).toBe(
      true,
    );
  });

  it("rejects Excel filenames before cleaning", () => {
    process.env.TRUEFORGE_SANDBOX = "1";
    process.env.DONECORNER_UPLOADS = join(
      mkdtempSync(join(tmpdir(), "dc-xls-")),
      "u",
    );
    expect(() =>
      uploadCloseFile({
        filename: "facts.xlsx",
        bytes: b64([PNL_HEADER, "2026-01,northstar,other,subscription,1,USD,actual,upload"].join("\n")),
      }),
    ).toThrow(/csv/i);
  });
});
