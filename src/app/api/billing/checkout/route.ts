import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, planActive } from "@/lib/auth";
import { PLANS, isPlanId, activeProvider, buildPayfastCheckout, createYocoCheckout, appBaseUrl } from "@/lib/payments";

// POST /api/billing/checkout — create a pending order and return provider-specific
// payment instructions. Modes:
//   payfast → { mode:"payfast", actionUrl, fields }  (browser auto-submits hidden form)
//   yoco    → { mode:"yoco", url }                   (browser redirects)
//   demo    → { mode:"demo", orderId }               (simulate payment button)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const parsed = z.object({ planId: z.string().min(1) }).safeParse(body);
    if (!parsed.success || !isPlanId(parsed.data.planId)) {
      return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
    }
    const plan = PLANS[parsed.data.planId];

    const provider = activeProvider();
    const order = await db.paymentOrder.create({
      data: {
        userId: user.id,
        provider,
        planId: plan.id,
        planLabel: plan.label,
        amountCents: plan.amountCents,
        status: "pending",
      },
    });

    const baseUrl = appBaseUrl(req);

    if (provider === "payfast") {
      const { actionUrl, fields } = buildPayfastCheckout({
        order: { id: order.id, amountCents: order.amountCents, planLabel: order.planLabel },
        user: { email: user.email, name: user.name },
        baseUrl,
      });
      return NextResponse.json({ mode: "payfast", orderId: order.id, actionUrl, fields });
    }

    if (provider === "yoco") {
      const checkout = await createYocoCheckout({
        order: { id: order.id, amountCents: order.amountCents, planLabel: order.planLabel },
        baseUrl,
      });
      if (checkout) {
        await db.paymentOrder.update({ where: { id: order.id }, data: { providerRef: checkout.checkoutId } });
        return NextResponse.json({ mode: "yoco", orderId: order.id, url: checkout.checkoutUrl });
      }
      // Yoco outage → fall back to demo so the flow never dead-ends
      await db.paymentOrder.update({ where: { id: order.id }, data: { provider: "demo" } });
      return NextResponse.json({ mode: "demo", orderId: order.id, note: "Yoco unavailable" });
    }

    return NextResponse.json({ mode: "demo", orderId: order.id });
  } catch (err) {
    console.error("[billing:checkout]", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}

// GET /api/billing/checkout — current provider + plan catalogue (for the upgrade UI)
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const provider = activeProvider();
  return NextResponse.json({
    provider,
    demo: provider === "demo",
    activePlan: planActive(user),
    plans: Object.values(PLANS).map((p) => ({
      id: p.id,
      label: p.label,
      amountZar: p.amountCents / 100,
      days: p.days,
      perks: p.perks,
    })),
  });
}
