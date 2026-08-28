import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { activeProvider } from "@/lib/payments";

// GET /api/billing/orders — the signed-in user's payment history (Settings view)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const orders = await db.paymentOrder.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ orders, provider: activeProvider() });
}
