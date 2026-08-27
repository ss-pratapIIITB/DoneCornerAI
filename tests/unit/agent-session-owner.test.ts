import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDb, migrate } from "@/lib/db/sqlite";
import {
  assertAgentSessionOwner,
  bindAgentSession,
} from "@/lib/runs/sessions";

describe("agent session ownership", () => {
  it("prevents another demo identity from claiming a session", () => {
    process.env.DONECORNER_DB = join(
      mkdtempSync(join(tmpdir(), "dc-session-")),
      "test.sqlite",
    );
    const db = getDb();
    migrate(db);
    bindAgentSession(db, "tf-session-1", "cfo");

    expect(() =>
      assertAgentSessionOwner(db, "tf-session-1", "fpna"),
    ).toThrow(/not found/i);
    expect(() => bindAgentSession(db, "tf-session-1", "fpna")).toThrow(
      /not found/i,
    );
  });
});
