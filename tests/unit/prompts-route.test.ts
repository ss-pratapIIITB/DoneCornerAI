import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/prompts/route";
import { getDb, migrate } from "@/lib/db/sqlite";
import { DEFAULT_GUIDANCE, listPromptVersions } from "@/lib/prompts/assembly";

function setup() {
  process.env.DONECORNER_DB = join(
    mkdtempSync(join(tmpdir(), "dc-prompts-route-")),
    "test.sqlite",
  );
  const db = getDb();
  migrate(db);
  return db;
}

describe("prompts route", () => {
  it("seeds default guidance on GET and versions saves", async () => {
    const db = setup();
    const first = await GET(
      new Request("http://localhost/api/prompts", {
        headers: { "x-demo-user": "cfo" },
      }),
    );
    const seeded = (await first.json()) as {
      guidance: { objective: string };
      assembled: { fullText: string };
      model: string;
    };
    expect(seeded.guidance.objective).toBe(DEFAULT_GUIDANCE.objective);
    expect(seeded.assembled.fullText).toContain("Immutable product role");
    expect(seeded.model).toBeTruthy();

    const saved = await POST(
      new Request("http://localhost/api/prompts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user": "cfo",
        },
        body: JSON.stringify({
          action: "save",
          objective: "Explain cash runway",
          businessContext: "Northstar",
          materiality: "5%",
          dashboardPreferences: "Cash first",
        }),
      }),
    );
    expect(saved.status).toBe(200);
    expect(listPromptVersions(db, "cfo")).toHaveLength(2);
  });

  it("rejects viewer edits", async () => {
    setup();
    const response = await POST(
      new Request("http://localhost/api/prompts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user": "viewer",
        },
        body: JSON.stringify({
          action: "save",
          objective: "x",
          businessContext: "y",
          materiality: "z",
          dashboardPreferences: "w",
        }),
      }),
    );
    expect(response.status).toBe(403);
  });
});
