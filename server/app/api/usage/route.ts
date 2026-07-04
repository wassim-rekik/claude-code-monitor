import { NextRequest, NextResponse } from "next/server";
import { insertRecords, migrate } from "@/lib/db";
import { usagePayloadSchema } from "@/lib/validation";
import { isRateLimited } from "@/lib/rate-limit";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-api-key");
  if (!key || key !== process.env.API_KEY) {
    return errorResponse("Unauthorized", 401);
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(clientIp)) {
    return errorResponse("Too many requests", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid payload", 400);
  }

  const parsed = usagePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid payload", 400);
  }

  try {
    await migrate();
    const inserted = await insertRecords(parsed.data.user, parsed.data.records);
    return NextResponse.json({ inserted });
  } catch {
    return errorResponse("Internal server error", 500);
  }
}
