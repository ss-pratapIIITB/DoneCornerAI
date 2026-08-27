import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { PoolClient } from "pg";
import { parseCsv } from "@/lib/artifacts/csv";
import {
  readArtifact,
  updateArtifactStatus,
} from "@/lib/artifacts/store";
import { migrateWarehouse } from "@/lib/pg/migrate";
import { getPool } from "@/lib/pg/pool";
import {
  getMappingProposal,
  markMappingApplied,
  type MappingProposal,
} from "@/lib/mapping/proposals";

const ACCOUNT_ALIASES: Record<string, string> = {
  revenue: "revenue",
  sales: "revenue",
  subscription: "revenue",
  subscriptionrevenue: "revenue",
  cogs: "cogs",
  costofrevenue: "cogs",
  costofgoodssold: "cogs",
  sm: "sm",
  salesmarketing: "sm",
  marketing: "sm",
  rd: "rd",
  researchdevelopment: "rd",
  engineering: "rd",
  ga: "ga",
  generaladministrative: "ga",
  capextech: "capex_tech",
  ap: "ap",
  accountspayable: "ap",
  netincome: "net_income",
  cashin: "cash_in",
  cashout: "cash_out",
};

function key(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "entity"
  );
}

function value(
  row: Record<string, string>,
  column: string | null,
  fallback: string,
): string {
  return column ? row[column]?.trim() || fallback : fallback;
}

async function ensureUploadEntity(
  client: PoolClient,
  rawEntity: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(rawEntity);
  if (cached) return cached;
  const existing = await client.query<{ id: string }>(
    "SELECT id FROM entities WHERE id = $1 LIMIT 1",
    [rawEntity],
  );
  if (existing.rows[0]) {
    cache.set(rawEntity, existing.rows[0].id);
    return existing.rows[0].id;
  }

  const entitySlug = slug(rawEntity);
  const nodes = [
    ["grp-upload", null, "group", "Uploaded data"],
    ["vert-upload", "grp-upload", "vertical", "Uploaded"],
    [`co-upload-${entitySlug}`, "vert-upload", "company", rawEntity],
    [
      `cat-upload-${entitySlug}`,
      `co-upload-${entitySlug}`,
      "category",
      "General",
    ],
    [
      `sku-upload-${entitySlug}`,
      `cat-upload-${entitySlug}`,
      "product",
      "General",
    ],
  ] as const;
  for (const [id, parent, level, name] of nodes) {
    await client.query(
      `INSERT INTO entities (id, parent_id, level, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [id, parent, level, name],
    );
  }
  const productId = `sku-upload-${entitySlug}`;
  cache.set(rawEntity, productId);
  return productId;
}

function accountFor(
  row: Record<string, string>,
  proposal: MappingProposal,
): string | null {
  const account = ACCOUNT_ALIASES[
    key(value(row, proposal.mapping.account, ""))
  ];
  if (account) return account;
  return ACCOUNT_ALIASES[
    key(value(row, proposal.mapping.function, ""))
  ] ?? null;
}

export async function applyMapping(
  db: DatabaseSync,
  input: {
    proposalId: string;
    proposalHash: string;
    ownerId: string;
  },
): Promise<{
  proposalId: string;
  artifactId: string;
  rowsWritten: number;
  rowsRejected: number;
  idempotent: boolean;
}> {
  const proposal = getMappingProposal(db, input.proposalId);
  if (!proposal) throw new Error("Mapping proposal not found");
  if (proposal.hash !== input.proposalHash) {
    throw new Error("Mapping proposal changed after review; request approval again.");
  }
  if (proposal.confidence === "low") {
    throw new Error("Mapping is incomplete and cannot be applied.");
  }

  const csv = parseCsv(readArtifact(db, proposal.artifactId, input.ownerId));
  await migrateWarehouse();
  const client = await getPool().connect();
  const idempotencyKey = `${proposal.id}:${proposal.hash}`;
  try {
    await client.query("BEGIN");
    const prior = await client.query<{ rows_written: number }>(
      "SELECT rows_written FROM mapping_applications WHERE idempotency_key = $1",
      [idempotencyKey],
    );
    if (prior.rows[0]) {
      await client.query("COMMIT");
      return {
        proposalId: proposal.id,
        artifactId: proposal.artifactId,
        rowsWritten: Number(prior.rows[0].rows_written),
        rowsRejected: proposal.preview.rowsRejected,
        idempotent: true,
      };
    }

    await client.query(
      `INSERT INTO lake_objects (id, path, dataset, content_type, bytes)
       VALUES ($1, $2, $3, 'text/csv', $4)
       ON CONFLICT (path) DO NOTHING`,
      [
        randomUUID(),
        `artifact://${proposal.artifactId}`,
        "uploaded-finance",
        Buffer.byteLength(JSON.stringify(csv.rows)),
      ],
    );

    let rowsWritten = 0;
    let rowsRejected = 0;
    const entityCache = new Map<string, string>();
    for (const row of csv.rows) {
      const rawEntity = value(row, proposal.mapping.entity, "");
      const period = value(row, proposal.mapping.period, "");
      const account = accountFor(row, proposal);
      const amount = Number(
        value(row, proposal.mapping.amount, "").replace(/[$,\s]/g, ""),
      );
      const scenario = value(
        row,
        proposal.mapping.scenario,
        proposal.defaults.scenario,
      ).toLowerCase();
      const currency = value(
        row,
        proposal.mapping.currency,
        proposal.defaults.currency,
      ).toUpperCase();
      if (
        !rawEntity ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(period) ||
        !account ||
        !Number.isFinite(amount) ||
        !["actual", "budget"].includes(scenario) ||
        currency !== "USD"
      ) {
        rowsRejected += 1;
        continue;
      }
      const entityId = await ensureUploadEntity(client, rawEntity, entityCache);
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO facts
          (entity_id, period, account, amount, currency, scenario, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'upload')
         RETURNING id`,
        [entityId, period, account, amount, currency, scenario],
      );
      await client.query(
        `INSERT INTO fact_lineage
          (fact_id, artifact_id, run_id, proposal_id, proposal_hash, transform_json)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          inserted.rows[0]!.id,
          proposal.artifactId,
          proposal.runId,
          proposal.id,
          proposal.hash,
          JSON.stringify({
            mapping: proposal.mapping,
            accountAlias: account,
            sourceRow: rowsWritten + rowsRejected + 2,
          }),
        ],
      );
      rowsWritten += 1;
    }
    if (rowsWritten === 0) {
      throw new Error("No rows passed canonical lake validation.");
    }
    await client.query(
      `INSERT INTO mapping_applications
        (idempotency_key, proposal_hash, approval_ref, run_id, rows_written)
       VALUES ($1, $2, 'trueforge-tool-approval', $3, $4)`,
      [idempotencyKey, proposal.hash, proposal.runId, rowsWritten],
    );
    await client.query("COMMIT");
    markMappingApplied(db, proposal.id);
    updateArtifactStatus(db, proposal.artifactId, "loaded");
    return {
      proposalId: proposal.id,
      artifactId: proposal.artifactId,
      rowsWritten,
      rowsRejected,
      idempotent: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
