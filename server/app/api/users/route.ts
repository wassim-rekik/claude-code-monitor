import { NextResponse } from "next/server";
import { getUsers, migrate } from "@/lib/db";

export async function GET() {
  try {
    await migrate();
    const users = await getUsers();
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
