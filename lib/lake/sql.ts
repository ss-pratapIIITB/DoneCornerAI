import { getPool } from "@/lib/pg/pool";
import { migrateWarehouse } from "@/lib/pg/migrate";
import { assertReadOnlySelect } from "@/lib/lake/sql-guard";

export async function queryWarehouseSql(sql: string): Promise<{
  columns: string[];
  rows: Record<string, unknown>[];
}> {
  const safe = assertReadOnlySelect(sql);
  await migrateWarehouse();
  const pool = getPool();
  const result = await pool.query(safe);
  const columns = result.fields.map((f) => f.name);
  return {
    columns,
    rows: result.rows as Record<string, unknown>[],
  };
}
