import { jsonError } from "@/lib/api/http";
import { queryWarehouseSql } from "@/lib/lake/sql";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { sql?: string };
    if (!body.sql?.trim()) {
      return Response.json({ error: "sql required" }, { status: 400 });
    }
    return Response.json(await queryWarehouseSql(body.sql));
  } catch (err) {
    return jsonError(err);
  }
}
