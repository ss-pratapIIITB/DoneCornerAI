import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, migrate } from "@/lib/db/sqlite";
import {
  ensureOrgClose,
  forkOrgToPersonal,
  getDashboard,
  savePersonalDashboard,
} from "@/lib/dashboards/store";
import type { Widget } from "@/lib/dashboards/store";
import { requestPublishOrg, resolvePublish } from "@/lib/dashboards/publish";

function freshDb() {
  process.env.DONECORNER_DB = join(mkdtempSync(join(tmpdir(), "dc-p-")), "t.sqlite");
  const db = getDb();
  migrate(db);
  return db;
}

const widget: Widget = {
  id: "w1",
  type: "bar",
  title: "OpEx",
  query: { metric: "opex", grain: "period", filters: { scenario: "actual" } },
  note: "S&M heavy",
};

describe("publish", () => {
  it("leaves org unchanged when denied", () => {
    const db = freshDb();
    ensureOrgClose(db);
    const personal = forkOrgToPersonal(db, "cfo");
    savePersonalDashboard(db, "cfo", { ...personal, widgets: [widget] });
    const req = requestPublishOrg(db, "cfo", personal.id);
    expect(req.state).toBe("pending");
    const resolved = resolvePublish(db, req.id, "denied", "cfo");
    expect(resolved.state).toBe("denied");
    expect(getDashboard(db, "org-close")?.widgets).toHaveLength(0);
  });

  it("copies personal widgets onto org close when approved", () => {
    const db = freshDb();
    ensureOrgClose(db);
    const personal = forkOrgToPersonal(db, "fpna");
    savePersonalDashboard(db, "fpna", {
      ...personal,
      layout: { columns: 12, density: "standard" },
      widgets: [widget],
    });
    const req = requestPublishOrg(db, "fpna", personal.id);
    resolvePublish(db, req.id, "approved", "fpna");
    expect(getDashboard(db, "org-close")?.widgets).toEqual([widget]);
    expect(getDashboard(db, "org-close")?.layout).toEqual({
      columns: 12,
      density: "standard",
    });
    expect(getDashboard(db, personal.id)?.widgets).toEqual([widget]);
    const forked = forkOrgToPersonal(db, "cfo");
    expect(forked.layout).toEqual({ columns: 12, density: "standard" });
  });

  it("forbids viewer publish", () => {
    const db = freshDb();
    ensureOrgClose(db);
    const personal = forkOrgToPersonal(db, "cfo");
    try {
      requestPublishOrg(db, "viewer", personal.id);
      expect.unreachable();
    } catch (err) {
      expect(err).toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("forbids viewer from resolving a pending publish", () => {
    const db = freshDb();
    ensureOrgClose(db);
    const personal = forkOrgToPersonal(db, "cfo");
    const req = requestPublishOrg(db, "cfo", personal.id);
    try {
      resolvePublish(db, req.id, "approved", "viewer");
      expect.unreachable();
    } catch (err) {
      expect(err).toMatchObject({ code: "FORBIDDEN" });
    }
    expect(getDashboard(db, "org-close")?.widgets).toHaveLength(0);
  });
});
