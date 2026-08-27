import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DELETE } from "@/app/api/artifacts/route";
import { createArtifact } from "@/lib/artifacts/store";
import { getDb, migrate } from "@/lib/db/sqlite";

describe("artifact discard route", () => {
  it("requires confirmation before deleting a quarantined upload", async () => {
    const root = mkdtempSync(join(tmpdir(), "dc-art-route-"));
    process.env.DONECORNER_DB = join(root, "test.sqlite");
    process.env.DONECORNER_UPLOADS = join(root, "uploads");
    const db = getDb();
    migrate(db);
    const artifact = createArtifact(db, {
      ownerId: "cfo",
      filename: "close.csv",
      mediaType: "text/csv",
      bytes: Buffer.from("period,amount\n2026-01,1\n"),
    });

    const denied = await DELETE(
      new Request("http://localhost/api/artifacts", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          "x-demo-user": "cfo",
        },
        body: JSON.stringify({ artifactId: artifact.id }),
      }),
    );
    expect(denied.status).toBe(400);

    const allowed = await DELETE(
      new Request("http://localhost/api/artifacts", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          "x-demo-user": "cfo",
        },
        body: JSON.stringify({ artifactId: artifact.id, confirm: true }),
      }),
    );
    expect(allowed.status).toBe(204);
  });
});
