import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/http";
import { seedLake } from "@/lib/lake/seed";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  try {
    const result = await seedLake();
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}

export async function GET(_req: NextRequest): Promise<Response> {
  return POST();
}
