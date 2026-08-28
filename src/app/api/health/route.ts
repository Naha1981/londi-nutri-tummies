import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  let dbOk = false;
  try {
    await db.recipe.count();
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return NextResponse.json({
    status: "ok",
    service: "nutri-tummies",
    database: dbOk ? "connected" : "unavailable",
    time: new Date().toISOString(),
  });
}
