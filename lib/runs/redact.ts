const SENSITIVE_KEY =
  /(authorization|password|secret|token|api.?key|bytes|storage.*path|file.*path|absolute.*path)/i;

function redactValue(value: unknown, depth: number): unknown {
  if (depth > 8) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => redactValue(item, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[redacted]" : redactValue(item, depth + 1),
      ]),
    );
  }
  if (typeof value === "string") {
    return redactRunSummary(value);
  }
  return value;
}

export function redactRunDetails(
  details: Record<string, unknown>,
): Record<string, unknown> {
  return redactValue(details, 0) as Record<string, unknown>;
}

export function redactRunSummary(summary: string): string {
  return summary
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(
      /\b(password|secret|token|api[ _-]?key)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[redacted]",
    )
    .replace(
      /(?:\/Users\/|\/home\/)[^\s,;]+/g,
      "[redacted-path]",
    )
    .slice(0, 1_000);
}
