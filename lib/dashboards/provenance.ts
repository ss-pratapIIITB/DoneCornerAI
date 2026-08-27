import type { DatabaseSync } from "node:sqlite";
import { getArtifact } from "@/lib/artifacts/store";
import type { DashboardSpec } from "@/lib/dashboards/dsl";
import type { DashboardValidationFinding } from "@/lib/dashboards/validator";
import { getRun, listRunEvents } from "@/lib/runs/ledger";

function unbound(path: string, message: string): DashboardValidationFinding {
  return {
    code: "unbound_provenance",
    path,
    message,
    severity: "error",
  };
}

export function validateDashboardProvenance(
  db: DatabaseSync,
  spec: DashboardSpec,
  options: { ownerId?: string } = {},
): DashboardValidationFinding[] {
  const findings: DashboardValidationFinding[] = [];

  spec.widgets.forEach((widget, index) => {
    const path = `dashboard.widgets[${index}].provenance`;
    const run = getRun(db, widget.provenance.runId);
    if (!run) {
      findings.push(unbound(path, "Provenance run is not in the ledger."));
      return;
    }
    if (options.ownerId && run.userId !== options.ownerId) {
      findings.push(
        unbound(path, "Provenance run is owned by another user."),
      );
      return;
    }
    const eventIds = new Set(listRunEvents(db, run.id).map((event) => event.id));
    for (const eventId of widget.provenance.eventIds) {
      if (!eventIds.has(eventId)) {
        findings.push(
          unbound(`${path}.eventIds`, "Provenance event is not part of that run."),
        );
        return;
      }
    }
    for (const artifactId of widget.provenance.artifactIds) {
      const artifact = getArtifact(db, artifactId);
      if (!artifact) {
        findings.push(
          unbound(`${path}.artifactIds`, "Provenance artifact does not exist."),
        );
        return;
      }
      if (options.ownerId && artifact.ownerId !== options.ownerId) {
        findings.push(
          unbound(
            `${path}.artifactIds`,
            "Provenance artifact is owned by another user.",
          ),
        );
      }
    }
  });

  return findings;
}
