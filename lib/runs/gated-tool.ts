export function recordFromUnknown(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return recordFromUnknown(JSON.parse(trimmed) as unknown);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function isEmptyToolArgs(value: unknown): boolean {
  if (value == null || value === "") return true;
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value as object).length === 0;
  }
  return false;
}

export function unwrapGatedTool(
  name: string,
  args: unknown,
): { name: string; arguments: Record<string, unknown> } {
  const rec = recordFromUnknown(args);
  if (name !== "call_tool" && name !== "tool") return { name, arguments: rec };
  const inner = String(rec.tool_name ?? rec.toolName ?? rec.name ?? "");
  if (!inner || inner === "call_tool" || inner === "tool") {
    return { name, arguments: rec };
  }
  return {
    name: inner,
    arguments: recordFromUnknown(rec.input ?? rec.arguments ?? rec.args ?? {}),
  };
}
