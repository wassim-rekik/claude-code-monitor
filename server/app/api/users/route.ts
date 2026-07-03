import { NextResponse } from "next/server";
import { getUsers, migrate } from "@/lib/db";

let migrated = false;

export async function GET() {
  if (!migrated) { await migrate(); migrated = true; }
  const users = await getUsers();
  return NextResponse.json(users);
}
