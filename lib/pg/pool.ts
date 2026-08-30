import { Pool } from "pg";
import { databaseUrl } from "@/lib/pg/config";

let pool: Pool | null = null;

function sslOption(url: string): boolean | { rejectUnauthorized: boolean } | undefined {
  if (/neon\.tech/i.test(url)) return { rejectUnauthorized: true };
  if (/sslmode=require/i.test(url)) return { rejectUnauthorized: true };
  return undefined;
}

export function getPool(): Pool {
  if (!pool) {
    const url = databaseUrl();
    pool = new Pool({
      connectionString: url,
      max: 8,
      ssl: sslOption(url),
    });
  }
  return pool;
}
