"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore, zar } from "@/store/useAppStore";
import { toast } from "@/hooks/use-toast";
import { Plus, Loader2, Trash2, ShoppingCart, Check, Sparkles, CircleCheck } from "lucide-react";

type Item = {
  id: string;
  name: string;
  qty: string;
  category: string;
  estCost: number | null;
  checked: boolean;
};

const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  Produce: { emoji: "🥬", color: "bg-green-100" },
  Protein: { emoji: "🍗", color: "bg-rose-100" },
  Dairy: { emoji: "🥛", color: "bg-sky-100" },
  "Dry Goods": { emoji: "🌾", color: "bg-amber-100" },
  Bakery: { emoji: "🍞", color: "bg-orange-100" },
  Frozen: { emoji: "🧊", color: "bg-cyan-100" },
  Other: { emoji: "🛍️", color: "bg-violet-100" },
};

export function ShoppingView() {
  const { setTab } = useAppStore();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/shopping")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setItems(data.items ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addItem = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), qty: qty.trim(), category: "Other" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not add", description: data.error, variant: "destructive" });
        return;
      }
      const refreshed = await fetch("/api/shopping").then((r) => r.json());
      setItems(refreshed.items ?? []);
      setName("");
      setQty("");
    } catch {
      toast({ title: "Could not add", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (item: Item) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)));
    await fetch("/api/shopping", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, checked: !item.checked }),
    }).catch(() => {});
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/shopping?mode=${id}`, { method: "DELETE" }).catch(() => {});
  };

  const clearChecked = async () => {
    setItems((prev) => prev.filter((i) => !i.checked));
    await fetch("/api/shopping?mode=checked", { method: "DELETE" }).catch(() => {});
    toast({ title: "Cleared ticked items 🧾", description: "Well done, shopper!" });
  };

  const byCategory = items.reduce<Record<string, Item[]>>((acc, item) => {
    const cat = item.category || "Other";
    (acc[cat] ||= []).push(item);
    return acc;
  }, {});

  const total = items.filter((i) => !i.checked).reduce((s, i) => s + (i.estCost ?? 0), 0);
  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-nunito)] font-black text-2xl md:text-3xl tracking-tight">Smart Shopping List</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Built from your meal plan, priced like your local shop.
          </p>
        </div>
        <Button variant="outline" onClick={() => setTab("planner")} className="rounded-full font-bold">
          <Sparkles className="mr-2 h-4 w-4" /> Build from meal plan
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: "Still to buy", v: `${items.length - checkedCount}`, e: "🛒" },
          { l: "Estimated total", v: zar(total), e: "💰" },
          { l: "In the trolley", v: `${checkedCount}`, e: "✅" },
        ].map((s) => (
          <Card key={s.l} className="rounded-2xl border-border/70">
            <CardContent className="p-4">
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{s.e} {s.l}</div>
              <div className="font-[family-name:var(--font-nunito)] font-black text-xl mt-1 text-primary">{s.v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add item */}
      <Card className="rounded-3xl border-border/70">
        <CardContent className="p-4 flex gap-2.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="Add item… e.g. Imasi"
            className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            maxLength={80}
          />
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Qty"
            className="w-24 rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            maxLength={30}
          />
          <Button onClick={addItem} disabled={saving || !name.trim()} className="rounded-xl nt-cta-gradient text-white font-extrabold px-4">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </CardContent>
      </Card>

      {/* Items */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="p-10 text-center">
            <span className="text-5xl">🛒</span>
            <h3 className="font-[family-name:var(--font-nunito)] font-black text-lg mt-4">Your list is empty</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
              Generate a meal plan and tap &ldquo;Build shopping list&rdquo; — or add items by hand above.
            </p>
            <Button onClick={() => setTab("planner")} className="mt-5 nt-cta-gradient text-white rounded-full font-bold">
              Go to meal planner
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {Object.entries(byCategory).map(([cat, list]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`h-8 w-8 rounded-xl ${CATEGORY_META[cat]?.color ?? "bg-violet-100"} grid place-items-center text-base`}>
                  {CATEGORY_META[cat]?.emoji ?? "🛍️"}
                </span>
                <h3 className="font-[family-name:var(--font-nunito)] font-extrabold text-sm">{cat}</h3>
                <Badge variant="outline" className="rounded-full text-[10px] font-bold text-muted-foreground">{list.length}</Badge>
              </div>
              <div className="space-y-2">
                {list.map((item) => (
                  <div
                    key={item.id}
                    className={`group flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 transition-all ${
                      item.checked ? "border-border/50 opacity-60" : "border-border/70 hover:border-primary/40"
                    }`}
                  >
                    <button
                      onClick={() => toggle(item)}
                      className={`h-6 w-6 rounded-full border-2 grid place-items-center shrink-0 transition-colors ${
                        item.checked ? "bg-primary border-primary text-white" : "border-border hover:border-primary"
                      }`}
                      aria-label={item.checked ? "Mark as not bought" : "Mark as bought"}
                    >
                      {item.checked && <Check className="h-3.5 w-3.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-bold ${item.checked ? "line-through" : ""}`}>{item.name}</div>
                      {item.qty && <div className="text-xs text-muted-foreground font-semibold">{item.qty}</div>}
                    </div>
                    {item.estCost != null && item.estCost > 0 && (
                      <div className="text-sm font-black text-primary shrink-0">{zar(item.estCost)}</div>
                    )}
                    <button
                      onClick={() => remove(item.id)}
                      className="opacity-0 group-hover:opacity-100 h-8 w-8 grid place-items-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {checkedCount > 0 && (
            <Button variant="outline" onClick={clearChecked} className="w-full rounded-2xl font-bold">
              <CircleCheck className="mr-2 h-4 w-4 text-primary" /> Clear {checkedCount} ticked {checkedCount === 1 ? "item" : "items"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
