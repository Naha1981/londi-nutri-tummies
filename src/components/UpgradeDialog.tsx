"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/useAppStore";
import { Sparkles, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const PREMIUM_PERKS = [
  "Unlimited children",
  "Unlimited AI meal plans — regenerate any day",
  "Unlimited Coach Nandi chats",
  "AI recipes from your kitchen ingredients",
  "Weekly nutrition insights",
];

export function UpgradeDialog() {
  const { upgradeOpen, closeUpgrade, upgradeReason } = useAppStore();

  return (
    <Dialog open={upgradeOpen} onOpenChange={(o) => !o && closeUpgrade()}>
      <DialogContent className="rounded-3xl max-w-md">
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

        <div className="text-center">
          <div className="font-[family-name:var(--font-nunito)] font-black text-4xl">
            R79<span className="text-sm font-bold text-muted-foreground">/month</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">or R790/year · 2 months free · cancel anytime</div>
        </div>

        <Button
          className="w-full nt-cta-gradient text-white rounded-full h-12 font-extrabold"
          onClick={() => {
            closeUpgrade();
            toast({
              title: "Payment coming soon 💳",
              description: "Checkout (PayFast & SnapScan) launches with the public release. Your trial continues free meanwhile.",
            });
          }}
        >
          Upgrade now
        </Button>
        <Button variant="ghost" className="w-full rounded-full font-bold text-muted-foreground" onClick={closeUpgrade}>
          Maybe later
        </Button>
      </DialogContent>
    </Dialog>
  );
}
