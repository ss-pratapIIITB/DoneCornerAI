import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";

export type ArtifactStatus =
  | "quarantined"
  | "inspected"
  | "mapped"
  | "loaded"
  | "rejected";

export type FileArtifact = {
  id: string;
  ownerId: string;
  filename: string;
  mediaType: string;
  bytes: number;
  sha256: string;
  status: ArtifactStatus;
  createdAt: string;
};

type ArtifactRow = {
  id: string;
  owner_id: string;
  filename: string;
  media_type: string;
  bytes: number;
  sha256: string;
  status: ArtifactStatus;
  storage_key: string;
  created_at: string;
};

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function artifactRoot(): string {
  return process.env.DONECORNER_UPLOADS ?? ".data/uploads";
}

function safeFilename(filename: string): string {
  return (
    basename(filename)
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/^_+/, "") || "upload.csv"
  );
}

function publicArtifact(row: ArtifactRow): FileArtifact {
  return {
    id: row.id,
    ownerId: row.owner_id,
    filename: row.filename,
    mediaType: row.media_type,
    bytes: Number(row.bytes),
    sha256: row.sha256,
    status: row.status,
    createdAt: row.created_at,
  };
}

function artifactRow(db: DatabaseSync, artifactId: string): ArtifactRow | null {
  return (
    (db
      .prepare("SELECT * FROM file_artifacts WHERE id = ?")
      .get(artifactId) as ArtifactRow | undefined) ?? null
  );
}

export function createArtifact(
  db: DatabaseSync,
  input: {
    ownerId: string;
    filename: string;
    mediaType: string;
    bytes: Buffer;
  },
): FileArtifact {
  const filename = safeFilename(input.filename);
  if (!filename.toLowerCase().endsWith(".csv")) {
    throw new Error("Only CSV uploads are supported in this build.");
  }
  if (input.bytes.length === 0 || input.bytes.length > MAX_UPLOAD_BYTES) {
    throw new Error("CSV must be between 1 byte and 25 MB.");
  }
  const id = `art_${randomUUID()}`;
  const storageKey = `${id}-${filename}`;
  const root = resolve(artifactRoot());
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, storageKey), input.bytes, { mode: 0o600 });
  const createdAt = new Date().toISOString();
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const mediaType = input.mediaType || "text/csv";
  db.prepare(
    `INSERT INTO file_artifacts
      (id, owner_id, filename, media_type, bytes, sha256, status, storage_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'quarantined', ?, ?)`,
  ).run(
    id,
    input.ownerId,
    filename,
    mediaType,
    input.bytes.length,
    sha256,
    storageKey,
    createdAt,
  );
  return {
    id,
    ownerId: input.ownerId,
    filename,
    mediaType,
    bytes: input.bytes.length,
    sha256,
    status: "quarantined",
    createdAt,
  };
}

export function getArtifact(
  db: DatabaseSync,
  artifactId: string,
): FileArtifact | null {
  const row = artifactRow(db, artifactId);
  return row ? publicArtifact(row) : null;
}

export function readArtifact(
  db: DatabaseSync,
  artifactId: string,
  ownerId?: string,
): Buffer {
  const row = artifactRow(db, artifactId);
  if (!row || (ownerId && row.owner_id !== ownerId)) {
    throw new Error("Artifact not found");
  }
  const root = resolve(artifactRoot());
  const path = resolve(root, row.storage_key);
  if (!path.startsWith(`${root}/`)) throw new Error("Invalid artifact storage key");
  return readFileSync(path);
}

export function updateArtifactStatus(
  db: DatabaseSync,
  artifactId: string,
  status: ArtifactStatus,
): FileArtifact {
  db.prepare("UPDATE file_artifacts SET status = ? WHERE id = ?").run(
    status,
    artifactId,
  );
  const artifact = getArtifact(db, artifactId);
  if (!artifact) throw new Error("Artifact not found");
  return artifact;
}
