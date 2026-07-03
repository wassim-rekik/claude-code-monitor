import { NextRequest, NextResponse } from "next/server";
import { insertRecords, migrate } from "@/lib/db";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-api-key");
  if (!key || key !== process.env.API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await migrate();

  const body = await req.json() as { user: string; records: unknown[] };
  if (!body.user || !Array.isArray(body.records)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const inserted = await insertRecords(body.user, body.records as Parameters<typeof insertRecords>[1]);
  return NextResponse.json({ inserted });
}
