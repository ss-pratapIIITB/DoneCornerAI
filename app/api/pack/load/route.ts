import { getDb, migrate } from "@/lib/db/sqlite";
import { loadSamplePack } from "@/lib/pack/load-sample";
import { ensureOrgClose } from "@/lib/dashboards/store";
import { runCloseSubagents } from "@/lib/analysis/subagents";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  const db = getDb();
  migrate(db);
  const result = loadSamplePack(db);
  ensureOrgClose(db);
  const analysis = await runCloseSubagents(db);
  return Response.json({ ...result, analysis });
}
