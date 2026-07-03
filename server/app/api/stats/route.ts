import { NextRequest, NextResponse } from "next/server";
import { getStats, migrate } from "@/lib/db";

export async function GET(req: NextRequest) {
  await migrate();

  const { searchParams } = new URL(req.url);
  const user  = searchParams.get("user")  ?? "all";
  const range = parseInt(searchParams.get("range") ?? "14", 10);

  const data = await getStats(user, range);
  return NextResponse.json(data);
}
