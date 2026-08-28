"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Landing } from "@/components/marketing/Landing";
import { AuthView } from "@/components/views/AuthView";
import { OnboardingView } from "@/components/views/OnboardingView";
import { AppShell } from "@/components/views/AppShell";

export default function Home() {
  const { view, setSession, setBooted, booted } = useAppStore();

  // Boot: restore session from httpOnly cookie
  useEffect(() => {
    if (booted) return;
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setSession(data.user ?? null, data.children ?? [], data.entitlements ?? null);
        }
      })
      .catch(() => {
        // offline-safe: stay on landing
      })
      .finally(() => {
        if (!cancelled) setBooted(true);
      });
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
    </>
  );
}
