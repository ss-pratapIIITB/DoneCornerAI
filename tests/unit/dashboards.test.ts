import { describe, it, expect, beforeEach } from "vitest";
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
import type { Dashboard, Widget } from "@/lib/dashboards/store";
import { describeSchema } from "@/lib/cube/schema";

function freshDb() {
  process.env.DONECORNER_DB = join(mkdtempSync(join(tmpdir(), "dc-d-")), "t.sqlite");
  const db = getDb();
  migrate(db);
  return db;
}

const sampleWidget: Widget = {
  id: "w1",
  type: "kpi",
  title: "Revenue",
  query: { metric: "revenue", grain: "period", filters: { scenario: "actual" } },
  note: "",
};

describe("dashboards", () => {
  it("forks org close onto a personal board", () => {
    const db = freshDb();
    ensureOrgClose(db);
    const personal = forkOrgToPersonal(db, "cfo");
    expect(personal.owner).toBe("cfo");
    expect(personal.forkedFrom).toBe("org-close");
    expect(getDashboard(db, personal.id)?.id).toBe(personal.id);
  });

  it("saves personal widgets without touching org", () => {
    const db = freshDb();
    ensureOrgClose(db);
    const personal = forkOrgToPersonal(db, "cfo");
    const next: Dashboard = { ...personal, widgets: [sampleWidget] };
    savePersonalDashboard(db, "cfo", next);
    expect(getDashboard(db, personal.id)?.widgets).toHaveLength(1);
    expect(getDashboard(db, "org-close")?.widgets).toHaveLength(0);
  });

  it("forbids viewer saves", () => {
    const db = freshDb();
    ensureOrgClose(db);
    const personal = forkOrgToPersonal(db, "cfo");
    try {
      savePersonalDashboard(db, "viewer", { ...personal, owner: "viewer" });
      expect.unreachable();
    } catch (err) {
      expect(err).toMatchObject({ code: "FORBIDDEN" });
    }
  });
});

describe("describeSchema", () => {
  it("lists facts_pnl and revenue", () => {
    const schema = describeSchema();
    expect(schema.tables.some((t) => t.name === "facts_pnl")).toBe(true);
    expect(schema.metrics.some((m) => m.id === "revenue")).toBe(true);
  });
});
