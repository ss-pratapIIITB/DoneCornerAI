import type {
  DashboardProvenance,
} from "@/lib/dashboards/dsl";
import {
  ACCOUNTS,
  ENTITY_LEVELS,
  type LakeFilters,
} from "@/lib/lake/types";

export const MAX_IDENTIFIER_LENGTH = 128;
export const MAX_FILTER_STRING_LENGTH = 256;
export const MAX_FILTER_VALUES = 100;

export type GuardIssue = {
  path: string;
  message: string;
};

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeBoundedString(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength
    ? normalized
    : null;
}

export function normalizeIdentifier(value: unknown): string | null {
  const normalized = normalizeBoundedString(value, MAX_IDENTIFIER_LENGTH);
  if (!normalized || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeStringArray(
  value: unknown,
  path: string,
  allowed?: readonly string[],
): { value?: string[]; issues: GuardIssue[] } {
  if (
    !Array.isArray(value) ||
    value.length > MAX_FILTER_VALUES
  ) {
    return {
      issues: [
        {
          path,
          message: `Expected an array with at most ${MAX_FILTER_VALUES} values.`,
        },
      ],
    };
  }
  const normalized = value.map((item) =>
    normalizeBoundedString(item, MAX_FILTER_STRING_LENGTH),
  );
  if (
    normalized.some((item) => item === null) ||
    (allowed &&
      normalized.some(
        (item) => item !== null && !allowed.includes(item),
      ))
  ) {
    return {
      issues: [
        {
          path,
          message: "Filter values must be bounded non-empty supported strings.",
        },
      ],
    };
  }
  return { value: normalized as string[], issues: [] };
}

export function normalizeLakeFilters(
  input: unknown,
  path: string,
): { value?: LakeFilters; issues: GuardIssue[] } {
  if (!isRecord(input)) {
    return {
      issues: [{ path, message: "Lake query filters must be an object." }],
    };
  }
  const supported = new Set([
    ...ENTITY_LEVELS,
    "period",
    "account",
    "scenario",
  ]);
  const unknownField = Object.keys(input).find((key) => !supported.has(key));
  if (unknownField) {
    return {
      issues: [
        {
          path: `${path}.${unknownField}`,
          message: `Filter field ${unknownField} is unavailable.`,
        },
      ],
    };
  }

  const value: LakeFilters = {};
  const issues: GuardIssue[] = [];
  for (const level of ENTITY_LEVELS) {
    if (input[level] === undefined) continue;
    const normalized = normalizeBoundedString(
      input[level],
      MAX_FILTER_STRING_LENGTH,
    );
    if (!normalized) {
      issues.push({
        path: `${path}.${level}`,
        message: `${level} must be a bounded non-empty string.`,
      });
    } else {
      value[level] = normalized;
    }
  }

  if (input.period !== undefined) {
    const period = normalizeStringArray(input.period, `${path}.period`);
    issues.push(...period.issues);
    if (period.value) value.period = period.value;
  }
  if (input.account !== undefined) {
    const account = normalizeStringArray(
      input.account,
      `${path}.account`,
      ACCOUNTS,
    );
    issues.push(...account.issues);
    if (account.value) value.account = account.value;
  }
  if (input.scenario !== undefined) {
    if (input.scenario !== "actual" && input.scenario !== "budget") {
      issues.push({
        path: `${path}.scenario`,
        message: "Scenario must be actual or budget.",
      });
    } else {
      value.scenario = input.scenario;
    }
  }
  return issues.length ? { issues } : { value, issues };
}

function normalizeIdentifierArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_FILTER_VALUES) return null;
  const normalized = value.map(normalizeIdentifier);
  return normalized.some((item) => item === null)
    ? null
    : (normalized as string[]);
}

export function normalizeProvenance(
  input: unknown,
): DashboardProvenance | null {
  if (!isRecord(input)) return null;
  const runId = normalizeIdentifier(input.runId);
  const eventIds = normalizeIdentifierArray(input.eventIds);
  const artifactIds = normalizeIdentifierArray(input.artifactIds);
  if (
    !runId ||
    !eventIds ||
    !artifactIds ||
    eventIds.length + artifactIds.length === 0
  ) {
    return null;
  }
  return { runId, eventIds, artifactIds };
}
