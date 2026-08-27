import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDb, migrate } from "@/lib/db/sqlite";
import {
  createArtifact,
  getArtifact,
  readArtifact,
} from "@/lib/artifacts/store";

function setup() {
  const root = mkdtempSync(join(tmpdir(), "dc-artifacts-"));
  process.env.DONECORNER_DB = join(root, "test.sqlite");
  process.env.DONECORNER_UPLOADS = join(root, "quarantine");
  const db = getDb();
  migrate(db);
  return { db, root };
}

describe("artifact quarantine", () => {
  it("stores bytes behind an opaque handle and checksum", () => {
    const { db } = setup();
    const bytes = Buffer.from("period,amount\n2026-01,42");
    const artifact = createArtifact(db, {
      ownerId: "cfo",
      filename: "../../finance close.csv",
      mediaType: "text/csv",
      bytes,
    });

    expect(artifact.id).toMatch(/^art_/);
    expect(artifact.filename).toBe("finance_close.csv");
    expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(artifact)).not.toContain(process.env.DONECORNER_UPLOADS);
    expect(readArtifact(db, artifact.id, "cfo").equals(bytes)).toBe(true);
    expect(getArtifact(db, artifact.id)?.status).toBe("quarantined");
  });

  it("rejects unsupported types before writing", () => {
    const { db } = setup();
    expect(() =>
      createArtifact(db, {
        ownerId: "cfo",
        filename: "malware.exe",
        mediaType: "application/octet-stream",
        bytes: Buffer.from("MZ"),
      }),
    ).toThrow(/CSV/i);
  });

  it("rejects quarantined bytes changed after review", () => {
    const { db, root } = setup();
    const artifact = createArtifact(db, {
      ownerId: "cfo",
      filename: "finance.csv",
      mediaType: "text/csv",
      bytes: Buffer.from("period,amount\n2026-01,42"),
    });
    const quarantine = join(root, "quarantine");
    writeFileSync(
      join(quarantine, readdirSync(quarantine)[0]!),
      "period,amount\n2026-01,999999",
    );

    expect(() => readArtifact(db, artifact.id, "cfo")).toThrow(/checksum/i);
  });
});
