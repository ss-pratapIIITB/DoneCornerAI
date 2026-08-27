import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createArtifact } from "@/lib/artifacts/store";
import { getDb, migrate } from "@/lib/db/sqlite";
import {
  createMappingProposal,
  getMappingProposal,
} from "@/lib/mapping/proposals";

function setup() {
  const root = mkdtempSync(join(tmpdir(), "dc-mapping-"));
  process.env.DONECORNER_DB = join(root, "test.sqlite");
  process.env.DONECORNER_UPLOADS = join(root, "quarantine");
  const db = getDb();
  migrate(db);
  return db;
}

describe("mapping proposals", () => {
  it("proposes canonical fields and binds approval to a stable hash", () => {
    const db = setup();
    const artifact = createArtifact(db, {
      ownerId: "cfo",
      filename: "facts.csv",
      mediaType: "text/csv",
      bytes: Buffer.from(
        [
          "month,company,metric,value,currency,scenario",
          "2026-01,Northstar SaaS,revenue,125000,USD,actual",
        ].join("\n"),
      ),
    });

    const first = createMappingProposal(db, {
      artifactId: artifact.id,
      runId: "run-1",
      ownerId: "cfo",
    });
    const stored = getMappingProposal(db, first.id);

    expect(first.mapping).toMatchObject({
      period: "month",
      entity: "company",
      account: "metric",
      amount: "value",
    });
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored?.hash).toBe(first.hash);
    expect(first.preview.rowsAccepted).toBe(1);
    expect(JSON.stringify(first)).not.toContain(process.env.DONECORNER_UPLOADS);
  });

  it("reports missing required finance fields instead of guessing", () => {
    const db = setup();
    const artifact = createArtifact(db, {
      ownerId: "cfo",
      filename: "notes.csv",
      mediaType: "text/csv",
      bytes: Buffer.from("name,comment\nA,hello"),
    });
    const proposal = createMappingProposal(db, {
      artifactId: artifact.id,
      runId: "run-2",
      ownerId: "cfo",
    });
    expect(proposal.confidence).toBe("low");
    expect(proposal.risks.join(" ")).toMatch(/period|amount/i);
  });
});
