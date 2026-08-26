import { createInterface } from "node:readline";
import { getDb, migrate } from "../lib/db/sqlite";
import { callTool } from "./tools";

type Rpc = { id: string | number; name: string; args?: Record<string, unknown> };

async function handle(line: string): Promise<void> {
  const msg = JSON.parse(line) as Rpc;
  const db = getDb();
  migrate(db);
  try {
    const result = await callTool(db, msg.name, msg.args ?? {});
    process.stdout.write(`${JSON.stringify({ id: msg.id, result })}\n`);
  } catch (err) {
    const error = err instanceof Error ? err.message : "Tool failed";
    process.stdout.write(`${JSON.stringify({ id: msg.id, error })}\n`);
  }
}

export function startStdio(): void {
  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    void handle(line);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startStdio();
}
