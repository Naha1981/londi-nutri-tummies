"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore, zar, AVATAR_COLORS } from "@/store/useAppStore";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Pencil, Sparkles, CreditCard, ReceiptText, ShieldCheck, FileText } from "lucide-react";

const COLOR_CHOICES = ["emerald", "orange", "rose", "violet", "amber", "teal"] as const;
const COLOR_SWATCH: Record<string, string> = {
  emerald: "bg-emerald-400",
  orange: "bg-orange-400",
  rose: "bg-rose-400",
  violet: "bg-violet-400",
  amber: "bg-amber-400",
  teal: "bg-teal-400",
};

type EditState = {
  id?: string;
  name: string;
  ageYears: number;
  allergies: string;
  likes: string;
  dislikes: string;
  budgetPerWeek: number;
  avatarColor: string;
};

type OrderRow = {
  id: string;
  planLabel: string;
  amountCents: number;
  status: string;
  provider: string;
  createdAt: string;
};

const blank: EditState = {
  name: "",
  ageYears: 6,
  allergies: "",
  likes: "",
  dislikes: "",
  budgetPerWeek: 450,
  avatarColor: "emerald",
};

export function SettingsView() {
  const { user, children, upsertChild, removeChild, openUpgrade, openLegal, upgradeOpen } = useAppStore();
  const [edit, setEdit] = useState<EditState | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  // payment history — refetched when the upgrade dialog closes (a payment
  // may just have completed) and on mount
  useEffect(() => {
    if (upgradeOpen) return; // skip while dialog is open; refetch happens on close
    let cancelled = false;
    fetch("/api/billing/orders")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.orders) setOrders(d.orders);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [upgradeOpen]);
  const [saving, setSaving] = useState(false);

  const openNew = () => setEdit({ ...blank });

  const openEdit = (id: string) => {
    const c = children.find((x) => x.id === id);
    if (!c) return;
    setEdit({
      id: c.id,
      name: c.name,
      ageYears: c.ageYears,
      allergies: c.allergies,
      likes: c.likes,
      dislikes: c.dislikes,
      budgetPerWeek: c.budgetPerWeek,
      avatarColor: c.avatarColor,
    });
  };

  const save = async () => {
    if (!edit || !edit.name.trim()) {
      toast({ title: "Name needed", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(edit.id ? `/api/children/${edit.id}` : "/api/children", {
        method: edit.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: edit.name.trim(),
          ageYears: edit.ageYears,
          allergies: edit.allergies.trim(),
          likes: edit.likes.trim(),
          dislikes: edit.dislikes.trim(),
          budgetPerWeek: edit.budgetPerWeek,
          avatarColor: edit.avatarColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.upgrade) {
          setEdit(null);
          openUpgrade(data.error);
        } else {
          toast({ title: "Could not save", description: data.error, variant: "destructive" });
        }
        return;
      }
      upsertChild(data.child);
      setEdit(null);
      toast({ title: edit.id ? "Profile updated ✅" : `${data.child.name} added! 🎉` });
    } catch {
      toast({ title: "Could not save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteChild = async (id: string) => {
    const c = children.find((x) => x.id === id);
    if (!c) return;
    removeChild(id);
    setEdit(null);
    await fetch(`/api/children/${id}`, { method: "DELETE" }).catch(() => {});
    toast({ title: `${c.name}'s profile removed`, description: "Meal plans and diary entries were also removed." });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-[family-name:var(--font-nunito)] font-black text-2xl md:text-3xl tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Your family, your plan, your data.</p>
      </div>

      {/* Account */}
      <Card className="rounded-3xl border-border/70">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <span className="h-14 w-14 rounded-2xl bg-primary/15 grid place-items-center text-xl font-black text-primary">
                {user?.name?.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <div className="font-[family-name:var(--font-nunito)] font-black text-lg">{user?.name}</div>
                <div className="text-sm text-muted-foreground">{user?.email}</div>
                <Badge className="mt-1.5 rounded-full bg-accent text-accent-foreground border-0 font-black">
                  {user?.plan === "premium_trial" ? "🌟 14-day Premium Trial" : user?.plan === "premium" ? "⭐ Family Premium" : user?.plan === "pro" ? "👑 Crèche & Pro" : "🆓 Taster (Free)"}
                </Badge>
              </div>
            </div>
            {user?.plan === "free" ? (
              <Button onClick={() => openUpgrade()} className="nt-cta-gradient text-white rounded-full font-extrabold">
                <Sparkles className="mr-2 h-4 w-4" /> Upgrade to Premium
              </Button>
            ) : (
              <Button variant="outline" className="rounded-full font-bold" onClick={() => openUpgrade("Manage your subscription — upgrade, downgrade or cancel anytime.")}>
                <CreditCard className="mr-2 h-4 w-4" /> Manage subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subscription & receipts */}
      <Card className="rounded-3xl border-border/70">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="font-[family-name:var(--font-nunito)] font-black text-lg flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-primary" /> Subscription & receipts
              </h2>
              <p className="text-sm text-muted-foreground">Billing status and payment history.</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-2xl bg-secondary/60 border border-border/60 p-4">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Current plan</div>
              <div className="font-[family-name:var(--font-nunito)] font-black text-base mt-1">
                {user?.plan === "premium_trial" ? "Premium Trial" : user?.plan === "premium" ? "Family Premium" : user?.plan === "pro" ? "Pro" : "Free"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {user?.premiumUntil
                  ? `Renews / valid until ${new Date(user.premiumUntil).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}`
                  : user?.trialEndsAt
                    ? `Trial ends ${new Date(user.trialEndsAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long" })}`
                    : "No active subscription"}
              </div>
            </div>
            <div className="rounded-2xl bg-secondary/60 border border-border/60 p-4">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Payment method</div>
              <div className="font-[family-name:var(--font-nunito)] font-black text-base mt-1">Card via PayFast / Yoco</div>
              <div className="text-xs text-muted-foreground mt-1">Cancel anytime from here or by email.</div>
            </div>
          </div>

          {orders && orders.length > 0 ? (
            <div className="rounded-2xl border border-border/60 divide-y divide-border/60 max-h-56 overflow-y-auto nt-scroll">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-bold truncate">{o.planLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })} · {o.provider}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-extrabold">{zar(o.amountCents / 100)}</span>
                    <Badge
                      variant="outline"
                      className={`rounded-full font-bold capitalize ${
                        o.status === "paid" ? "text-primary border-primary/40" : o.status === "pending" ? "text-amber-600 border-amber-300" : "text-muted-foreground"
                      }`}
                    >
                      {o.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No payments yet — receipts appear here after your first subscription.</p>
          )}
        </CardContent>
      </Card>

      {/* Children */}
      <Card className="rounded-3xl border-border/70">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-[family-name:var(--font-nunito)] font-black text-lg">Little tummies</h2>
              <p className="text-sm text-muted-foreground">{children.length} {children.length === 1 ? "child" : "children"} on your plan</p>
            </div>
            <Button onClick={openNew} className="nt-cta-gradient text-white rounded-full font-extrabold">
              <Plus className="mr-1.5 h-4 w-4" /> Add child
            </Button>
          </div>
          <div className="space-y-3">
            {children.map((c) => (
              <div key={c.id} className="flex items-center gap-3.5 rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/40 transition-colors">
                <span className={`h-11 w-11 rounded-full ${AVATAR_COLORS[c.avatarColor]?.bg ?? "bg-emerald-100"} grid place-items-center text-sm font-black ${AVATAR_COLORS[c.avatarColor]?.text ?? "text-emerald-700"} ring-2 ${AVATAR_COLORS[c.avatarColor]?.ring ?? "ring-emerald-300"}`}>
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-sm">{c.name}</div>
                  <div className="text-xs text-muted-foreground font-semibold">
                    {c.ageYears} yrs · {zar(c.budgetPerWeek)}/wk{c.allergies ? ` · ⛔ ${c.allergies}` : ""}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => openEdit(c.id)} aria-label={`Edit ${c.name}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {children.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No children yet — add one to unlock meal plans.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Privacy note */}
      <Card className="rounded-3xl border-border/70 bg-secondary/40">
        <CardContent className="p-5 text-sm text-muted-foreground leading-relaxed">
          🔒 <strong className="text-foreground">Your data stays yours.</strong> Profiles, diaries and chats are
          private to your account, never sold, and processed in line with POPIA. Delete a child to
          erase their plans and diary instantly.
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
            <button onClick={() => openLegal("privacy")} className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline">
              <ShieldCheck className="h-4 w-4" /> Privacy Policy (POPIA)
            </button>
            <button onClick={() => openLegal("terms")} className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline">
              <FileText className="h-4 w-4" /> Terms of Use
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Edit / add dialog */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="rounded-3xl max-w-lg max-h-[85vh] overflow-y-auto nt-scroll">
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-nunito)] font-black text-xl">
              {edit?.id ? "Edit child profile" : "Add a child"}
            </DialogTitle>
            <DialogDescription>Tastes change — keep this fresh for better meal plans.</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-bold text-sm">Name</Label>
                  <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="rounded-xl h-11" maxLength={40} />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-sm">Age: <span className="text-primary">{edit.ageYears} years</span></Label>
                  <Slider value={[edit.ageYears]} onValueChange={(v) => setEdit({ ...edit, ageYears: v[0] })} min={1} max={17} step={1} className="mt-4" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-sm">Allergies (comma separated — strictly avoided)</Label>
                <Input value={edit.allergies} onChange={(e) => setEdit({ ...edit, allergies: e.target.value })} placeholder="e.g. peanuts, egg" className="rounded-xl h-11" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-bold text-sm">Loves eating 😍</Label>
                  <Input value={edit.likes} onChange={(e) => setEdit({ ...edit, likes: e.target.value })} className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold text-sm">Refuses to eat 😤</Label>
                  <Input value={edit.dislikes} onChange={(e) => setEdit({ ...edit, dislikes: e.target.value })} className="rounded-xl h-11" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-sm">Weekly budget: <span className="text-primary">{zar(edit.budgetPerWeek)}</span></Label>
                <Slider value={[edit.budgetPerWeek]} onValueChange={(v) => setEdit({ ...edit, budgetPerWeek: v[0] })} min={150} max={2000} step={50} className="mt-4" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-sm">Avatar colour</Label>
                <div className="flex gap-2.5">
                  {COLOR_CHOICES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEdit({ ...edit, avatarColor: c })}
                      aria-label={`Colour ${c}`}
                      className={`h-9 w-9 rounded-full ${COLOR_SWATCH[c]} transition-all ${edit.avatarColor === c ? "ring-4 ring-offset-2 ring-primary/50 scale-110" : "opacity-70 hover:opacity-100"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2.5 pt-2">
                <Button onClick={save} disabled={saving} className="flex-1 nt-cta-gradient text-white rounded-full font-extrabold h-11">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : edit.id ? "Save changes" : "Add child"}
                </Button>
                {edit.id && (
                  <Button variant="outline" onClick={() => deleteChild(edit.id!)} className="rounded-full h-11 text-destructive hover:text-destructive font-bold" aria-label="Delete child">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
