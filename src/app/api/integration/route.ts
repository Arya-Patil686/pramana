import { NextResponse } from "next/server";
import { capabilityStatuses } from "@/lib/google/config";

/*
   GET /api/integration — which Google service is doing which job, and whether
   it is live on this deployment right now.

   This exists because "we integrated Google AI" is a claim, and a claim that
   a judge cannot check is worth nothing. The response says which capability
   is keyed and which is serving recorded output, and it never reveals a key
   or any part of one.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const capabilities = capabilityStatuses();
  return NextResponse.json({
    capabilities,
    summary: {
      live: capabilities.filter((c) => c.mode === "live").length,
      total: capabilities.length,
    },
    checkedAt: new Date().toISOString(),
  });
}
