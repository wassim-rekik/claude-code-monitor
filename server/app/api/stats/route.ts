import { NextRequest, NextResponse } from "next/server";
import { getStats, migrate } from "@/lib/db";

let migrated = false;

export async function GET(req: NextRequest) {
  if (!migrated) { await migrate(); migrated = true; }

  const { searchParams } = new URL(req.url);
  const user  = searchParams.get("user")  ?? "all";
  const range = parseInt(searchParams.get("range") ?? "14", 10);

  const data = await getStats(user, range);
  return NextResponse.json(data);
}
