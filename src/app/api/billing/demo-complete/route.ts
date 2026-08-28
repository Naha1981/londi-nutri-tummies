import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { activeProvider } from "@/lib/payments";
import { fulfilOrder } from "@/lib/billing";

// POST /api/billing/demo-complete — simulates a successful payment.
// ONLY available when no real payment provider is configured (pre-launch
// testing). Automatically disabled in production once merchant keys exist.
export async function POST(req: NextRequest) {
  if (activeProvider() !== "demo") {
    return NextResponse.json({ error: "Demo payments are disabled." }, { status: 403 });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const parsed = z.object({ orderId: z.string().min(1) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const order = await db.paymentOrder.findFirst({ where: { id: parsed.data.orderId, userId: user.id } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.provider !== "demo") {
      return NextResponse.json({ error: "This order is not a demo order." }, { status: 400 });
    }

    const result = await fulfilOrder(order.id, `demo_${Date.now()}`);
    if (!result.ok) {
      return NextResponse.json({ error: "Could not complete order." }, { status: 400 });
    }

    const fresh = await db.user.findUnique({ where: { id: user.id }, select: { plan: true, premiumUntil: true } });
    return NextResponse.json({
      ok: true,
      alreadyPaid: result.alreadyPaid,
      plan: fresh?.plan,
      premiumUntil: fresh?.premiumUntil ?? null,
    });
  } catch (err) {
    console.error("[billing:demo-complete]", err);
    return NextResponse.json({ error: "Could not complete order." }, { status: 500 });
  }
}
