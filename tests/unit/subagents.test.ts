import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, migrate } from "@/lib/db/sqlite";
import { loadSamplePack } from "@/lib/pack/load-sample";
import { runCloseSubagents } from "@/lib/analysis/subagents";

describe("close subagents", () => {
  beforeAll(() => {
    process.env.DONECORNER_DB = join(
      mkdtempSync(join(tmpdir(), "dc-sa-")),
      "t.sqlite",
    );
    const db = getDb();
    migrate(db);
    loadSamplePack(db);
  });

  it("runs P&L, cash, and growth slices in parallel", async () => {
    const result = await runCloseSubagents(getDb());
    expect(result.pnl.metric).toBe("revenue");
    expect(result.pnl.rows.length).toBeGreaterThan(0);
    expect(result.cash.metric).toBe("net_burn");
    expect(result.cash.rows.length).toBeGreaterThan(0);
    expect(result.growth.metric).toBe("arr");
    expect(result.growth.rows.length).toBeGreaterThan(0);
  });
});
