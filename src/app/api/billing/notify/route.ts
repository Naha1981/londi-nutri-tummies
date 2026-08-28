import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPayfastSignature, PLANS, isPlanId, type PlanId } from "@/lib/payments";
import { fulfilOrder } from "@/lib/billing";

// POST /api/billing/notify — PayFast ITN (Instant Transaction Notification) webhook.
// PayFast POSTs application/x-www-form-urlencoded. We verify the signature,
// the amount and the payment status before fulfilling.
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const params: Record<string, string> = {};
    for (const pair of raw.split("&")) {
      const idx = pair.indexOf("=");
      if (idx === -1) continue;
      const key = decodeURIComponent(pair.slice(0, idx).replace(/\+/g, " "));
      const value = decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, " "));
      params[key] = value;
    }

    if (!verifyPayfastSignature(params)) {
      console.warn("[payfast:notify] signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const orderId = params.m_payment_id;
    if (!orderId) return NextResponse.json({ error: "Missing m_payment_id" }, { status: 400 });

    const order = await db.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      // ITN for an unknown order — acknowledge with 200 so PayFast stops retrying
      return NextResponse.json({ received: true, ignored: "unknown_order" });
    }
    if (!isPlanId(order.planId)) return NextResponse.json({ error: "Bad order plan" }, { status: 400 });
    const plan = PLANS[order.planId as PlanId];

    const paymentStatus = params.payment_status;
    const amountPaid = Math.round(parseFloat(params.amount_gross ?? "0") * 100);

    if (paymentStatus === "COMPLETE" && amountPaid >= plan.amountCents) {
      const result = await fulfilOrder(orderId, params.pf_payment_id ?? null);
      console.log("[payfast:notify] fulfilled", orderId, JSON.stringify(result));
      return NextResponse.json({ received: true, fulfilled: result.ok });
    }

    // CANCELLED / FAILED / underpaid → mark failed
    await db.paymentOrder.update({
      where: { id: orderId },
      data: { status: paymentStatus === "CANCELLED" ? "cancelled" : "failed", providerRef: params.pf_payment_id ?? null },
    }).catch(() => {});
    console.warn("[payfast:notify] not fulfilled", orderId, paymentStatus, amountPaid);
    return NextResponse.json({ received: true, fulfilled: false });
  } catch (err) {
    console.error("[payfast:notify]", err);
    return NextResponse.json({ error: "Notify error" }, { status: 500 });
  }
}
