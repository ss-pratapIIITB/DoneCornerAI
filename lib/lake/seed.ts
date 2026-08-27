import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/pg/pool";
import { migrateWarehouse } from "@/lib/pg/migrate";
import { ACCOUNTS } from "@/lib/lake/types";

const LAKE_ROOT = process.env.DONECORNER_LAKE ?? "data/lake/raw";

type Node = { id: string; parent: string | null; level: string; name: string };

function id(prefix: string, n: string): string {
  return `${prefix}-${n.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function tree(): Node[] {
  const nodes: Node[] = [{ id: "grp-northstar", parent: null, level: "group", name: "Northstar Group" }];
  const verticals = [
    { name: "Cloud", companies: ["Northstar SaaS", "Northstar Data"] },
    { name: "Energy", companies: ["Northstar Grid", "Northstar Fuels"] },
    { name: "Retail", companies: ["Northstar Stores"] },
  ];
  const categories = ["Platform", "Analytics", "Hardware"];
  const products = ["Core", "Plus", "Edge"];
  for (const v of verticals) {
    const vid = id("vert", v.name);
    nodes.push({ id: vid, parent: "grp-northstar", level: "vertical", name: v.name });
    for (const c of v.companies) {
      const cid = id("co", c);
      nodes.push({ id: cid, parent: vid, level: "company", name: c });
      for (const cat of categories) {
        const catId = id("cat", `${c}-${cat}`);
        nodes.push({ id: catId, parent: cid, level: "category", name: cat });
        for (const p of products) {
          nodes.push({
            id: id("sku", `${c}-${cat}-${p}`),
            parent: catId,
            level: "product",
            name: p,
          });
        }
      }
    }
  }
  return nodes;
}

function periods(): string[] {
  return Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, "0")}`);
}

function amount(account: string, month: number, seed: number): number {
  const base =
    account === "revenue" ? 80_000
    : account === "cogs" ? 28_000
    : account === "sm" ? 18_000
    : account === "rd" ? 12_000
    : account === "ga" ? 8_000
    : account === "capex_tech" ? 6_000
    : account === "ap" ? 14_000
    : account === "net_income" ? 9_000
    : account === "cash_in" ? 82_000
    : 70_000;
  return Math.round(base * (1 + month * 0.03) * (0.85 + (seed % 7) * 0.04));
}

export async function seedLake(): Promise<{
  objects: number;
  entities: number;
  facts: number;
  path: string;
}> {
  await migrateWarehouse();
  const pool = getPool();
  const nodes = tree();
  const months = periods();
  const products = nodes.filter((n) => n.level === "product");

  mkdirSync(join(LAKE_ROOT, "northstar-group"), { recursive: true });
  const csvLines = ["period,entity_id,account,amount,currency,scenario,source"];
  const facts: { entity_id: string; period: string; account: string; amount: number; scenario: string }[] = [];
  products.forEach((p, idx) => {
    for (const [mi, period] of months.entries()) {
      for (const account of ACCOUNTS) {
        const actual = amount(account, mi, idx);
        const budget = Math.round(actual * 0.92);
        facts.push({ entity_id: p.id, period, account, amount: actual, scenario: "actual" });
        facts.push({ entity_id: p.id, period, account, amount: budget, scenario: "budget" });
        csvLines.push(`${period},${p.id},${account},${actual},USD,actual,lake`);
        csvLines.push(`${period},${p.id},${account},${budget},USD,budget,lake`);
      }
    }
  });

  const csvPath = join(LAKE_ROOT, "northstar-group", "facts.csv");
  writeFileSync(csvPath, csvLines.join("\n"));
  const objectId = randomUUID();

  await pool.query("TRUNCATE facts, lake_objects, entities CASCADE");
  for (const n of nodes) {
    await pool.query(
      "INSERT INTO entities (id, parent_id, level, name) VALUES ($1, $2, $3, $4)",
      [n.id, n.parent, n.level, n.name],
    );
  }
  await pool.query(
    "INSERT INTO lake_objects (id, path, dataset, content_type, bytes) VALUES ($1, $2, $3, $4, $5)",
    [objectId, csvPath, "northstar-group", "text/csv", Buffer.byteLength(csvLines.join("\n"))],
  );

  const chunk = 500;
  for (let i = 0; i < facts.length; i += chunk) {
    const slice = facts.slice(i, i + chunk);
    const values: unknown[] = [];
    const placeholders = slice.map((f, j) => {
      const o = j * 6;
      values.push(f.entity_id, f.period, f.account, f.amount, "USD", f.scenario);
      return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},'lake')`;
    });
    await pool.query(
      `INSERT INTO facts (entity_id, period, account, amount, currency, scenario, source) VALUES ${placeholders.join(",")}`,
      values,
    );
  }

  return { objects: 1, entities: nodes.length, facts: facts.length, path: csvPath };
}
