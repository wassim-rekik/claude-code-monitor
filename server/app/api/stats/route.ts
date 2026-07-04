import { NextRequest, NextResponse } from "next/server";
import { getStats, migrate } from "@/lib/db";
import { statsQuerySchema } from "@/lib/validation";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = statsQuerySchema.safeParse({
    user: searchParams.get("user") ?? undefined,
    range: searchParams.get("range") ?? undefined,
  });

  if (!parsed.success) {
    return errorResponse("Invalid query parameters", 400);
  }

  try {
    await migrate();
    const data = await getStats(parsed.data.user, parsed.data.range);
    return NextResponse.json(data);
  } catch {
    return errorResponse("Internal server error", 500);
  }
}
