"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore, todayISO, SLOT_ICONS, AVATAR_COLORS } from "@/store/useAppStore";
import { toast } from "@/hooks/use-toast";
import { Plus, Loader2, Trash2, Star, NotebookPen, ChevronLeft, ChevronRight, Utensils } from "lucide-react";

type Entry = {
  id: string;
  childId: string;
  date: string;
  slot: string;
  what: string;
  servings: number;
  rating: number | null;
  notes: string | null;
  calories: number | null;
};

const SLOTS = ["breakfast", "lunch", "snack", "dinner"];

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function DiaryView() {
  const { children, activeChildId } = useAppStore();
  const child = children.find((c) => c.id === activeChildId) ?? children[0];
  const [date, setDate] = useState(todayISO());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  // add form state
  const [slot, setSlot] = useState("breakfast");
  const [what, setWhat] = useState("");
  const [rating, setRating] = useState(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!child) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/diary?childId=${child.id}&from=${date}&to=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setEntries(data.entries ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [child?.id, date]);

  const save = async () => {
    if (!child || !what.trim()) {
      toast({ title: "What did they eat?", description: "Even 'half a slice of bread' counts!", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: child.id, date, slot, what: what.trim(), rating, servings: 1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not save", description: data.error, variant: "destructive" });
        return;
      }
      setEntries((prev) => [...prev, data.entry]);
      setWhat("");
      setAdding(null);
      toast({ title: "Logged! 📝", description: `Added to ${formatDate(date)}'s diary.` });
    } catch {
      toast({ title: "Could not save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/diary/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const dayAvg = entries.length
    ? (entries.reduce((s, e) => s + (e.rating ?? 3), 0) / entries.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-nunito)] font-black text-2xl md:text-3xl tracking-tight">Food Diary</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {child ? `What ${child.name} actually ate` : "Pick a child first"} — judge-free zone.
          </p>
        </div>
        <Button onClick={() => setAdding(slot)} className="nt-cta-gradient text-white rounded-full font-extrabold">
          <Plus className="mr-2 h-4 w-4" /> Log a meal
        </Button>
      </div>

      {/* Date navigator */}
      <Card className="rounded-3xl border-border/70">
        <CardContent className="p-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setDate(shiftDate(date, -1))} className="rounded-full h-10 w-10" aria-label="Previous day">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <div className="font-[family-name:var(--font-nunito)] font-black text-lg">
              {date === todayISO() ? "Today" : formatDate(date)}
            </div>
            <div className="text-xs text-muted-foreground font-semibold">
              {entries.length} {entries.length === 1 ? "entry" : "entries"} · avg happiness {dayAvg} 😊
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDate(shiftDate(date, 1))}
            disabled={date >= todayISO()}
            className="rounded-full h-10 w-10"
            aria-label="Next day"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </CardContent>
      </Card>

      {/* Add form */}
      {adding && (
        <Card className="rounded-3xl border-primary/40 ring-2 ring-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-[family-name:var(--font-nunito)] font-extrabold">Log for {formatDate(date)}</h3>
              <Button variant="ghost" size="sm" onClick={() => setAdding(null)} className="rounded-full">Cancel</Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-black text-muted-foreground uppercase tracking-wide">Meal</div>
                <div className="flex flex-wrap gap-2">
                  {SLOTS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSlot(s)}
                      className={`rounded-full border px-3.5 py-2 text-xs font-bold transition-colors ${
                        slot === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      {SLOT_ICONS[s]} {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-black text-muted-foreground uppercase tracking-wide">How well did they eat?</div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button key={r} onClick={() => setRating(r)} aria-label={`${r} stars`} className="transition-transform hover:scale-110">
                      <Star className={`h-7 w-7 ${r <= rating ? "fill-amber-400 text-amber-400" : "text-border"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <div className="text-xs font-black text-muted-foreground uppercase tracking-wide">What was served / eaten</div>
                <input
                  value={what}
                  onChange={(e) => setWhat(e.target.value)}
                  placeholder="e.g. hidden-veg mac & cheese — ate most of it, pushed peas aside"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  maxLength={200}
                />
              </div>
            </div>
            <Button onClick={save} disabled={saving} className="mt-4 w-full sm:w-auto nt-cta-gradient text-white rounded-full font-extrabold">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <NotebookPen className="mr-2 h-4 w-4" />}
              Save entry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Entries */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : entries.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="p-10 text-center">
            <span className="text-5xl">🍽️</span>
            <h3 className="font-[family-name:var(--font-nunito)] font-black text-lg mt-4">Nothing logged for this day</h3>
            <p className="text-sm text-muted-foreground mt-1.5">
              Tap &ldquo;Log a meal&rdquo; — over time you&rsquo;ll spot patterns (like Tuesday&rsquo;s mysterious veggie strike).
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {[...entries]
            .sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot))
            .map((e) => (
              <Card key={e.id} className="rounded-2xl border-border/70 group">
                <CardContent className="p-4 flex items-center gap-4">
                  <span className="h-11 w-11 rounded-xl bg-secondary grid place-items-center text-xl shrink-0">
                    {SLOT_ICONS[e.slot] ?? "🍽️"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="rounded-full text-[10px] font-black uppercase tracking-wide">{e.slot}</Badge>
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < (e.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-border"}`} />
                        ))}
                      </div>
                    </div>
                    <div className="text-sm font-semibold mt-1 leading-snug">{e.what}</div>
                  </div>
                  <button
                    onClick={() => remove(e.id)}
                    className="opacity-0 group-hover:opacity-100 h-9 w-9 grid place-items-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
          <div className="text-center text-xs text-muted-foreground font-semibold pt-2">
            <Utensils className="inline h-3.5 w-3.5 mr-1" />
            Logging daily builds the weekly insight your family deserves.
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
