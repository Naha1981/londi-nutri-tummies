// Nutri Tummies — Payments abstraction (PayFast | Yoco | Demo fallback)
// Server-side only. Provider is chosen automatically by which credentials
// are present in the environment; with no credentials the system falls back
// to "demo" mode so the entire upgrade flow stays testable pre-launch.

import { createHash } from "crypto";

export type PlanId = "premium_monthly" | "premium_yearly" | "pro_monthly";

export type PlanDef = {
  id: PlanId;
  label: string;
  userPlan: "premium" | "pro"; // plan value written to the User row
  amountCents: number;
  days: number; // subscription length on successful payment
  perks: string[];
};

export const PLANS: Record<PlanId, PlanDef> = {
  premium_monthly: {
    id: "premium_monthly",
    label: "Family Premium (monthly)",
    userPlan: "premium",
    amountCents: 7900,
    days: 30,
    perks: [
      "Unlimited children",
      "Unlimited AI meal plans",
      "Unlimited Coach Nandi chats",
      "AI recipes from your kitchen",
    ],
  },
  premium_yearly: {
    id: "premium_yearly",
    label: "Family Premium (yearly)",
    userPlan: "premium",
    amountCents: 79000,
    days: 365,
    perks: [
      "Everything in monthly Premium",
      "2 months free vs monthly",
      "Priority support",
    ],
  },
  pro_monthly: {
    id: "pro_monthly",
    label: "Pro (monthly)",
    userPlan: "pro",
    amountCents: 12900,
    days: 30,
    perks: [
      "Everything in Premium",
      "Nutrition insights & reports",
      "Early access to new features",
    ],
  },
};

export function isPlanId(v: string): v is PlanId {
  return v in PLANS;
}

// ---------- provider selection ----------

export type PaymentProvider = "payfast" | "yoco" | "demo";

export function activeProvider(): PaymentProvider {
  if (process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY) return "payfast";
  if (process.env.YOCO_SECRET_KEY) return "yoco";
  return "demo";
}

export function appBaseUrl(req: { headers: { get(k: string): string | null } }): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  // derive from request (works on Vercel previews and the sandbox)
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

// ---------- PayFast ----------

export type PayfastField = { name: string; value: string };

function payfastSignature(fields: PayfastField[], passphrase: string): string {
  const parts = fields
    .filter((f) => f.value !== "")
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((f) => `${f.name}=${encodeURIComponent(f.value).replace(/%20/g, "+")}`);
  if (passphrase) parts.push(`passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}`);
  return createHash("md5").update(parts.join("&")).digest("hex");
}

/**
 * Compute the PayFast signature for an arbitrary payload (used by the ITN
 * webhook to re-verify what PayFast posted, and by tests to simulate ITNs).
 */
export function payfastSignatureFor(payload: Record<string, string>): string {
  const fields: PayfastField[] = Object.entries(payload).map(([name, value]) => ({ name, value: String(value) }));
  return payfastSignature(fields, process.env.PAYFAST_PASSPHRASE ?? "");
}

/**
 * Build the signed hidden-form fields for a PayFast "process" page submission.
 * Sandbox vs live is controlled by PAYFAST_MODE ("sandbox" | "live", default sandbox).
 */
export function buildPayfastCheckout(params: {
  order: { id: string; amountCents: number; planLabel: string };
  user: { email: string; name: string };
  baseUrl: string;
}): { actionUrl: string; fields: PayfastField[] } {
  const mode = process.env.PAYFAST_MODE === "live" ? "live" : "sandbox";
  const actionUrl =
    mode === "live" ? "https://www.payfast.co.za/eng/process" : "https://sandbox.payfast.co.za/eng/process";

  const fields: PayfastField[] = [
    { name: "merchant_id", value: process.env.PAYFAST_MERCHANT_ID ?? "" },
    { name: "merchant_key", value: process.env.PAYFAST_MERCHANT_KEY ?? "" },
    { name: "return_url", value: `${params.baseUrl}/?billing=return&order=${params.order.id}` },
    { name: "cancel_url", value: `${params.baseUrl}/?billing=cancel&order=${params.order.id}` },
    { name: "notify_url", value: `${params.baseUrl}/api/billing/notify` },
    { name: "name_first", value: params.user.name.split(" ")[0].slice(0, 100) },
    { name: "email_address", value: params.user.email },
    { name: "m_payment_id", value: params.order.id },
    { name: "amount", value: (params.order.amountCents / 100).toFixed(2) },
    { name: "item_name", value: `Nutri Tummies ${params.order.planLabel}`.slice(0, 100) },
    { name: "item_description", value: "Nutri Tummies subscription".slice(0, 255) },
  ];
  const sig = payfastSignature(fields, process.env.PAYFAST_PASSPHRASE ?? "");
  fields.push({ name: "signature", value: sig });
  return { actionUrl, fields };
}

/**
 * Verify a PayFast ITN (Instant Transaction Notification) payload:
 * recompute the signature from the received fields and compare.
 */
export function verifyPayfastSignature(payload: Record<string, string>): boolean {
  const passphrase = process.env.PAYFAST_PASSPHRASE ?? "";
  const { signature, ...rest } = payload;
  if (!signature) return false;
  const fields: PayfastField[] = Object.entries(rest).map(([name, value]) => ({ name, value: String(value) }));
  const expected = payfastSignature(fields, passphrase);
  return expected === signature;
}

// ---------- Yoco ----------

/**
 * Create a Yoco checkout session (server-side, secret key never exposed).
 * Returns the hosted checkout URL the browser should be redirected to.
 */
export async function createYocoCheckout(params: {
  order: { id: string; amountCents: number; planLabel: string };
  baseUrl: string;
}): Promise<{ checkoutUrl: string; checkoutId: string } | null> {
  const key = process.env.YOCO_SECRET_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://online.yoco.com/v1/checkouts/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Auth-Secret-Key": key },
      body: JSON.stringify({
        amount: params.order.amountCents,
        currency: "ZAR",
        success_url: `${params.baseUrl}/?billing=return&order=${params.order.id}`,
        cancel_url: `${params.baseUrl}/?billing=cancel&order=${params.order.id}`,
        webhook_url: `${params.baseUrl}/api/billing/webhook/yoco`,
        metadata: { orderId: params.order.id },
        lineItems: [
          {
            displayName: `Nutri Tummies ${params.order.planLabel}`,
            quantity: 1,
            pricingDetails: { price: params.order.amountCents, currency: "ZAR" },
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[yoco] checkout failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as { checkoutId?: string; redirectUrl?: string; url?: string };
    const url = data.redirectUrl ?? data.url;
    if (!url || !data.checkoutId) return null;
    return { checkoutUrl: url, checkoutId: data.checkoutId };
  } catch (err) {
    console.error("[yoco] checkout error", err);
    return null;
  }
}
