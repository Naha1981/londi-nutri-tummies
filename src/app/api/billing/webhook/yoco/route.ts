import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fulfilOrder } from "@/lib/billing";

// POST /api/billing/webhook/yoco — Yoco webhook for checkout completion.
// We never trust the payload directly: the checkoutId is re-verified against
// Yoco's API using the secret key before fulfilling.
export async function POST(req: NextRequest) {
  const key = process.env.YOCO_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "Yoco not configured" }, { status: 403 });
  try {
    const body = (await req.json().catch(() => null)) as { checkoutId?: string; metadata?: { orderId?: string } } | null;
    const checkoutId = body?.checkoutId;
    const orderId = body?.metadata?.orderId;
    if (!checkoutId || !orderId) return NextResponse.json({ error: "Missing ids" }, { status: 400 });

    // verify with Yoco
    const res = await fetch(`https://online.yoco.com/v1/checkouts/${checkoutId}`, {
      headers: { "X-Auth-Secret-Key": key },
    });
    if (!res.ok) {
      console.warn("[yoco:webhook] checkout lookup failed", res.status);
      return NextResponse.json({ error: "Lookup failed" }, { status: 400 });
    }
    const checkout = (await res.json()) as { status?: string; paymentStatus?: string; metadata?: { orderId?: string } };
    const paid = checkout.status === "paid" || checkout.paymentStatus === "paid";
    const matchesOrder = checkout.metadata?.orderId === orderId;

    if (paid && matchesOrder) {
      const result = await fulfilOrder(orderId, checkoutId);
      console.log("[yoco:webhook] fulfilled", orderId, JSON.stringify(result));
      return NextResponse.json({ received: true, fulfilled: result.ok });
    }

    await db.paymentOrder.update({
      where: { id: orderId },
      data: { status: paid ? "paid" : "failed" },
    }).catch(() => {});
    console.warn("[yoco:webhook] not fulfilled", orderId, checkout.status, checkout.paymentStatus);
    return NextResponse.json({ received: true, fulfilled: false });
  } catch (err) {
    console.error("[yoco:webhook]", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
