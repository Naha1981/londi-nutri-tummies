"use client";

// Nutri Tummies — global client store (Zustand)
// Holds session state, active view routing, and the selected child context.

import { create } from "zustand";

export type View = "landing" | "auth" | "onboarding" | "app";
export type Tab = "dashboard" | "planner" | "recipes" | "diary" | "shopping" | "coach" | "settings";

export type User = {
  id: string;
  name: string;
  email: string;
  plan: string;
  trialEndsAt: string | null;
  premiumUntil: string | null;
};

export type Child = {
  id: string;
  name: string;
  ageYears: number;
  sex: string;
  allergies: string;
  dislikes: string;
  likes: string;
  budgetPerWeek: number;
  activityLevel: string;
  avatarColor: string;
  createdAt: string;
};

export type Entitlements = {
  maxChildren: number;
  maxPlansPerWeek: number;
  coachMessagesPerDay: number;
  aiRecipes: boolean;
  label: string;
};

type AppState = {
  view: View;
  tab: Tab;
  user: User | null;
  children: Child[];
  entitlements: Entitlements | null;
  activeChildId: string | null;
  authMode: "signin" | "signup";
  upgradeOpen: boolean;
  upgradeReason: string;
  legalDoc: "privacy" | "terms" | null;
  booted: boolean;

  setView: (v: View) => void;
  setTab: (t: Tab) => void;
  setAuthMode: (m: "signin" | "signup") => void;
  setBooted: (b: boolean) => void;
  setSession: (user: User | null, children?: Child[], entitlements?: Entitlements | null) => void;
  logout: () => void;
  setActiveChild: (id: string | null) => void;
  upsertChild: (c: Child) => void;
  removeChild: (id: string) => void;
  openUpgrade: (reason?: string) => void;
  closeUpgrade: () => void;
  openLegal: (doc: "privacy" | "terms") => void;
  closeLegal: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  view: "landing",
  tab: "dashboard",
  user: null,
  children: [],
  entitlements: null,
  activeChildId: null,
  authMode: "signup",
  upgradeOpen: false,
  upgradeReason: "",
  legalDoc: null,
  booted: false,

  setView: (v) => set({ view: v }),
  setTab: (t) => set({ tab: t }),
  setAuthMode: (m) => set({ authMode: m }),
  setBooted: (b) => set({ booted: b }),

  setSession: (user, children = [], entitlements = null) =>
    set((s) => ({
      user,
      children,
      entitlements,
      view: user ? (children.length > 0 ? "app" : "onboarding") : "landing",
      activeChildId: children.length > 0 ? children[0].id : null,
      tab: user && children.length > 0 ? s.tab : "dashboard",
    })),

  logout: () =>
    set({
      user: null,
      children: [],
      entitlements: null,
      activeChildId: null,
      view: "landing",
      tab: "dashboard",
    }),

  setActiveChild: (id) => set({ activeChildId: id }),

  upsertChild: (c) =>
    set((s) => {
      const exists = s.children.some((x) => x.id === c.id);
      const children = exists ? s.children.map((x) => (x.id === c.id ? c : x)) : [...s.children, c];
      return { children, activeChildId: s.activeChildId ?? c.id };
    }),

  removeChild: (id) =>
    set((s) => {
      const children = s.children.filter((c) => c.id !== id);
      return {
        children,
        activeChildId: s.activeChildId === id ? (children[0]?.id ?? null) : s.activeChildId,
      };
    }),

  openUpgrade: (reason = "") => set({ upgradeOpen: true, upgradeReason: reason }),
  closeUpgrade: () => set({ upgradeOpen: false, upgradeReason: "" }),
  openLegal: (doc) => set({ legalDoc: doc }),
  closeLegal: () => set({ legalDoc: null }),
}));

export function zar(n: number | null | undefined): string {
  const v = Number(n) || 0;
  return `R${v.toLocaleString("en-ZA")}`;
}

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const SLOT_ICONS: Record<string, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍎",
};

export const AVATAR_COLORS: Record<string, { bg: string; ring: string; text: string }> = {
  emerald: { bg: "bg-emerald-100", ring: "ring-emerald-300", text: "text-emerald-700" },
  orange: { bg: "bg-orange-100", ring: "ring-orange-300", text: "text-orange-700" },
  rose: { bg: "bg-rose-100", ring: "ring-rose-300", text: "text-rose-700" },
  violet: { bg: "bg-violet-100", ring: "ring-violet-300", text: "text-violet-700" },
  amber: { bg: "bg-amber-100", ring: "ring-amber-300", text: "text-amber-700" },
  teal: { bg: "bg-teal-100", ring: "ring-teal-300", text: "text-teal-700" },
};

export function mondayOf(d = new Date()): string {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function todayIndex(): number {
  return (new Date().getDay() + 6) % 7; // 0 = Monday
}
