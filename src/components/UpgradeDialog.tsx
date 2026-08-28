"use client";

// Nutri Tummies — Upgrade dialog with live checkout
// Provider flow is chosen by the backend (PayFast form POST / Yoco redirect /
// demo simulate). Works end-to-end in demo mode before merchant keys exist.

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore, zar } from "@/store/useAppStore";
import { Sparkles, Check, Loader2, CreditCard, ShieldCheck, PartyPopper } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type CheckoutResponse = {
  mode?: "payfast" | "yoco" | "demo";
  orderId?: string;
  actionUrl?: string;
  fields?: { name: string; value: string }[];
  url?: string;
  error?: string;
};

const PREMIUM_PERKS = [
  "Unlimited children",
  "Unlimited AI meal plans — regenerate any day",
  "Unlimited Coach Nandi chats",
  "AI recipes from your kitchen ingredients",
  "Weekly nutrition insights",
];

export function UpgradeDialog() {
  const { upgradeOpen, closeUpgrade, upgradeReason, setSession } = useAppStore();
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [provider, setProvider] = useState<string>("demo");
  const [starting, setStarting] = useState(false);
  const [demoOrder, setDemoOrder] = useState<{ orderId: string; amount: number } | null>(null);
  const [completing, setCompleting] = useState(false);
  const [done, setDone] = useState(false);

  // provider info (also detects when real payments go live)
  useEffect(() => {
    if (!upgradeOpen) return;
    setDone(false);
    setDemoOrder(null);
    fetch("/api/billing/checkout")
      .then((r) => r.json())
      .then((d) => setProvider(d.provider ?? "demo"))
      .catch(() => setProvider("demo"));
  }, [upgradeOpen]);

  const planId = cycle === "monthly" ? "premium_monthly" : "premium_yearly";
  const price = cycle === "monthly" ? 79 : 790;
  const priceSuffix = cycle === "monthly" ? "/month" : "/year";

  const refreshSession = () =>
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setSession(data.user ?? null, data.children ?? [], data.entitlements ?? null);
      })
      .catch(() => {});

  async function startCheckout() {
    setStarting(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data: CheckoutResponse = await res.json();
      if (!res.ok) {
        toast({ title: "Checkout unavailable", description: data.error ?? "Please try again in a moment." });
        return;
      }
      if (data.mode === "payfast" && data.actionUrl && data.fields) {
        // PayFast expects a browser form POST to its process page
        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.actionUrl;
        for (const f of data.fields) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = f.name;
          input.value = f.value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
        return;
      }
      if (data.mode === "yoco" && data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.mode === "demo" && data.orderId) {
        setDemoOrder({ orderId: data.orderId, amount: price });
        return;
      }
      toast({ title: "Checkout unavailable", description: "Please try again in a moment." });
    } catch {
      toast({ title: "Network error", description: "Check your connection and try again." });
    } finally {
      setStarting(false);
    }
  }

  async function completeDemoOrder() {
    if (!demoOrder) return;
    setCompleting(true);
    try {
      const res = await fetch("/api/billing/demo-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: demoOrder.orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not complete order", description: data.error ?? "Please try again." });
        return;
      }
      await refreshSession();
      setDone(true);
      toast({
        title: "Welcome to Premium! 🎉",
        description: "Your subscription is active — enjoy unlimited everything.",
      });
    } catch {
      toast({ title: "Network error", description: "Please try again." });
    } finally {
      setCompleting(false);
    }
  }

  return (
    <Dialog open={upgradeOpen} onOpenChange={(o) => !o && closeUpgrade()}>
      <DialogContent className="rounded-3xl max-w-md max-h-[90vh] overflow-y-auto">
        {done ? (
          <>
            <DialogHeader>
              <div className="mx-auto h-16 w-16 rounded-full nt-cta-gradient grid place-items-center text-white text-2xl mb-2 nt-float">
                <PartyPopper />
              </div>
              <DialogTitle className="text-center font-[family-name:var(--font-nunito)] font-black text-2xl">
                You&apos;re Premium!
              </DialogTitle>
              <DialogDescription className="text-center">
                Unlimited meal plans, unlimited coaching and AI recipes are unlocked for your whole family.
              </DialogDescription>
            </DialogHeader>
            <Button className="w-full nt-cta-gradient text-white rounded-full h-12 font-extrabold" onClick={closeUpgrade}>
              Let&apos;s plan some meals
            </Button>
          </>
        ) : demoOrder ? (
          <>
            <DialogHeader>
              <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 grid place-items-center text-amber-600 text-2xl mb-2">
                <CreditCard />
              </div>
              <DialogTitle className="text-center font-[family-name:var(--font-nunito)] font-black text-2xl">
                Demo checkout
              </DialogTitle>
              <DialogDescription className="text-center">
                Live payments aren&apos;t connected yet, so this checkout is simulated. Completing it activates
                Premium instantly — no money changes hands.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-2xl bg-secondary/60 border border-border/60 p-4 space-y-1.5 text-sm font-semibold">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span>Family Premium ({cycle})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span>{zar(demoOrder.amount)}</span>
              </div>
            </div>
            <Button
              className="w-full nt-cta-gradient text-white rounded-full h-12 font-extrabold"
              onClick={completeDemoOrder}
              disabled={completing}
            >
              {completing ? <Loader2 className="h-5 w-5 animate-spin" /> : `Simulate payment of ${zar(demoOrder.amount)}`}
            </Button>
            <Button variant="ghost" className="w-full rounded-full font-bold text-muted-foreground" onClick={() => setDemoOrder(null)}>
              Back
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="mx-auto h-16 w-16 rounded-full nt-cta-gradient grid place-items-center text-white text-2xl mb-2 nt-float">
                <Sparkles />
              </div>
              <DialogTitle className="text-center font-[family-name:var(--font-nunito)] font-black text-2xl">
                Meet Family Premium
              </DialogTitle>
              <DialogDescription className="text-center">
                {upgradeReason || "Unlock the full Nutri Tummies experience for your whole household."}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl bg-secondary/60 border border-border/60 p-4 space-y-2.5">
              {PREMIUM_PERKS.map((p) => (
                <div key={p} className="flex items-center gap-2.5 text-sm font-semibold">
                  <span className="h-5 w-5 rounded-full bg-primary/15 grid place-items-center shrink-0">
                    <Check className="h-3 w-3 text-primary" />
                  </span>
                  {p}
                </div>
              ))}
            </div>

            {/* billing cycle toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-secondary/70 border border-border/60" role="tablist">
              <button
                role="tab"
                aria-selected={cycle === "monthly"}
                onClick={() => setCycle("monthly")}
                className={`rounded-full h-10 text-sm font-extrabold transition-colors ${
                  cycle === "monthly" ? "bg-card shadow-sm border border-border/60" : "text-muted-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                role="tab"
                aria-selected={cycle === "yearly"}
                onClick={() => setCycle("yearly")}
                className={`rounded-full h-10 text-sm font-extrabold transition-colors ${
                  cycle === "yearly" ? "bg-card shadow-sm border border-border/60" : "text-muted-foreground"
                }`}
              >
                Yearly · save 2 months
              </button>
            </div>

            <div className="text-center">
              <div className="font-[family-name:var(--font-nunito)] font-black text-4xl">
                {zar(price)}
                <span className="text-sm font-bold text-muted-foreground">{priceSuffix}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">cancel anytime · VAT incl. · secure checkout</div>
            </div>

            <Button
              className="w-full nt-cta-gradient text-white rounded-full h-12 font-extrabold"
              onClick={startCheckout}
              disabled={starting}
            >
              {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}
              Upgrade now
            </Button>

            {provider === "demo" && (
              <p className="text-xs text-center text-muted-foreground leading-relaxed">
                Demo checkout — live card payments (PayFast / Yoco) activate automatically once merchant keys are
                configured, with no app changes needed.
              </p>
            )}
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Card details are handled by the payment provider — never stored by us.
            </div>
            <Button variant="ghost" className="w-full rounded-full font-bold text-muted-foreground" onClick={closeUpgrade}>
              Maybe later
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
