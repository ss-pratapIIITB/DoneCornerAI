import { jsonError } from "@/lib/api/http";
import { coerceLakeQuery } from "@/lib/lake/coerce-query";
import { queryLake, queryPnlTable } from "@/lib/lake/query";
import type { LakeQuery } from "@/lib/lake/types";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as LakeQuery & { view?: "chart" | "pnl" };
    if (body.view === "pnl") {
      return Response.json(await queryPnlTable(body.filters ?? {}));
    }
    const query = coerceLakeQuery(body);
    const rows = await queryLake(query);
    return Response.json({ rows, query });
  } catch (err) {
    return jsonError(err);
  }
}
