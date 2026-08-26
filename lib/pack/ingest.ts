import type { DatabaseSync } from "node:sqlite";
import { runCloseSubagents, type CloseSubagents } from "@/lib/analysis/subagents";
import { uploadCloseFile } from "@/lib/pack/parse-upload";
import { runSandboxClean, type SandboxCleanResult } from "@/lib/pack/sandbox-clean";

export type CloseIngestResult = {
  storedPath: string;
  instruction: string;
} & SandboxCleanResult & { analysis: CloseSubagents | null };

export async function ingestCloseUpload(
  db: DatabaseSync,
  input: { filename: string; bytes: string },
): Promise<CloseIngestResult> {
  const stored = uploadCloseFile(input);
  const cleaned = await runSandboxClean(db, stored.storedPath);
  const analysis =
    cleaned.rowsLoaded > 0 ? await runCloseSubagents(db) : null;
  return { ...stored, ...cleaned, analysis };
}
