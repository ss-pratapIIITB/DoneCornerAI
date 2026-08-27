import { jsonError } from "@/lib/api/http";
import { queryLake, queryPnlTable } from "@/lib/lake/query";
import type { LakeQuery } from "@/lib/lake/types";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as LakeQuery & { view?: "chart" | "pnl" };
    if (body.view === "pnl") {
      return Response.json(await queryPnlTable(body.filters ?? {}));
    }
    const rows = await queryLake({
      metric: String(body.metric ?? "revenue"),
      grain: body.grain ?? "period",
      filters: body.filters ?? { scenario: "actual" },
    });
    return Response.json({ rows });
  } catch (err) {
    return jsonError(err);
  }
}
