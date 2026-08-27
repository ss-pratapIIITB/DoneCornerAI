import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ content: "" }));

vi.mock("@/lib/trueforge/client", () => ({
  trueforgeBaseUrl: () => "http://trueforge.test",
  trueforge: () => ({
    sessions: {
      createTurnStream: async (
        _sessionId: string,
        input: { input: { content: string }[] },
      ) => {
        sent.content = input.input[0]?.content ?? "";
        return (async function* () {
          yield {
            data: {
              type: "turn.done",
              state: { status: "done", output: { content: "Complete" } },
            },
          };
        })();
      },
    },
  }),
}));

import { getDb, migrate } from "@/lib/db/sqlite";
import { createRun, getRun, listRunEvents } from "@/lib/runs/ledger";
import { bindAgentSession } from "@/lib/runs/sessions";
import { runUserTurn } from "@/lib/trueforge/session";

describe("runUserTurn display message", () => {
  it("persists the user-facing message instead of internal prompt context", async () => {
    process.env.DONECORNER_DB = join(
      mkdtempSync(join(tmpdir(), "dc-display-")),
      "test.sqlite",
    );
    const db = getDb();
    migrate(db);
    bindAgentSession(db, "session-display", "cfo");
    const run = createRun(db, {
      sessionId: "session-display",
      userId: "cfo",
      kind: "file_ingest",
    });

    await runUserTurn(
      "session-display",
      "Inspect artifact art_private with internal orchestration instructions",
      {
        runId: run.id,
        kind: "file_ingest",
        userId: "cfo",
        displayMessage: "Inspect finance.csv",
      },
    );

    const message = listRunEvents(db, run.id).find(
      (event) => event.type === "user.message",
    );
    expect(message).toMatchObject({
      summary: "Inspect finance.csv",
      details: { content: "Inspect finance.csv" },
    });
    expect(sent.content).toContain("art_private");
    expect(sent.content).toContain("Inspect finance.csv");
    expect(sent.content).toContain("Immutable product role and safety policy");
    expect(getRun(db, run.id)?.promptVersionId).toMatch(/^prompt_/);
  });
});
