"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore, zar, AVATAR_COLORS, SLOT_ICONS, DAY_NAMES, todayIndex, mondayOf } from "@/store/useAppStore";
import { toast } from "@/hooks/use-toast";
import {
  CalendarDays, ShoppingCart, MessageCircleHeart, Plus, Sparkles, Loader2, ArrowRight, ChevronRight,
} from "lucide-react";

type PlanMeal = {
  id: string;
  day: number;
  slot: string;
  name: string;
  description?: string;
  calories: number;
  protein: number;
  costEst: number;
  veggies: boolean;
  recipeText?: string;
};

type MealPlan = {
  id: string;
  weekStart: string;
  estimatedCost: number | null;
  budget: number | null;
  notes?: string;
  meals: PlanMeal[];
};

function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardView() {
  const { user, children, activeChildId, setActiveChild, setTab, openUpgrade } = useAppStore();
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const child = children.find((c) => c.id === activeChildId) ?? children[0];

  useEffect(() => {
    if (!child) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/mealplan?childId=${child.id}&week=${mondayOf()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setPlan(data.plan ?? null);
      })
      .catch(() => {
        if (!cancelled) toast({ title: "Could not load the meal plan", variant: "destructive" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [child?.id]);

  const generate = async () => {
    if (!child) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/mealplan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: child.id, week: mondayOf() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.upgrade) openUpgrade(data.error);
        else toast({ title: "Plan failed", description: data.error, variant: "destructive" });
        return;
      }
      setPlan(data.plan);
      toast({
        title: `${child.name}'s week is planned! 🎉`,
        description: data.degraded
          ? "Generated from the offline recipe library (AI was busy)."
          : `28 meals · estimated ${zar(data.plan?.estimatedCost)} for the week.`,
      });
    } catch {
      toast({ title: "Could not generate the plan", description: "Please try again.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const todayMeals = plan?.meals
    ? [...plan.meals].filter((m) => m.day === todayIndex()).sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot])
    : [];

  const weekCost = plan?.estimatedCost ?? plan?.meals?.reduce((s, m) => s + m.costEst, 0) ?? 0;
  const budget = child?.budgetPerWeek ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-nunito)] font-black text-2xl md:text-3xl tracking-tight">
            {greet()}{user ? `, ${user.name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {DAY_NAMES[todayIndex()]} · Let&rsquo;s keep little tummies happy today.
          </p>
        </div>
        <Button
          onClick={generate}
          disabled={generating || !child}
          className="nt-cta-gradient text-white rounded-full font-extrabold shadow-md"
        >
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {plan ? "Regenerate this week" : "Generate this week's plan"}
        </Button>
      </div>

      {/* Child selector */}
      {children.length > 0 && (
        <div className="flex gap-2.5 flex-wrap">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveChild(c.id)}
              className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 transition-all ${
                c.id === child?.id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/70 bg-card hover:border-foreground/25"
              }`}
            >
              <span className={`h-9 w-9 rounded-full ${AVATAR_COLORS[c.avatarColor]?.bg ?? "bg-emerald-100"} grid place-items-center text-sm font-black ${AVATAR_COLORS[c.avatarColor]?.text ?? "text-emerald-700"}`}>
                {c.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="text-left">
                <div className="text-sm font-extrabold leading-tight">{c.name}</div>
                <div className="text-[11px] text-muted-foreground font-semibold">{c.ageYears} yrs · {zar(c.budgetPerWeek)}/wk</div>
              </div>
            </button>
          ))}
          <button
            onClick={() => setTab("settings")}
            className="flex items-center gap-1.5 rounded-2xl border border-dashed border-border px-4 py-2.5 text-sm font-bold text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            <Plus className="h-4 w-4" /> Add child
          </button>
        </div>
      )}

      {!child ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="p-10 text-center">
            <span className="text-5xl">🧒</span>
            <h3 className="font-[family-name:var(--font-nunito)] font-black text-xl mt-4">No children yet</h3>
            <p className="text-sm text-muted-foreground mt-2">Add your first child to unlock meal plans.</p>
            <Button onClick={() => setTab("settings")} className="mt-5 nt-cta-gradient text-white rounded-full font-bold">
              <Plus className="mr-1 h-4 w-4" /> Add a child
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Today's meals — the hero card */}
          <Card className="lg:col-span-2 rounded-3xl border-border/70 overflow-hidden">
            <div className="nt-cta-gradient text-white px-6 py-5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-widest text-white/75">Today for {child.name}</div>
                <div className="font-[family-name:var(--font-nunito)] font-black text-xl mt-0.5">
                  {todayMeals.length > 0 ? `${todayMeals.length} meals planned` : "No plan yet"}
                </div>
              </div>
              <span className="text-4xl">{["🌙", "🌅", "☀️", "🤸"][todayIndex() % 4]}</span>
            </div>
            <CardContent className="p-5">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
                </div>
              ) : todayMeals.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-4xl">🍽️</span>
                  <p className="text-sm text-muted-foreground mt-3 font-semibold">
                    No plan for this week yet. Generate one and tonight&rsquo;s dinner is sorted.
                  </p>
                  <Button onClick={generate} disabled={generating} className="mt-4 nt-cta-gradient text-white rounded-full font-extrabold">
                    {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Generate {child.name}&rsquo;s plan
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {todayMeals.map((m) => (
                    <div key={m.id} className="flex items-center gap-3.5 rounded-2xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-sm transition-all p-3.5">
                      <span className="h-11 w-11 rounded-xl bg-secondary grid place-items-center text-xl shrink-0">
                        {SLOT_ICONS[m.slot] ?? "🍽️"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-black text-muted-foreground uppercase tracking-wide">{m.slot}</div>
                        <div className="font-extrabold text-sm leading-snug">{m.name}</div>
                        {m.description && <div className="text-xs text-muted-foreground truncate">{m.description}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-primary">{zar(m.costEst)}</div>
                        <div className="text-[11px] text-muted-foreground font-semibold">{m.calories} kcal</div>
                      </div>
                    </div>
                  ))}
                  <Button variant="ghost" className="w-full rounded-2xl font-bold text-primary" onClick={() => setTab("planner")}>
                    View the full week <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Side column */}
          <div className="space-y-5">
            {/* Budget card */}
            <Card className="rounded-3xl border-border/70">
              <CardContent className="p-5">
                <div className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Weekly budget</div>
                {plan ? (
                  <>
                    <div className="mt-1 flex items-end gap-2">
                      <span className={`font-[family-name:var(--font-nunito)] font-black text-3xl ${weekCost > budget ? "text-destructive" : "text-primary"}`}>
                        {zar(weekCost)}
                      </span>
                      <span className="text-sm font-bold text-muted-foreground mb-1">of {zar(budget)}</span>
                    </div>
                    <div className="mt-3 h-3 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${weekCost > budget ? "bg-destructive" : "nt-cta-gradient"}`}
                        style={{ width: `${Math.min(100, budget ? (weekCost / budget) * 100 : 0)}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs font-semibold text-muted-foreground">
                      {weekCost > budget
                        ? `Over by ${zar(weekCost - budget)} — try regenerating or swapping a day.`
                        : `${zar(budget - weekCost)} left for treats 🍭`}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">Generate a plan to see cost tracking.</p>
                )}
              </CardContent>
            </Card>

            {/* Child profile card */}
            <Card className="rounded-3xl border-border/70">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <span className={`h-12 w-12 rounded-full ${AVATAR_COLORS[child.avatarColor]?.bg ?? "bg-emerald-100"} grid place-items-center text-lg font-black ${AVATAR_COLORS[child.avatarColor]?.text ?? "text-emerald-700"} ring-2 ${AVATAR_COLORS[child.avatarColor]?.ring ?? "ring-emerald-300"}`}>
                    {child.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <div className="font-[family-name:var(--font-nunito)] font-black">{child.name}</div>
                    <div className="text-xs text-muted-foreground font-semibold">
                      {child.ageYears} yrs · {child.activityLevel} activity
                    </div>
                  </div>
                </div>
                {child.allergies && (
                  <div className="mt-4">
                    <div className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Allergies guarded</div>
                    <div className="flex flex-wrap gap-1.5">
                      {child.allergies.split(",").filter(Boolean).map((a) => (
                        <Badge key={a} variant="outline" className="rounded-full text-[10px] font-black border-destructive/40 text-destructive">
                          ⛔ {a.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <Button variant="ghost" size="sm" className="mt-4 w-full rounded-xl font-bold text-muted-foreground" onClick={() => setTab("settings")}>
                  Edit profile <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { icon: CalendarDays, emoji: "🗓️", title: "Plan the week", desc: "28 meals, allergy-safe", tab: "planner" as const, cta: "Open planner" },
          { icon: ShoppingCart, emoji: "🛒", title: "Shopping list", desc: "Priced for your budget", tab: "shopping" as const, cta: "Build list" },
          { icon: MessageCircleHeart, emoji: "💬", title: "Ask Coach Nandi", desc: "Fussy eating advice", tab: "coach" as const, cta: "Start chatting" },
        ].map((qa) => (
          <Card key={qa.title} className="rounded-3xl border-border/70 hover:shadow-md hover:-translate-y-0.5 transition-all">
            <CardContent className="p-5 flex items-center gap-4">
              <span className="h-12 w-12 rounded-2xl bg-secondary grid place-items-center text-2xl shrink-0">{qa.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="font-[family-name:var(--font-nunito)] font-extrabold text-sm">{qa.title}</div>
                <div className="text-xs text-muted-foreground">{qa.desc}</div>
              </div>
              <Button size="sm" variant="outline" className="rounded-full font-bold shrink-0" onClick={() => setTab(qa.tab)}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

const SLOT_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 };
