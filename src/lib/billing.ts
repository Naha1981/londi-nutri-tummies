// Nutri Tummies — order fulfilment shared by all payment providers.
// Idempotent: a paid order can never double-apply.

import { db } from "@/lib/db";
import { PLANS, isPlanId, type PlanId } from "@/lib/payments";

export type FulfilResult =
  | { ok: true; orderId: string; plan: string; premiumUntil: Date; alreadyPaid: boolean }
  | { ok: false; reason: string };

export async function fulfilOrder(orderId: string, providerRef: string | null): Promise<FulfilResult> {
  const order = await db.paymentOrder.findUnique({ where: { id: orderId }, include: { user: true } });
  if (!order) return { ok: false, reason: "order_not_found" };
  if (order.status === "paid") return { ok: true, orderId: order.id, plan: order.user.plan, premiumUntil: order.user.premiumUntil ?? new Date(), alreadyPaid: true };

  if (!isPlanId(order.planId)) return { ok: false, reason: "bad_plan" };
  const plan = PLANS[order.planId as PlanId];

  // extend from today or from the end of any active subscription (renewals don't lose paid days)
  const now = new Date();
  const base = order.user.premiumUntil && order.user.premiumUntil > now ? new Date(order.user.premiumUntil) : now;
  const premiumUntil = new Date(base.getTime() + plan.days * 24 * 60 * 60 * 1000);

  await db.$transaction([
    db.paymentOrder.update({
      where: { id: order.id },
      data: { status: "paid", providerRef: providerRef ?? order.providerRef },
    }),
    db.user.update({
      where: { id: order.userId },
      data: { plan: plan.userPlan, premiumUntil, trialEndsAt: null },
    }),
  ]);

  return { ok: true, orderId: order.id, plan: plan.userPlan, premiumUntil, alreadyPaid: false };
}
