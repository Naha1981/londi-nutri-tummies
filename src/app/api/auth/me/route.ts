import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, entitlementsFor, planActive } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null }, { status: 200 });
  const children = await db.child.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  const effective = planActive(user);
  return NextResponse.json({ user: { ...user, plan: effective }, children, entitlements: entitlementsFor(effective) });
}
