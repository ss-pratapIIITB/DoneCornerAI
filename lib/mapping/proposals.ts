import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { parseCsv, profileCsv, type CsvProfile } from "@/lib/artifacts/csv";
import {
  readArtifact,
  updateArtifactStatus,
} from "@/lib/artifacts/store";

export type MappingFields = {
  period: string | null;
  entity: string | null;
  account: string | null;
  amount: string | null;
  currency: string | null;
  scenario: string | null;
  source: string | null;
  function: string | null;
};

export type MappingProposal = {
  id: string;
  runId: string;
  artifactId: string;
  mapping: MappingFields;
  defaults: { currency: "USD"; scenario: "actual"; source: "upload" };
  transforms: string[];
  confidence: "high" | "medium" | "low";
  risks: string[];
  preview: CsvProfile & { rowsAccepted: number; rowsRejected: number };
  hash: string;
  status: "draft" | "waiting_approval" | "applied" | "failed";
  createdAt: string;
  updatedAt: string;
};

type ProposalRow = {
  proposal_json: string;
  proposal_hash: string;
  status: MappingProposal["status"];
  created_at: string;
  updated_at: string;
};

const ALIASES: Record<keyof MappingFields, string[]> = {
  period: ["period", "month", "date", "fiscalperiod"],
  entity: ["entityid", "entity", "company", "businessunit", "product"],
  account: ["account", "metric", "lineitem", "glaccount", "category"],
  amount: ["amount", "value", "actual", "balance", "total"],
  currency: ["currency", "ccy"],
  scenario: ["scenario", "version"],
  source: ["source"],
  function: ["function", "department", "costcenter"],
};

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function inferMapping(headers: string[]): MappingFields {
  const available = new Map(headers.map((header) => [normalized(header), header]));
  return Object.fromEntries(
    Object.entries(ALIASES).map(([field, aliases]) => [
      field,
      aliases.map((alias) => available.get(alias)).find(Boolean) ?? null,
    ]),
  ) as MappingFields;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function proposalHash(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

export function createMappingProposal(
  db: DatabaseSync,
  input: { artifactId: string; runId: string; ownerId: string },
): MappingProposal {
  const csv = parseCsv(readArtifact(db, input.artifactId, input.ownerId));
  const profile = profileCsv(csv);
  const mapping = inferMapping(csv.headers);
  const required = ["period", "entity", "account", "amount"] as const;
  const missing = required.filter((field) => !mapping[field]);
  const rowsAccepted = csv.rows.filter((row) => {
    if (missing.length) return false;
    return (
      Boolean(row[mapping.period!]) &&
      Boolean(row[mapping.entity!]) &&
      Boolean(row[mapping.account!]) &&
      Number.isFinite(Number(row[mapping.amount!]))
    );
  }).length;
  const risks = missing.map((field) => `Missing required ${field} column.`);
  if (!mapping.currency) risks.push("Currency is absent; USD will be used.");
  if (!mapping.scenario) risks.push("Scenario is absent; actual will be used.");
  if (rowsAccepted < csv.rows.length) {
    risks.push(`${csv.rows.length - rowsAccepted} row(s) fail basic validation.`);
  }
  const confidence: MappingProposal["confidence"] =
    missing.length > 0
      ? "low"
      : rowsAccepted === csv.rows.length
        ? "high"
        : "medium";
  const now = new Date().toISOString();
  const id = `map_${randomUUID()}`;
  const core = {
    artifactId: input.artifactId,
    mapping,
    defaults: { currency: "USD" as const, scenario: "actual" as const, source: "upload" as const },
    transforms: [
      "Normalize account aliases to the lake account catalog.",
      "Create an upload hierarchy for entity names not yet in the lake.",
      "Reject non-numeric amounts and unsupported scenarios.",
    ],
    confidence,
    risks,
    preview: {
      ...profile,
      rowsAccepted,
      rowsRejected: csv.rows.length - rowsAccepted,
    },
  };
  const proposal: MappingProposal = {
    id,
    runId: input.runId,
    ...core,
    hash: proposalHash(core),
    status: "waiting_approval",
    createdAt: now,
    updatedAt: now,
  };
  db.prepare(
    `INSERT INTO mapping_proposals
      (id, run_id, artifact_id, proposal_json, proposal_hash, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    proposal.id,
    proposal.runId,
    proposal.artifactId,
    JSON.stringify(proposal),
    proposal.hash,
    proposal.status,
    now,
    now,
  );
  updateArtifactStatus(db, input.artifactId, "inspected");
  return proposal;
}

export function getMappingProposal(
  db: DatabaseSync,
  proposalId: string,
): MappingProposal | null {
  const row = db
    .prepare("SELECT * FROM mapping_proposals WHERE id = ?")
    .get(proposalId) as ProposalRow | undefined;
  if (!row) return null;
  return {
    ...(JSON.parse(row.proposal_json) as MappingProposal),
    hash: row.proposal_hash,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function markMappingApplied(
  db: DatabaseSync,
  proposalId: string,
): MappingProposal {
  const updatedAt = new Date().toISOString();
  db.prepare(
    "UPDATE mapping_proposals SET status = 'applied', applied_at = ?, updated_at = ? WHERE id = ?",
  ).run(updatedAt, updatedAt, proposalId);
  const proposal = getMappingProposal(db, proposalId);
  if (!proposal) throw new Error("Mapping proposal not found");
  return proposal;
}
