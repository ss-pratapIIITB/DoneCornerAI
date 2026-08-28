import type { AgentRun, RunStatus } from "@/lib/runs/types";

export function runStatusFromTurn(status: string): RunStatus {
  if (status === "waiting_approval") return "waiting_approval";
  if (status === "running" || status === "queued") return status;
  if (status === "error" || status === "cancelled") return status;
  return "done";
}

export function mergeTurnIntoRun(run: AgentRun, status: string): AgentRun {
  const next = runStatusFromTurn(status);
  return {
    ...run,
    status: next,
    currentStage:
      next === "waiting_approval"
        ? "approval"
        : next === "done"
          ? "complete"
          : next === "error"
            ? "error"
            : run.currentStage,
  };
}
