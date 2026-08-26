import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function uploadsDir(): string {
  return process.env.DONECORNER_UPLOADS ?? ".data/uploads";
}

export function uploadCloseFile(input: {
  filename: string;
  bytes: string;
}): { storedPath: string; instruction: string } {
  if (process.env.TRUEFORGE_SANDBOX !== "1") {
    throw new Error(
      "Uploads require the TrueForge sandbox (TRUEFORGE_SANDBOX=1). Load the sample pack instead.",
    );
  }
  const safe = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const dir = uploadsDir();
  mkdirSync(dir, { recursive: true });
  const storedPath = join(dir, `${Date.now()}-${safe}`);
  writeFileSync(storedPath, Buffer.from(input.bytes, "base64"));
  return {
    storedPath,
    instruction:
      "Normalize this CSV/Excel into facts_pnl, facts_cash, facts_arr, facts_headcount with source=upload. USD only. Do not overwrite sample rows.",
  };
}
