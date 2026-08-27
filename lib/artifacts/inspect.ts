import type { DatabaseSync } from "node:sqlite";
import { parseCsv, profileCsv } from "@/lib/artifacts/csv";
import {
  getArtifact,
  readArtifact,
  updateArtifactStatus,
} from "@/lib/artifacts/store";

export function inspectArtifact(
  db: DatabaseSync,
  input: { artifactId: string; ownerId: string },
) {
  const artifact = getArtifact(db, input.artifactId);
  if (!artifact || artifact.ownerId !== input.ownerId) {
    throw new Error("Artifact not found");
  }
  const profile = profileCsv(
    parseCsv(readArtifact(db, input.artifactId, input.ownerId)),
  );
  updateArtifactStatus(db, input.artifactId, "inspected");
  return {
    artifact: { ...artifact, status: "inspected" as const },
    profile,
    sandboxTask: {
      instruction:
        "Use the TrueForge sandbox exec tool to validate column types, missingness, duplicates, period coverage, and outliers from this profile before proposing a mapping.",
      profile,
    },
    nextTool: "get_mapping_proposal",
  };
}
