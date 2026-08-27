export function assertReadOnlySelect(sql: string): string {
  const trimmed = sql.trim().replace(/;+\s*$/g, "");
  if (!trimmed) throw new Error("SQL is empty");
  if (trimmed.includes(";")) throw new Error("One statement only");
  const head = trimmed.replace(/^\s*/, "").slice(0, 12).toLowerCase();
  if (!head.startsWith("select") && !head.startsWith("with")) {
    throw new Error("Only SELECT (or WITH … SELECT) is allowed");
  }
  if (
    /\b(insert|update|delete|drop|alter|truncate|grant|revoke|copy|create|into|setval|nextval|set_config|pg_advisory|pg_write_file|pg_execute_server_program|dblink)\b/i.test(
      trimmed,
    )
  ) {
    throw new Error("Mutating SQL is not allowed");
  }
  return trimmed;
}
