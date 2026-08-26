import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { CubeQuery } from "@/lib/cube/query";
import { assertCanEdit } from "@/lib/identity/errors";

export type WidgetType = "kpi" | "bar" | "line" | "table";

export type Widget = {
  id: string;
  type: WidgetType;
  title: string;
  query: CubeQuery;
  note: string;
};

export type Dashboard = {
  id: string;
  name: string;
  owner: "org" | string;
  forkedFrom: string | null;
  widgets: Widget[];
};

type DashboardRow = {
  id: string;
  name: string;
  owner: string;
  forked_from: string | null;
  widgets_json: string;
};

function rowToDashboard(row: DashboardRow): Dashboard {
  return {
    id: row.id,
    name: row.name,
    owner: row.owner as Dashboard["owner"],
    forkedFrom: row.forked_from,
    widgets: JSON.parse(row.widgets_json) as Widget[],
  };
}

export function getDashboard(db: DatabaseSync, id: string): Dashboard | null {
  const row = db
    .prepare(
      "SELECT id, name, owner, forked_from, widgets_json FROM dashboards WHERE id = ?",
    )
    .get(id) as DashboardRow | undefined;
  return row ? rowToDashboard(row) : null;
}

function upsert(db: DatabaseSync, d: Dashboard): Dashboard {
  db.prepare(
    `INSERT INTO dashboards (id, name, owner, forked_from, widgets_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       owner = excluded.owner,
       forked_from = excluded.forked_from,
       widgets_json = excluded.widgets_json`,
  ).run(d.id, d.name, d.owner, d.forkedFrom, JSON.stringify(d.widgets));
  return d;
}

export function ensureOrgClose(db: DatabaseSync): Dashboard {
  const existing = getDashboard(db, "org-close");
  if (existing) return existing;
  return upsert(db, {
    id: "org-close",
    name: "Northstar Close",
    owner: "org",
    forkedFrom: null,
    widgets: [],
  });
}

export function savePersonalDashboard(
  db: DatabaseSync,
  userId: string,
  d: Dashboard,
): Dashboard {
  assertCanEdit(userId);
  if (d.owner === "org" || d.id === "org-close") {
    throw new Error("Cannot save over org Close; fork first");
  }
  return upsert(db, { ...d, owner: userId });
}

export function forkOrgToPersonal(db: DatabaseSync, userId: string): Dashboard {
  assertCanEdit(userId);
  const org = ensureOrgClose(db);
  const existing = db
    .prepare(
      "SELECT id, name, owner, forked_from, widgets_json FROM dashboards WHERE owner = ? AND forked_from = ?",
    )
    .get(userId, "org-close") as DashboardRow | undefined;
  if (existing) return rowToDashboard(existing);
  return upsert(db, {
    id: `personal-${userId}-${randomUUID().slice(0, 8)}`,
    name: `${org.name} (${userId})`,
    owner: userId,
    forkedFrom: "org-close",
    widgets: structuredClone(org.widgets),
  });
}
