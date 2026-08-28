import { describe, expect, it } from "vitest";
import { mergeTurnIntoRun } from "@/lib/runs/turn-merge";
import type { AgentRun } from "@/lib/runs/types";

const run: AgentRun = {
  id: "run-1",
  sessionId: "sess",
  userId: "cfo",
  kind: "question",
  status: "running",
  currentStage: "starting",
  promptVersionId: null,
  createdAt: "2026-08-28T03:56:29.000Z",
  updatedAt: "2026-08-28T03:56:29.000Z",
};

describe("mergeTurnIntoRun", () => {
  it("copies a finished turn onto the run so the rail is not stuck Running", () => {
    expect(mergeTurnIntoRun(run, "done")).toMatchObject({
      id: "run-1",
      status: "done",
      currentStage: "complete",
    });
  });

  it("keeps waiting_approval so Approve stays visible", () => {
    expect(mergeTurnIntoRun(run, "waiting_approval").status).toBe(
      "waiting_approval",
    );
  });
});
