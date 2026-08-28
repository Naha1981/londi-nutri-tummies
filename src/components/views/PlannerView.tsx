"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore, zar, SLOT_ICONS, DAY_FULL, DAY_NAMES, todayIndex, mondayOf } from "@/store/useAppStore";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Loader2, ShoppingCart, Leaf, Flame } from "lucide-react";

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

const SLOTS = ["breakfast", "lunch", "snack", "dinner"];

export function PlannerView() {
  const { children, activeChildId, openUpgrade } = useAppStore();
  const child = children.find((c) => c.id === activeChildId) ?? children[0];
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [shopping, setShopping] = useState(false);

  useEffect(() => {
    if (!child) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/mealplan?childId=${child.id}&week=${mondayOf()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setPlan(data.plan ?? null);
      })
      .catch(() => {})
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
        title: `Fresh plan for ${child.name}! 🎉`,
        description: data.degraded ? "Built from the offline recipe library (AI was busy)." : `Estimated ${zar(data.plan?.estimatedCost)} for the week.`,
      });
    } catch {
      toast({ title: "Could not generate the plan", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const buildShoppingList = async () => {
    if (!plan) return;
    setShopping(true);
    try {
      const res = await fetch("/api/shopping/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not build list", description: data.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Shopping list ready! 🛒",
        description: `${data.created} items added with price estimates.`,
      });
    } catch {
      toast({ title: "Could not build list", variant: "destructive" });
    } finally {
      setShopping(false);
    }
  };

  const weekCost = plan?.estimatedCost ?? 0;
  const budget = child?.budgetPerWeek ?? 0;
  const totalKcal = plan?.meals?.reduce((s, m) => s + m.calories, 0) ?? 0;
  const vegCount = plan?.meals?.filter((m) => m.veggies).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-nunito)] font-black text-2xl md:text-3xl tracking-tight">
            Weekly Meal Planner
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {child ? `${child.name}'s plan · week of ${formatWeek(plan?.weekStart ?? mondayOf())}` : "Add a child first"}
          </p>
        </div>
        <div className="flex gap-2">
          {plan && (
            <Button variant="outline" onClick={buildShoppingList} disabled={shopping} className="rounded-full font-bold">
              {shopping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
              Build shopping list
            </Button>
          )}
          <Button onClick={generate} disabled={generating || !child} className="nt-cta-gradient text-white rounded-full font-extrabold">
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {plan ? "Regenerate week" : "Generate week"}
          </Button>
        </div>
      </div>

      {plan && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { l: "Weekly cost", v: zar(weekCost), s: budget ? `budget ${zar(budget)}` : "", warn: weekCost > budget },
            { l: "Daily average", v: `${Math.round(totalKcal / 7)} kcal`, s: "all meals combined" },
            { l: "Veggie hits", v: `${vegCount}/28`, s: "meals with vegetables" },
            { l: "Meals planned", v: `${plan.meals.length}`, s: "7 days × 4 slots" },
          ].map((stat) => (
            <Card key={stat.l} className="rounded-2xl border-border/70">
              <CardContent className="p-4">
                <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.l}</div>
                <div className={`font-[family-name:var(--font-nunito)] font-black text-xl mt-1 ${stat.warn ? "text-destructive" : "text-primary"}`}>{stat.v}</div>
                <div className="text-[11px] text-muted-foreground font-semibold">{stat.s}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {plan?.notes && (
        <div className="rounded-2xl bg-accent/60 border border-accent px-4 py-3 text-sm font-semibold text-accent-foreground">
          💡 {plan.notes}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-3xl" />)}
        </div>
      ) : !plan ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="p-12 text-center">
            <span className="text-6xl nt-float inline-block">🗓️</span>
            <h3 className="font-[family-name:var(--font-nunito)] font-black text-xl mt-5">No plan for this week</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
              Tap generate and the AI nutritionist will build 28 balanced meals — around{" "}
              {child ? `${child.name}'s tastes, allergies and ${zar(child.budgetPerWeek)} budget` : "your child's profile"}.
            </p>
            <Button onClick={generate} disabled={generating} className="mt-6 nt-cta-gradient text-white rounded-full h-12 px-8 font-extrabold">
              {generating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
              Generate the week
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {[...Array(7)].map((_, day) => {
            const dayMeals = SLOTS.map((slot) => plan.meals.find((m) => m.day === day && m.slot === slot)).filter(Boolean) as PlanMeal[];
            const isToday = day === todayIndex();
            return (
              <Card
                key={day}
                className={`rounded-3xl border-border/70 overflow-hidden ${isToday ? "ring-2 ring-primary/60 border-primary/40" : ""}`}
              >
                <div className={`px-5 py-3 flex items-center justify-between ${isToday ? "nt-cta-gradient text-white" : "bg-secondary/70"}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="font-[family-name:var(--font-nunito)] font-black">{DAY_FULL[day]}</span>
                    {isToday && <Badge className="rounded-full bg-white/25 text-white border-0 text-[10px] font-black">TODAY</Badge>}
                  </div>
                  <div className="text-xs font-bold opacity-80">
                    {zar(dayMeals.reduce((s, m) => s + m.costEst, 0))} · {dayMeals.reduce((s, m) => s + m.calories, 0)} kcal
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {dayMeals.map((m) => (
                      <div key={m.id} className="rounded-2xl border border-border/60 bg-card p-3.5 hover:border-primary/40 hover:shadow-sm transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                            {SLOT_ICONS[m.slot]} {m.slot}
                          </span>
                          {m.veggies && <Leaf className="h-3.5 w-3.5 text-primary" aria-label="Contains vegetables" />}
                        </div>
                        <div className="font-extrabold text-sm mt-1.5 leading-snug min-h-[2.4em]">{m.name}</div>
                        {m.recipeText && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-3">{m.recipeText}</p>
                        )}
                        <div className="mt-2.5 flex items-center gap-3 text-[11px] font-bold text-muted-foreground">
                          <span className="text-primary">{zar(m.costEst)}</span>
                          <span className="inline-flex items-center gap-0.5"><Flame className="h-3 w-3" />{m.calories}</span>
                          <span>{m.protein}g protein</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatWeek(mondayISO: string): string {
  const d = new Date(mondayISO + "T00:00:00");
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}
