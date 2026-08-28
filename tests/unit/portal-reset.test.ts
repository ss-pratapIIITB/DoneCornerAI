import { describe, expect, it, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { POST } from "@/app/api/portal/reset/route";
import { getDb, migrate } from "@/lib/db/sqlite";
import {
  ensureOrgClose,
  getDashboard,
  replaceOrgClose,
  savePersonalDashboard,
} from "@/lib/dashboards/store";
import { createRun } from "@/lib/runs/ledger";
import { bindAgentSession } from "@/lib/runs/sessions";
import { resetPortalState } from "@/lib/portal/reset";

function freshDb() {
  process.env.DONECORNER_DB = join(
    mkdtempSync(join(tmpdir(), "dc-reset-")),
    "t.sqlite",
  );
  const db = getDb();
  migrate(db);
  return db;
}

describe("portal reset", () => {
  beforeEach(() => {
    freshDb();
  });

  it("clears sessions, runs, and personal boards without touching lake load", () => {
    const db = getDb();
    bindAgentSession(db, "sess-1", "cfo");
    createRun(db, { sessionId: "sess-1", userId: "cfo", kind: "ask" });
    ensureOrgClose(db);
    savePersonalDashboard(db, "cfo", {
      id: "personal-cfo-reset",
      name: "Draft",
      owner: "cfo",
      forkedFrom: "org-close",
      widgets: [
        {
          id: "w1",
          type: "bar",
          title: "pinned",
          query: {
            metric: "revenue",
            grain: "period",
            filters: { scenario: "actual" },
          },
          note: "",
        },
      ],
    });

    const result = resetPortalState(db, "cfo");
    expect(result.cleared).toEqual(
      expect.arrayContaining(["runs", "sessions", "personal_boards"]),
    );
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM agent_runs").get() as { n: number },
    ).toEqual({ n: 0 });
    expect(
      db
        .prepare("SELECT COUNT(*) AS n FROM agent_sessions")
        .get() as { n: number },
    ).toEqual({ n: 0 });
    expect(
      db
        .prepare("SELECT COUNT(*) AS n FROM dashboards WHERE owner = ?")
        .get("cfo") as { n: number },
    ).toEqual({ n: 0 });
    expect(result.truncatedLake).toBe(false);
  });

  it("does not wipe another user's runs or the org Close dashboard", () => {
    const db = getDb();
    bindAgentSession(db, "sess-cfo", "cfo");
    bindAgentSession(db, "sess-fpna", "fpna");
    createRun(db, { sessionId: "sess-cfo", userId: "cfo", kind: "ask" });
    createRun(db, { sessionId: "sess-fpna", userId: "fpna", kind: "ask" });
    replaceOrgClose(db, {
      id: "org-close",
      name: "Northstar Close",
      owner: "org",
      forkedFrom: null,
      widgets: [
        {
          id: "keep-me",
          type: "bar",
          title: "published",
          query: {
            metric: "revenue",
            grain: "period",
            filters: { scenario: "actual" },
          },
          note: "",
        },
      ],
    });

    const result = resetPortalState(db, "cfo");
    expect(result.cleared).not.toContain("org_close_widgets");
    expect(
      db
        .prepare("SELECT COUNT(*) AS n FROM agent_runs WHERE user_id = ?")
        .get("fpna") as { n: number },
    ).toEqual({ n: 1 });
    expect(getDashboard(db, "org-close")?.widgets[0]?.id).toBe("keep-me");
  });

  it("requires confirm from an editor", async () => {
    const viewer = await POST(
      new Request("http://localhost/api/portal/reset", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user": "viewer",
        },
        body: JSON.stringify({ confirm: true }),
      }),
    );
    expect(viewer.status).toBe(403);

    const missing = await POST(
      new Request("http://localhost/api/portal/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(missing.status).toBe(403);

    const spoofed = await POST(
      new Request("http://localhost/api/portal/reset", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user": "admin",
        },
        body: JSON.stringify({ confirm: true }),
      }),
    );
    expect(spoofed.status).toBe(403);

    const editor = await POST(
      new Request("http://localhost/api/portal/reset", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user": "cfo",
        },
        body: JSON.stringify({ confirm: true }),
      }),
    );
    expect(editor.status).toBe(200);
  });
});
