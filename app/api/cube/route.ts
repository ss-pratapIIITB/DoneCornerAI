import { getDb, migrate } from "@/lib/db/sqlite";
import { queryCube, type CubeQuery } from "@/lib/cube/query";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as CubeQuery;
  const db = getDb();
  migrate(db);
  const rows = queryCube(db, body);
  return Response.json({ rows });
}
