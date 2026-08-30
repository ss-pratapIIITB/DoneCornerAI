export function portalFailureReason(
  body: { reason?: string; error?: string },
  fallback: string,
): string {
  const raw = [body.reason, body.error].find(
    (value) => typeof value === "string" && value.trim(),
  );
  if (!raw) return fallback;
  const match = raw.match(/"message"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (match) {
    try {
      return JSON.parse(`"${match[1]}"`) as string;
    } catch {
      return match[1].replace(/\\"/g, '"');
    }
  }
  return raw;
}
