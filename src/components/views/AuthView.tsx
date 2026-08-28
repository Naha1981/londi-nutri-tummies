"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore, type User, type Child, type Entitlements } from "@/store/useAppStore";
import { Sprout, ArrowLeft, Loader2, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function AuthView() {
  const { authMode, setAuthMode, setView, setSession, openLegal } = useAppStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(authMode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authMode === "signup" ? { name, email, password } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Hmm, that didn't work", description: data.error ?? "Please try again.", variant: "destructive" });
        return;
      }
      // fetch full session (user + children + entitlements)
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();
      const user = (me.user ?? data.user) as User | null;
      setSession(user, (me.children ?? []) as Child[], (me.entitlements ?? null) as Entitlements | null);
      toast({
        title: authMode === "signup" ? `Welcome to Nutri Tummies, ${user?.name?.split(" ")[0]}! 🎉` : `Welcome back, ${user?.name?.split(" ")[0]}!`,
        description: authMode === "signup" ? "Your 14-day Premium trial has started." : "Great to see you again.",
      });
    } catch {
      toast({ title: "Connection problem", description: "Please check your internet and try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen nt-hero-gradient flex flex-col">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between w-full">
        <button onClick={() => setView("landing")} className="flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-xl nt-cta-gradient grid place-items-center text-white">
            <Sprout className="h-5 w-5" />
          </span>
          <span className="font-[family-name:var(--font-nunito)] font-extrabold text-lg">
            Nutri<span className="text-primary">Tummies</span>
          </span>
        </button>
        <Button variant="ghost" size="sm" onClick={() => setView("landing")} className="rounded-full font-semibold">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to home
        </Button>
      </div>

      <div className="flex-1 grid lg:grid-cols-2 items-center mx-auto w-full max-w-6xl px-4 py-10 gap-10">
        {/* Left: value reminder */}
        <div className="hidden lg:block">
          <h2 className="font-[family-name:var(--font-nunito)] font-black text-4xl leading-tight tracking-tight">
            Tonight&rsquo;s dinner,
            <br />
            <span className="text-primary">already sorted.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {[
              "Personalised AI meal plans for every child",
              "Allergies guarded on every plate",
              "Shopping lists that respect your budget",
              "Coach Nandi for the fussy days",
            ].map((x) => (
              <li key={x} className="flex items-center gap-3 text-sm font-semibold text-foreground/80">
                <span className="h-6 w-6 rounded-full bg-primary/10 grid place-items-center">
                  <Check className="h-3.5 w-3.5 text-primary" />
                </span>
                {x}
              </li>
            ))}
          </ul>
          <div className="mt-10 bg-card rounded-2xl border border-border/70 p-5 max-w-sm shadow-sm">
            <p className="text-sm leading-relaxed italic text-muted-foreground">
              &ldquo;The meal plans use food we actually eat. It feels like it was built for us — because it was.&rdquo;
            </p>
            <div className="mt-3 text-xs font-bold">Aisha P. · Cape Town ⭐⭐⭐⭐⭐</div>
          </div>
        </div>

        {/* Right: form */}
        <Card className="rounded-3xl border-border/70 shadow-xl bg-card w-full max-w-md mx-auto">
          <CardContent className="p-7">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">{authMode === "signup" ? "🌱" : "👋"}</div>
              <h3 className="font-[family-name:var(--font-nunito)] font-black text-2xl">
                {authMode === "signup" ? "Create your account" : "Welcome back"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {authMode === "signup" ? "Start with 14 days of Premium — free." : "Sign in to your family dashboard."}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {authMode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="font-bold text-sm">Your name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Nomsai Dlamini"
                    required
                    minLength={2}
                    className="rounded-xl h-11"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="font-bold text-sm">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="font-bold text-sm">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={authMode === "signup" ? "At least 8 characters" : "Your password"}
                  required
                  minLength={authMode === "signup" ? 8 : 1}
                  className="rounded-xl h-11"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full nt-cta-gradient text-white rounded-full h-12 font-extrabold text-base mt-2"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : authMode === "signup" ? "Create account & start trial" : "Sign in"}
              </Button>

              {authMode === "signup" && (
                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  By creating an account you agree to our{" "}
                  <button type="button" onClick={() => openLegal("terms")} className="text-primary font-bold hover:underline">
                    Terms
                  </button>{" "}
                  and{" "}
                  <button type="button" onClick={() => openLegal("privacy")} className="text-primary font-bold hover:underline">
                    Privacy Policy
                  </button>
                  . Child profiles are created by parents or guardians only.
                </p>
              )}
            </form>

            <div className="mt-5 text-center text-sm">
              {authMode === "signup" ? (
                <span className="text-muted-foreground">
                  Already have an account?{" "}
                  <button onClick={() => setAuthMode("signin")} className="text-primary font-bold hover:underline">
                    Sign in
                  </button>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  New to Nutri Tummies?{" "}
                  <button onClick={() => setAuthMode("signup")} className="text-primary font-bold hover:underline">
                    Create an account
                  </button>
                </span>
              )}
            </div>
            <p className="mt-4 text-[11px] text-center text-muted-foreground leading-relaxed">
              By continuing you agree to our Terms and POPIA-compliant Privacy Notice.
              We never share your family&rsquo;s data.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
