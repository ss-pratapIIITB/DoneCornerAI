import { Pool } from "pg";
import { databaseUrl } from "@/lib/pg/config";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl(), max: 8 });
  }
  return pool;
}
