import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PUT } from "@/app/api/dashboards/route";
import { getDb, migrate } from "@/lib/db/sqlite";
import { ensureOrgClose, forkOrgToPersonal } from "@/lib/dashboards/store";

describe("PUT /api/dashboards", () => {
  beforeEach(() => {
    process.env.DONECORNER_DB = join(
      mkdtempSync(join(tmpdir(), "dc-api-")),
      "t.sqlite",
    );
    const db = getDb();
    migrate(db);
    ensureOrgClose(db);
  });

  it("returns 403 for viewer", async () => {
    const personal = forkOrgToPersonal(getDb(), "cfo");
    const res = await PUT(
      new Request("http://localhost/api/dashboards", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-demo-user": "viewer",
        },
        body: JSON.stringify({ ...personal, owner: "viewer" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "FORBIDDEN" });
  });

  it("forks for an editor and forbids viewer POST", async () => {
    const { POST } = await import("@/app/api/dashboards/route");
    const viewer = await POST(
      new Request("http://localhost/api/dashboards", {
        method: "POST",
        headers: { "x-demo-user": "viewer" },
      }),
    );
    expect(viewer.status).toBe(403);
    const res = await POST(
      new Request("http://localhost/api/dashboards", { method: "POST" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ owner: "cfo", forkedFrom: "org-close" });
  });
});
