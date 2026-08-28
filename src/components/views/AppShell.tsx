"use client";

import { useEffect } from "react";
import { useAppStore, AVATAR_COLORS, type Tab } from "@/store/useAppStore";
import { DashboardView } from "./DashboardView";
import { PlannerView } from "./PlannerView";
import { RecipesView } from "./RecipesView";
import { DiaryView } from "./DiaryView";
import { ShoppingView } from "./ShoppingView";
import { CoachView } from "./CoachView";
import { SettingsView } from "./SettingsView";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sprout, LayoutDashboard, CalendarDays, ChefHat, NotebookPen, ShoppingCart,
  MessageCircleHeart, Settings, LogOut, Loader2,
} from "lucide-react";

const NAV: { id: Tab; label: string; icon: typeof LayoutDashboard; emoji: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, emoji: "🏠" },
  { id: "planner", label: "Meal Planner", icon: CalendarDays, emoji: "🗓️" },
  { id: "recipes", label: "Recipes", icon: ChefHat, emoji: "👩‍🍳" },
  { id: "diary", label: "Food Diary", icon: NotebookPen, emoji: "📝" },
  { id: "shopping", label: "Shopping", icon: ShoppingCart, emoji: "🛒" },
  { id: "coach", label: "Coach Nandi", icon: MessageCircleHeart, emoji: "💬" },
  { id: "settings", label: "Settings", icon: Settings, emoji: "⚙️" },
];

export function AppShell() {
  const { user, children, tab, setTab, logout, view, booted } = useAppStore();

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0 });
    }
  }, [tab]);

  if (view === "app" && !booted) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground font-semibold">Setting the table…</p>
        </div>
      </div>
    );
  }

  const activeChild = children.find((c) => c.id === useAppStore.getState().activeChildId) ?? children[0];

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    logout();
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar">
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl nt-cta-gradient grid place-items-center text-white shadow-sm">
              <Sprout className="h-5 w-5" />
            </span>
            <span className="font-[family-name:var(--font-nunito)] font-extrabold leading-tight">
              Nutri<span className="text-primary">Tummies</span>
            </span>
          </div>
          {user && (
            <div className="mt-4 flex items-center gap-2.5 bg-card rounded-xl p-2.5 border border-border/60">
              <span className="h-9 w-9 rounded-full bg-primary/15 grid place-items-center text-sm font-black text-primary">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-extrabold truncate">{user.name}</div>
                <Badge className="text-[10px] px-1.5 py-0 h-4 rounded-full bg-accent text-accent-foreground border-0 font-black">
                  {user.plan === "premium_trial" ? "TRIAL" : user.plan.toUpperCase()}
                </Badge>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto nt-scroll">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors ${
                tab === item.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {item.label}
              {item.id === "coach" && <span className="ml-auto text-xs">✨</span>}
            </button>
          ))}
        </nav>

        {activeChild && (
          <div className="p-4 border-t border-border/60">
            <div className="text-[11px] font-black text-muted-foreground uppercase tracking-wide mb-2">Feeding</div>
            <div className="flex items-center gap-2.5">
              <span className={`h-9 w-9 rounded-full ${AVATAR_COLORS[activeChild.avatarColor]?.bg ?? "bg-emerald-100"} grid place-items-center text-sm font-black ${AVATAR_COLORS[activeChild.avatarColor]?.text ?? "text-emerald-700"} ring-2 ${AVATAR_COLORS[activeChild.avatarColor]?.ring ?? "ring-emerald-300"}`}>
                {activeChild.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="text-sm font-extrabold">{activeChild.name}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="mt-4 w-full justify-start rounded-xl text-muted-foreground hover:text-destructive font-bold"
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border/60">
          <div className="px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg nt-cta-gradient grid place-items-center text-white">
                <Sprout className="h-4 w-4" />
              </span>
              <span className="font-[family-name:var(--font-nunito)] font-extrabold text-sm">
                Nutri<span className="text-primary">Tummies</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <Badge className="rounded-full bg-accent text-accent-foreground border-0 font-black text-[10px]">
                  {user.plan === "premium_trial" ? "TRIAL" : user.plan.toUpperCase()}
                </Badge>
              )}
              <button onClick={handleLogout} aria-label="Sign out" className="h-9 w-9 grid place-items-center rounded-full text-muted-foreground hover:bg-accent">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-7 max-w-6xl mx-auto">
          {tab === "dashboard" && <DashboardView />}
          {tab === "planner" && <PlannerView />}
          {tab === "recipes" && <RecipesView />}
          {tab === "diary" && <DiaryView />}
          {tab === "shopping" && <ShoppingView />}
          {tab === "coach" && <CoachView />}
          {tab === "settings" && <SettingsView />}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-border/60 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-6">
          {NAV.filter((n) => n.id !== "settings").map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                tab === item.id ? "text-primary" : "text-muted-foreground"
              }`}
              aria-label={item.label}
            >
              <span className="text-lg leading-none">{item.emoji}</span>
              <span className="text-[9px] font-bold leading-tight">{item.label.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </nav>

      <UpgradeDialog />
    </div>
  );
}
