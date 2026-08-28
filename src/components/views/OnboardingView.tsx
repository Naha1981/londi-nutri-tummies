"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useAppStore, zar, type Child } from "@/store/useAppStore";
import { toast } from "@/hooks/use-toast";
import { Sprout, Loader2, ArrowRight, Plus, PartyPopper } from "lucide-react";

const COLOR_CHOICES = ["emerald", "orange", "rose", "violet", "amber", "teal"] as const;
const COLOR_SWATCH: Record<string, string> = {
  emerald: "bg-emerald-400",
  orange: "bg-orange-400",
  rose: "bg-rose-400",
  violet: "bg-violet-400",
  amber: "bg-amber-400",
  teal: "bg-teal-400",
};

const QUICK_ALLERGENS = ["Peanuts", "Egg", "Dairy", "Gluten", "Fish", "Soy", "Tree nuts"];

export function OnboardingView() {
  const { user, setView, upsertChild, setTab } = useAppStore();
  const [step, setStep] = useState(0); // 0 = welcome, 1 = child form, 2 = done
  const [saving, setSaving] = useState(false);

  // child form state
  const [name, setName] = useState("");
  const [age, setAge] = useState(6);
  const [sex, setSex] = useState("other");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState("");
  const [likes, setLikes] = useState("");
  const [budget, setBudget] = useState(450);
  const [activity, setActivity] = useState("moderate");
  const [color, setColor] = useState<string>("emerald");

  const toggleAllergy = (a: string) => {
    setAllergies((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const saveChild = async () => {
    if (!name.trim()) {
      toast({ title: "Name needed", description: "What's your little one called?", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ageYears: age,
          sex,
          allergies: allergies.join(", "),
          dislikes: dislikes.trim(),
          likes: likes.trim(),
          budgetPerWeek: budget,
          activityLevel: activity,
          avatarColor: color,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not save", description: data.error ?? "Please try again.", variant: "destructive" });
        return;
      }
      upsertChild(data.child as Child);
      setStep(2);
    } catch {
      toast({ title: "Connection problem", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const finish = () => {
    setTab("dashboard");
    setView("app");
  };

  return (
    <div className="min-h-screen nt-hero-gradient flex flex-col">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-lg nt-cta-gradient grid place-items-center text-white">
              <Sprout className="h-4 w-4" />
            </span>
            <span className="font-[family-name:var(--font-nunito)] font-extrabold">NutriTummies</span>
          </div>
          <div className="text-xs font-bold text-muted-foreground">
            Step {Math.min(step + 1, 2)} of 2
          </div>
        </div>
      </header>

      <main className="flex-1 grid place-items-center px-4 py-10">
        {step === 0 && (
          <div className="max-w-lg text-center">
            <div className="text-6xl mb-5 nt-wiggle inline-block">🥗</div>
            <h1 className="font-[family-name:var(--font-nunito)] font-black text-3xl md:text-4xl tracking-tight">
              Welcome{user ? `, ${user.name.split(" ")[0]}` : ""}!
            </h1>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Let&rsquo;s meet the little tummies we&rsquo;re feeding. Add your first child —
              their age, tastes, allergies and budget. It takes about a minute, and every meal
              plan after this is built around them.
            </p>
            <Button onClick={() => setStep(1)} className="mt-8 nt-cta-gradient text-white rounded-full h-12 px-8 font-extrabold text-base">
              Add my first child <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              All data stays private to your account — POPIA compliant.
            </p>
          </div>
        )}

        {step === 1 && (
          <Card className="w-full max-w-2xl rounded-3xl border-border/70 shadow-xl">
            <CardContent className="p-6 md:p-8">
              <h2 className="font-[family-name:var(--font-nunito)] font-black text-2xl">Tell us about your child</h2>
              <p className="text-sm text-muted-foreground mt-1">
                The more we know, the better the meal plans fit.
              </p>

              <div className="mt-6 grid sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="font-bold text-sm">Their name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Londi" className="rounded-xl h-11" maxLength={40} />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-sm">Age: <span className="text-primary">{age} years</span></Label>
                  <Slider value={[age]} onValueChange={(v) => setAge(v[0])} min={1} max={17} step={1} className="mt-4" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-sm">Sex</Label>
                  <div className="flex gap-2">
                    {[
                      { v: "male", l: "Boy" },
                      { v: "female", l: "Girl" },
                      { v: "other", l: "Rather not say" },
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setSex(o.v)}
                        className={`flex-1 rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors ${
                          sex === o.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"
                        }`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-sm">Activity level</Label>
                  <div className="flex gap-2">
                    {[
                      { v: "low", l: "🏡 Calm" },
                      { v: "moderate", l: "🤸 Normal" },
                      { v: "high", l: "⚽ Very active" },
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setActivity(o.v)}
                        className={`flex-1 rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors ${
                          activity === o.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"
                        }`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label className="font-bold text-sm">Allergies <span className="text-muted-foreground font-medium">(tap all that apply)</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_ALLERGENS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAllergy(a)}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                          allergies.includes(a)
                            ? "border-destructive/50 bg-destructive/10 text-destructive"
                            : "border-border text-muted-foreground hover:border-foreground/30"
                        }`}
                      >
                        {allergies.includes(a) ? "⛔ " : ""}{a}
                      </button>
                    ))}
                  </div>
                  <Input
                    value={allergies.filter((a) => !QUICK_ALLERGENS.includes(a)).length ? allergies.filter((a) => !QUICK_ALLERGENS.includes(a)).join(", ") : ""}
                    onChange={(e) => setAllergies([...allergies.filter((a) => QUICK_ALLERGENS.includes(a)), ...e.target.value.split(",").map((s) => s.trim()).filter(Boolean)])}
                    placeholder="Any other allergies? (comma separated)"
                    className="rounded-xl h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold text-sm">Loves eating 😍</Label>
                  <Input value={likes} onChange={(e) => setLikes(e.target.value)} placeholder="e.g. chicken, pap, bananas" className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-sm">Refuses to eat 😤</Label>
                  <Input value={dislikes} onChange={(e) => setDislikes(e.target.value)} placeholder="e.g. spinach, fish" className="rounded-xl h-11" />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="font-bold text-sm">
                    Weekly food budget: <span className="text-primary">{zar(budget)}</span>
                  </Label>
                  <Slider value={[budget]} onValueChange={(v) => setBudget(v[0])} min={150} max={2000} step={50} className="mt-4" />
                  <div className="flex justify-between text-[11px] text-muted-foreground font-semibold">
                    <span>R150</span>
                    <span>Typical: R400–R600</span>
                    <span>R2000</span>
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label className="font-bold text-sm">Pick an avatar colour</Label>
                  <div className="flex gap-2.5">
                    {COLOR_CHOICES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        aria-label={`Colour ${c}`}
                        className={`h-9 w-9 rounded-full ${COLOR_SWATCH[c]} transition-all ${color === c ? "ring-4 ring-offset-2 ring-primary/50 scale-110" : "opacity-70 hover:opacity-100"}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <Button onClick={saveChild} disabled={saving} className="flex-1 nt-cta-gradient text-white rounded-full h-12 font-extrabold">
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Save &amp; continue <ArrowRight className="ml-1 h-5 w-5" /></>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <div className="max-w-lg text-center">
            <div className="text-6xl mb-5 inline-block nt-float"><PartyPopper /></div>
            <h1 className="font-[family-name:var(--font-nunito)] font-black text-3xl md:text-4xl tracking-tight">
              {name.split(" ")[0]} is all set!
            </h1>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Now for the magic: head to your dashboard and generate {name.split(" ")[0]}&rsquo;s
              first AI meal plan — built around {zar(budget)} a week
              {allergies.length ? ` and strictly avoiding ${allergies.join(", ").toLowerCase()}` : ""}.
            </p>
            <Badge className="mt-5 rounded-full bg-accent text-accent-foreground border-0 font-bold">
              🌟 14-day Premium trial active
            </Badge>
            <div className="mt-8">
              <Button onClick={finish} className="nt-cta-gradient text-white rounded-full h-12 px-8 font-extrabold text-base">
                Go to my dashboard <ArrowRight className="ml-1 h-5 w-5" />
              </Button>
            </div>
            <button
              onClick={() => { setStep(1); setName(""); }}
              className="mt-4 text-sm text-muted-foreground hover:text-foreground font-bold inline-flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> Add another child first
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
