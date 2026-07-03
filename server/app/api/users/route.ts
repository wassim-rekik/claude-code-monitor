import { NextResponse } from "next/server";
import { getUsers, migrate } from "@/lib/db";

export async function GET() {
  await migrate();
  const users = await getUsers();
  return NextResponse.json(users);
}
