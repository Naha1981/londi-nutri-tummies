"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore, zar } from "@/store/useAppStore";
import { toast } from "@/hooks/use-toast";
import { Search, Sparkles, Loader2, Clock, Users, Flame, Leaf, X, Wand2 } from "lucide-react";

type Recipe = {
  id: string;
  slug: string;
  title: string;
  category: string;
  minutes: number;
  servings: number;
  ingredients: string;
  instructions: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  costEst: number;
  tags: string;
  allergens: string;
  emoji: string;
  kidApproved: boolean;
};

const CATEGORIES = [
  { v: "", l: "All", e: "🍽️" },
  { v: "breakfast", l: "Breakfast", e: "🌅" },
  { v: "lunch", l: "Lunch", e: "☀️" },
  { v: "dinner", l: "Dinner", e: "🌙" },
  { v: "snack", l: "Snacks", e: "🍎" },
];

export function RecipesView() {
  const { children, activeChildId, openUpgrade } = useAppStore();
  const child = children.find((c) => c.id === activeChildId) ?? children[0];
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState<Recipe | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [ingredients, setIngredients] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);
      const res = await fetch(`/api/recipes?${params}`);
      const data = await res.json();
      setRecipes(data.recipes ?? []);
    } catch {
      toast({ title: "Could not load recipes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, category]);

  const childAllergens = (child?.allergies ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

  const generateRecipe = async () => {
    if (ingredients.trim().length < 3) {
      toast({ title: "Tell us your ingredients", description: "e.g. mealie meal, eggs, tomatoes, spinach", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: ingredients.trim(), childId: child?.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.upgrade) {
          setAiOpen(false);
          openUpgrade(data.error);
        } else {
          toast({ title: "Recipe chef is busy", description: data.error, variant: "destructive" });
        }
        return;
      }
      setRecipes((prev) => [data.recipe, ...prev]);
      setAiOpen(false);
      setIngredients("");
      setOpen(data.recipe);
      toast({ title: "Fresh recipe created! 👩‍🍳", description: "Saved to your library." });
    } catch {
      toast({ title: "Could not create recipe", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const parse = <T,>(s: string, fallback: T): T => {
    try {
      return JSON.parse(s) as T;
    } catch {
      return fallback;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-nunito)] font-black text-2xl md:text-3xl tracking-tight">Recipe Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kid-approved South African favourites{child?.allergies ? ` · filtered for ${child.name}'s allergies` : ""}.
          </p>
        </div>
        <Button onClick={() => setAiOpen(true)} className="nt-cta-gradient text-white rounded-full font-extrabold">
          <Wand2 className="mr-2 h-4 w-4" /> Recipe from my kitchen
        </Button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search recipes or ingredients…"
            className="rounded-full pl-10 h-11 bg-card"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto nt-scroll pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.v}
              onClick={() => setCategory(c.v)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                category === c.v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {c.e} {c.l}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56 rounded-3xl" />)}
        </div>
      ) : recipes.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="p-10 text-center">
            <span className="text-5xl">🔍</span>
            <p className="font-bold mt-3">No recipes match</p>
            <p className="text-sm text-muted-foreground">Try a different search or category.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((r) => {
            const rAllergens = (r.allergens || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
            const clash = rAllergens.filter((a) => childAllergens.some((ca) => a.includes(ca) || ca.includes(a)));
            const isAI = r.slug.includes("-");
            return (
              <Card
                key={r.id}
                className={`rounded-3xl border-border/70 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer ${clash.length ? "opacity-75" : ""}`}
                onClick={() => setOpen(r)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <span className="text-4xl">{r.emoji}</span>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge className="rounded-full bg-secondary text-foreground border-0 text-[10px] font-black uppercase tracking-wide">
                        {r.category}
                      </Badge>
                      {clash.length > 0 ? (
                        <Badge variant="outline" className="rounded-full text-[10px] font-black border-destructive/50 text-destructive">
                          ⚠ {clash.slice(0, 2).join(", ")}
                        </Badge>
                      ) : (
                        <Badge className="rounded-full bg-primary/10 text-primary border-0 text-[10px] font-black">✓ Allergy safe</Badge>
                      )}
                    </div>
                  </div>
                  <h3 className="font-[family-name:var(--font-nunito)] font-extrabold text-base mt-3 leading-snug">{r.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(r.tags || "").split(",").filter(Boolean).slice(0, 3).map((t) => (
                      <Badge key={t} variant="outline" className="rounded-full text-[10px] font-bold text-muted-foreground">
                        {t.trim()}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs font-bold text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{r.minutes} min</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{r.servings}</span>
                    <span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5" />{r.calories} kcal</span>
                    <span className="ml-auto text-primary font-black">{zar(r.costEst)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recipe detail dialog */}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="rounded-3xl max-w-lg max-h-[85vh] overflow-y-auto nt-scroll">
          {open && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <span className="text-5xl">{open.emoji}</span>
                  <Badge className="rounded-full bg-secondary text-foreground border-0 font-black uppercase">{open.category}</Badge>
                </div>
                <DialogTitle className="font-[family-name:var(--font-nunito)] font-black text-2xl mt-2">{open.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-4 text-xs font-bold pt-1">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{open.minutes} min</span>
                  <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />serves {open.servings}</span>
                  <span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5" />{open.calories} kcal</span>
                  <span className="text-primary font-black">{zar(open.costEst)}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { l: "Protein", v: `${open.protein}g` },
                  { l: "Carbs", v: `${open.carbs}g` },
                  { l: "Fat", v: `${open.fat}g` },
                  { l: "Cost", v: zar(open.costEst) },
                ].map((n) => (
                  <div key={n.l} className="rounded-xl bg-secondary/70 p-2.5 text-center">
                    <div className="text-[10px] font-black text-muted-foreground uppercase">{n.l}</div>
                    <div className="text-sm font-black mt-0.5">{n.v}</div>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="font-[family-name:var(--font-nunito)] font-extrabold text-sm mb-2.5">🧺 Ingredients</h4>
                <ul className="space-y-1.5 text-sm">
                  {parse<{ item: string; qty: string }[]>(open.ingredients, []).map((ing, i) => (
                    <li key={i} className="flex justify-between gap-3 rounded-lg bg-card px-3 py-2 border border-border/60">
                      <span className="font-semibold">{ing.item}</span>
                      <span className="text-muted-foreground font-bold shrink-0">{ing.qty}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-[family-name:var(--font-nunito)] font-extrabold text-sm mb-2.5">👩‍🍳 Method</h4>
                <ol className="space-y-2">
                  {parse<string[]>(open.instructions, []).map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-black shrink-0">{i + 1}</span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {open.allergens && (
                <div className="rounded-xl bg-destructive/5 border border-destructive/25 px-4 py-3">
                  <div className="text-xs font-black text-destructive uppercase tracking-wide">Contains allergens</div>
                  <div className="text-sm font-semibold mt-0.5">{open.allergens.split(",").map((s) => s.trim()).filter(Boolean).join(" · ")}</div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* AI recipe dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <div className="mx-auto h-14 w-14 rounded-2xl nt-cta-gradient grid place-items-center text-white text-2xl nt-float">
              <Sparkles />
            </div>
            <DialogTitle className="text-center font-[family-name:var(--font-nunito)] font-black text-2xl mt-2">
              What&rsquo;s in your kitchen?
            </DialogTitle>
            <DialogDescription className="text-center">
              List what you have and our AI chef creates a kid-friendly recipe around it
              {child ? ` — safe for ${child.name}'s allergies` : ""}.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder="e.g. mealie meal, eggs, tomatoes, spinach, cheese…"
            rows={4}
            className="w-full rounded-2xl border border-border bg-card p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {["mealie meal", "eggs", "tomatoes", "spinach", "chicken", "butternut", "beans", "bread"].map((ing) => (
              <button
                key={ing}
                onClick={() => setIngredients((p) => (p ? `${p}, ${ing}` : ing))}
                className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                + {ing}
              </button>
            ))}
          </div>
          <Button onClick={generateRecipe} disabled={generating} className="w-full nt-cta-gradient text-white rounded-full h-12 font-extrabold">
            {generating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
            Create my recipe
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
