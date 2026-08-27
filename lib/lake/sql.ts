import { getPool } from "@/lib/pg/pool";
import { migrateWarehouse } from "@/lib/pg/migrate";
import { assertReadOnlySelect } from "@/lib/lake/sql-guard";

export async function queryWarehouseSql(sql: string): Promise<{
  columns: string[];
  rows: Record<string, unknown>[];
}> {
  const safe = assertReadOnlySelect(sql);
  await migrateWarehouse();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '10s'");
    const result = await client.query(safe);
    await client.query("COMMIT");
    return {
      columns: result.fields.map((field) => field.name),
      rows: result.rows as Record<string, unknown>[],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
