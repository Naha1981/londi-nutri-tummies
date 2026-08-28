"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Landing } from "@/components/marketing/Landing";
import { AuthView } from "@/components/views/AuthView";
import { OnboardingView } from "@/components/views/OnboardingView";
import { AppShell } from "@/components/views/AppShell";
import { LegalView } from "@/components/views/LegalView";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { view, setSession, setBooted, booted, legalDoc } = useAppStore();
  const { toast } = useToast();

  // Boot: restore session from httpOnly cookie
  useEffect(() => {
    if (booted) return;
    let cancelled = false;

    // payment provider redirect landing (?billing=return&order=...)
    const params = new URLSearchParams(window.location.search);
    const billingReturn = params.get("billing") === "return";
    if (params.get("billing")) {
      window.history.replaceState({}, "", window.location.pathname); // clean URL
    }

    const refreshSession = () =>
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) {
            setSession(data.user ?? null, data.children ?? [], data.entitlements ?? null);
          }
        })
        .catch(() => {
          // offline-safe: stay on landing
        });

    refreshSession().finally(() => {
      if (!cancelled) setBooted(true);
    });

    if (billingReturn) {
      // webhook may land a few seconds after the redirect — re-check once
      toast({
        title: "Payment received 🎉",
        description: "We're confirming your payment — Premium unlocks automatically once it clears.",
      });
      setTimeout(() => {
        if (!cancelled) refreshSession();
      }, 5000);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  if (!booted) {
    return (
      <div className="min-h-screen nt-hero-gradient grid place-items-center">
        <div className="text-center">
          <div className="h-16 w-16 rounded-3xl nt-cta-gradient grid place-items-center text-white text-3xl nt-float mx-auto">
            🌱
          </div>
          <div className="mt-5 font-[family-name:var(--font-nunito)] font-black text-xl">
            Nutri<span className="text-primary">Tummies</span>
          </div>
          <div className="mt-1.5 text-sm text-muted-foreground font-semibold">Setting the table…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {view === "landing" && <Landing />}
      {view === "auth" && <AuthView />}
      {view === "onboarding" && <OnboardingView />}
      {view === "app" && <AppShell />}
      {legalDoc && <LegalView />}
    </>
  );
}
