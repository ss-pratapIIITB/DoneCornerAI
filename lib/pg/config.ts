export function databaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    "postgres://surendrapratap@127.0.0.1:5432/donecorner"
  );
}
