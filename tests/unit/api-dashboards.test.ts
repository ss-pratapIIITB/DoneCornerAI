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
});
