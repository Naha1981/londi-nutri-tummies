"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAppStore } from "@/store/useAppStore";
import {
  Sprout, UtensilsCrossed, MessageCircleHeart, ShoppingCart, ShieldCheck, LineChart,
  Check, Star, ArrowRight, Heart, Leaf, Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: UtensilsCrossed,
    title: "AI Weekly Meal Plans",
    desc: "Personalised 7-day plans built around your child's age, tastes, allergies — and your Rand budget. Regenerate any day you don't like.",
    emoji: "🍱",
  },
  {
    icon: MessageCircleHeart,
    title: "Picky Eater Coach",
    desc: "Coach Nandi, our AI nutrition coach, answers your fussy-eating questions with practical, local, no-judgement advice.",
    emoji: "💬",
  },
  {
    icon: ShoppingCart,
    title: "Smart Shopping Lists",
    desc: "One tap turns the week's plan into a consolidated grocery list with realistic Shoprite-level price estimates.",
    emoji: "🛒",
  },
  {
    icon: LineChart,
    title: "Nutrition Tracking",
    desc: "A simple food diary shows what each child actually ate, with happy-eating ratings and gentle weekly insights.",
    emoji: "📈",
  },
  {
    icon: ShieldCheck,
    title: "Allergy-Safe by Design",
    desc: "Declare allergies once. Every plan, recipe and snack suggestion is filtered before it ever reaches your child's plate.",
    emoji: "🛡️",
  },
  {
    icon: Sparkles,
    title: "Recipes From Your Kitchen",
    desc: "Type what's in the cupboard — get a kid-approved South African recipe in seconds. Pap, wors, bobotie, amagwinya and more.",
    emoji: "✨",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Tell us about your little one",
    desc: "Age, likes, dislikes, allergies and weekly budget. Takes two minutes — no forms marathon.",
    emoji: "🧒",
  },
  {
    n: "2",
    title: "Get your AI meal plan",
    desc: "A balanced week of breakfasts, lunches, dinners and snacks — priced for your pocket, flavoured for your home.",
    emoji: "🗓️",
  },
  {
    n: "3",
    title: "Shop, cook, breathe easier",
    desc: "Auto-built shopping list, simple recipes, and a coach on standby for the 'not eating my veggies' days.",
    emoji: "😌",
  },
];

const TESTIMONIALS = [
  {
    name: "Thandi M.",
    place: "Soweto, Johannesburg",
    quote:
      "My 6-year-old refused anything green. Coach Nandi's 'tiny portion next to favourite food' trick worked in two weeks. The shopping list keeps me under R500 a week.",
    stars: 5,
    emoji: "👩🏽",
  },
  {
    name: "Sipho N.",
    place: "Umlazi, Durban",
    quote:
      "Two kids, different allergies. Nutri Tummies flags everything automatically — I stopped double-checking labels at 7pm in the shop. Worth every cent.",
    stars: 5,
    emoji: "👨🏾",
  },
  {
    name: "Aisha P.",
    place: "Rylands, Cape Town",
    quote:
      "The meal plans use food we actually eat — pap, breyani-style Sundays, fish fingers. It feels like it was built for us, because it was.",
    stars: 5,
    emoji: "🧕🏽",
  },
];

const FAQS = [
  {
    q: "Is Nutri Tummies only for South African families?",
    a: "It's built for South African families first — local foods, local prices in Rand, and advice that fits our reality. It works anywhere, but the recipes and budgeting speak home language.",
  },
  {
    q: "How does the allergy safety work?",
    a: "You declare each child's allergies once during setup. The AI meal planner is instructed to never include them, and our library recipes are tagged with allergens that get filtered automatically. Always double-check ingredients at home — and for serious allergies, follow your doctor's guidance.",
  },
  {
    q: "What does the free plan include?",
    a: "The Free plan covers one child, one AI meal plan per week, the full recipe library, the food diary and shopping lists, plus 5 coach messages a day. Premium unlocks unlimited everything.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No lock-in contracts, no cancellation fees. Cancel from your account settings and you keep access until the end of your billing month.",
  },
  {
    q: "Does it replace a dietitian or doctor?",
    a: "No. Nutri Tummies is a planning and coaching tool for everyday healthy eating. It never diagnoses conditions — for growth, weight or health concerns, always see your clinic or doctor.",
  },
];

export function Landing() {
  const { user, setView, setAuthMode, setTab } = useAppStore();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const startFree = () => {
    if (user) {
      setTab("dashboard");
      setView("app");
    } else {
      setAuthMode("signup");
      setView("auth");
    }
  };

  const price = (m: number) => (billing === "yearly" ? Math.round(m * 10) : m);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ---------- NAV ---------- */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl nt-cta-gradient grid place-items-center text-white shadow-sm">
              <Sprout className="h-5 w-5" />
            </span>
            <span className="font-[family-name:var(--font-nunito)] font-extrabold text-lg tracking-tight">
              Nutri<span className="text-primary">Tummies</span>
            </span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Button onClick={() => setView("app")} className="rounded-full font-bold">
                Open my dashboard <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="rounded-full font-bold hidden sm:inline-flex"
                  onClick={() => { setAuthMode("signin"); setView("auth"); }}
                >
                  Sign in
                </Button>
                <Button onClick={startFree} className="rounded-full font-bold">
                  Start free
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---------- HERO ---------- */}
      <section id="top" className="nt-hero-gradient relative overflow-hidden">
        <div className="absolute inset-0 nt-dot-pattern opacity-60" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-16 md:pt-20 md:pb-24 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <Badge className="mb-5 rounded-full px-4 py-1.5 text-xs font-bold bg-accent text-accent-foreground border-0">
              🇿🇦 Built for South African families
            </Badge>
            <h1 className="font-[family-name:var(--font-nunito)] font-black text-4xl sm:text-5xl md:text-[3.4rem] leading-[1.05] tracking-tight">
              Healthy tummies.
              <br />
              Happy kids.
              <br />
              <span className="text-primary">No more mealtime battles.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-lg">
              Nutri Tummies plans a full week of balanced, budget-friendly meals your child will
              actually eat — then builds the shopping list, guards the allergies, and coaches you
              through the fussy days.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Button size="lg" onClick={startFree} className="nt-cta-gradient text-white rounded-full text-base font-extrabold h-13 px-8 shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                Start free — no card needed <ArrowRight className="ml-1 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full text-base font-bold h-13 px-8 bg-background/70"
                onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
              >
                See how it works
              </Button>
            </div>
            <div className="mt-7 flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex -space-x-2.5">
                {["👩🏽", "👨🏾", "🧕🏽", "👩🏿", "👨🏼"].map((e) => (
                  <span key={e} className="h-9 w-9 rounded-full bg-secondary grid place-items-center text-lg ring-2 ring-background">{e}</span>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 font-bold text-foreground">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                  <span className="ml-1">4.9</span>
                </div>
                <span>Loved by 12,000+ SA parents</span>
              </div>
            </div>
          </div>

          {/* Hero visual — meal cards collage */}
          <div className="relative hidden lg:block">
            <div className="nt-float absolute -top-4 left-6 z-10 bg-card rounded-2xl shadow-xl border border-border/70 px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">🥣</span>
              <div>
                <div className="text-xs font-bold">Creamy Mealie Pap</div>
                <div className="text-[11px] text-muted-foreground">Breakfast · R14 · 15 min</div>
              </div>
            </div>
            <div className="nt-float absolute top-24 -left-2 z-20 bg-card rounded-2xl shadow-xl border border-border/70 px-4 py-3 flex items-center gap-3" style={{ animationDelay: "0.8s" }}>
              <span className="text-2xl">🍛</span>
              <div>
                <div className="text-xs font-bold">Mild Bobotie</div>
                <div className="text-[11px] text-muted-foreground">Dinner · R48 · kid approved</div>
              </div>
            </div>
            <div className="nt-float absolute bottom-8 right-2 z-10 bg-card rounded-2xl shadow-xl border border-border/70 px-4 py-3 flex items-center gap-3" style={{ animationDelay: "1.6s" }}>
              <span className="text-2xl">🛒</span>
              <div>
                <div className="text-xs font-bold">Week's shopping</div>
                <div className="text-[11px] text-muted-foreground">R438 · under budget ✓</div>
              </div>
            </div>
            <div className="nt-float absolute -bottom-2 left-16 z-20 bg-card rounded-2xl shadow-xl border border-border/70 px-4 py-3 flex items-center gap-3" style={{ animationDelay: "2.2s" }}>
              <span className="text-2xl">💬</span>
              <div>
                <div className="text-xs font-bold">Coach Nandi says</div>
                <div className="text-[11px] text-muted-foreground">&ldquo;One new food, tiny portion…&rdquo;</div>
              </div>
            </div>
            <div className="bg-card rounded-[2rem] shadow-2xl border border-border/60 p-6 relative">
              <div className="rounded-2xl bg-secondary/70 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-[family-name:var(--font-nunito)] font-extrabold">This week for <span className="text-primary">Londi, 6</span></div>
                  <Badge className="rounded-full bg-primary text-primary-foreground border-0 font-bold">Plan ready</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { e: "🌅", m: "Breakfast", d: "Banana oat pancakes" },
                    { e: "☀️", m: "Lunch", d: "Mini bunny chow" },
                    { e: "🌙", m: "Dinner", d: "Hidden-veg mac & cheese" },
                    { e: "🍎", m: "Snack", d: "Fruit & yoghurt cup" },
                  ].map((x) => (
                    <div key={x.m} className="bg-card rounded-xl p-3 border border-border/60">
                      <div className="text-[11px] font-bold text-muted-foreground">{x.e} {x.m}</div>
                      <div className="text-sm font-bold mt-0.5 leading-snug">{x.d}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between bg-card rounded-xl p-3 border border-dashed border-primary/40">
                  <div className="text-xs font-semibold text-muted-foreground">Weekly budget</div>
                  <div className="text-sm font-extrabold text-primary">R438 <span className="text-muted-foreground font-semibold">/ R450</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* stats bar */}
        <div className="relative border-t border-border/60 bg-card/70 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { v: "12,400+", l: "families fed better" },
              { v: "1.2M", l: "meals planned" },
              { v: "R180", l: "avg. weekly savings" },
              { v: "28", l: "allergy-safe plans/week" },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-[family-name:var(--font-nunito)] font-black text-2xl md:text-3xl text-primary">{s.v}</div>
                <div className="text-xs md:text-sm text-muted-foreground font-semibold mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- PAIN POINTS ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <Badge variant="outline" className="rounded-full mb-4 border-primary/40 text-primary font-bold">Sound familiar?</Badge>
          <h2 className="font-[family-name:var(--font-nunito)] font-black text-3xl md:text-4xl tracking-tight">
            Feeding kids well is a full-time job you never applied for
          </h2>
        </div>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { e: "🥦", t: "&ldquo;Not eating that!&rdquo;", d: "The 6pm standoff over one piece of broccoli — again." },
            { e: "💸", t: "Food costs keep climbing", d: "You buy vegetables, they rot. Repeat every week." },
            { e: "🤔", t: "Same 3 meals on repeat", d: "Pap. Chicken. Rice. Pap. Chicken. Rice." },
            { e: "⚠️", t: "Allergy anxiety", d: "Every label, every meal, every granny needs a briefing." },
          ].map((p) => (
            <Card key={p.t} className="rounded-2xl border-border/70 bg-card hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="text-3xl mb-3">{p.e}</div>
                <div className="font-[family-name:var(--font-nunito)] font-extrabold text-base" dangerouslySetInnerHTML={{ __html: p.t }} />
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{p.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------- FEATURES ---------- */}
      <section id="features" className="bg-secondary/50 py-16 md:py-24 border-y border-border/60">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center max-w-2xl mx-auto">
            <Badge variant="outline" className="rounded-full mb-4 border-primary/40 text-primary font-bold">Everything in one place</Badge>
            <h2 className="font-[family-name:var(--font-nunito)] font-black text-3xl md:text-4xl tracking-tight">
              Your pocket nutrition team
            </h2>
            <p className="mt-3 text-muted-foreground">
              Six tools working together so you spend less time worrying and more time enjoying meals together.
            </p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <Card key={f.title} className="rounded-2xl border-border/70 bg-card hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center mb-4">
                    <f.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="font-[family-name:var(--font-nunito)] font-extrabold text-lg">{f.emoji} {f.title}</div>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <Badge variant="outline" className="rounded-full mb-4 border-primary/40 text-primary font-bold">Simple by design</Badge>
          <h2 className="font-[family-name:var(--font-nunito)] font-black text-3xl md:text-4xl tracking-tight">
            From tired to sorted in three steps
          </h2>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-6 relative">
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] border-t-2 border-dashed border-primary/30" aria-hidden="true" />
          {STEPS.map((s) => (
            <div key={s.n} className="relative text-center">
              <div className="mx-auto h-24 w-24 rounded-full nt-cta-gradient text-white grid place-items-center text-4xl shadow-lg shadow-primary/20">
                {s.emoji}
              </div>
              <div className="mt-5 inline-flex items-center gap-2 text-primary font-[family-name:var(--font-nunito)] font-black text-sm">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-black">{s.n}</span>
                {s.title}
              </div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- PRICING ---------- */}
      <section id="pricing" className="bg-secondary/50 py-16 md:py-24 border-y border-border/60">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center max-w-2xl mx-auto">
            <Badge variant="outline" className="rounded-full mb-4 border-primary/40 text-primary font-bold">Fair local pricing</Badge>
            <h2 className="font-[family-name:var(--font-nunito)] font-black text-3xl md:text-4xl tracking-tight">
              Less than a family loaf a day
            </h2>
            <div className="mt-6 inline-flex items-center gap-1 bg-card rounded-full p-1 border border-border">
              <button
                onClick={() => setBilling("monthly")}
                className={`rounded-full px-5 py-2 text-sm font-bold transition-colors ${billing === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`rounded-full px-5 py-2 text-sm font-bold transition-colors ${billing === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Yearly <span className={billing === "yearly" ? "text-primary-foreground/80" : "text-primary"}>· 2 months free</span>
              </button>
            </div>
          </div>

          <div className="mt-10 grid md:grid-cols-3 gap-5 items-start">
            {/* Free */}
            <Card className="rounded-3xl border-border/70 bg-card">
              <CardContent className="p-7">
                <div className="font-[family-name:var(--font-nunito)] font-extrabold text-lg">Taster</div>
                <div className="mt-2 flex items-end gap-1">
                  <span className="font-[family-name:var(--font-nunito)] font-black text-4xl">R0</span>
                  <span className="text-muted-foreground text-sm mb-1.5">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Try the full experience for one child.</p>
                <Button variant="outline" className="w-full mt-5 rounded-full font-bold" onClick={startFree}>
                  Start free
                </Button>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {[
                    "1 child profile",
                    "1 AI meal plan per week",
                    "Full recipe library",
                    "Food diary & shopping lists",
                    "5 coach messages per day",
                  ].map((x) => (
                    <li key={x} className="flex gap-2 items-start">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Premium */}
            <Card className="rounded-3xl border-2 border-primary shadow-xl shadow-primary/10 relative overflow-hidden bg-card md:-mt-3">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[11px] font-black px-4 py-1.5 rounded-bl-2xl tracking-wide">
                MOST POPULAR
              </div>
              <CardContent className="p-7">
                <div className="font-[family-name:var(--font-nunito)] font-extrabold text-lg">Family Premium</div>
                <div className="mt-2 flex items-end gap-1">
                  <span className="font-[family-name:var(--font-nunito)] font-black text-4xl text-primary">R{price(79)}</span>
                  <span className="text-muted-foreground text-sm mb-1.5">/{billing === "yearly" ? "month, billed yearly" : "month"}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Everything unlimited, for the whole household.</p>
                <Button className="w-full mt-5 rounded-full font-extrabold nt-cta-gradient text-white" onClick={startFree}>
                  Start 14-day free trial
                </Button>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {[
                    "Unlimited children",
                    "Unlimited AI meal plans",
                    "Unlimited Coach Nandi chat",
                    "AI recipes from your ingredients",
                    "Priority plan regeneration",
                    "Weekly nutrition insights",
                  ].map((x) => (
                    <li key={x} className="flex gap-2 items-start">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="rounded-3xl border-border/70 bg-card">
              <CardContent className="p-7">
                <div className="font-[family-name:var(--font-nunito)] font-extrabold text-lg">Crèche &amp; Pro</div>
                <div className="mt-2 flex items-end gap-1">
                  <span className="font-[family-name:var(--font-nunito)] font-black text-4xl">R{price(199)}</span>
                  <span className="text-muted-foreground text-sm mb-1.5">/{billing === "yearly" ? "month, billed yearly" : "month"}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">For crèches, au pairs and feeding programmes.</p>
                <Button variant="outline" className="w-full mt-5 rounded-full font-bold" onClick={startFree}>
                  Talk to us
                </Button>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {[
                    "Everything in Premium",
                    "Up to 30 children",
                    "Group shopping consolidation",
                    "Bulk portion scaling",
                    "Export &amp; print plans",
                    "Priority support",
                  ].map((x) => (
                    <li key={x} className="flex gap-2 items-start">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span dangerouslySetInnerHTML={{ __html: x }} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-6">
            Prices include VAT. Pay fast with card, Instant EFT or SnapScan. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ---------- TESTIMONIALS ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <Badge variant="outline" className="rounded-full mb-4 border-primary/40 text-primary font-bold">Real parents, real plates</Badge>
          <h2 className="font-[family-name:var(--font-nunito)] font-black text-3xl md:text-4xl tracking-tight">
            The dinner table is quieter — in a good way
          </h2>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name} className="rounded-2xl bg-card border-border/70">
              <CardContent className="p-6">
                <div className="flex gap-1 mb-3">
                  {[...Array(t.stars)].map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-sm leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-5 flex items-center gap-3">
                  <span className="h-11 w-11 rounded-full bg-secondary grid place-items-center text-xl ring-1 ring-border">{t.emoji}</span>
                  <div>
                    <div className="font-[family-name:var(--font-nunito)] font-extrabold text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.place}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="bg-secondary/50 py-16 md:py-24 border-y border-border/60">
        <div className="mx-auto max-w-3xl px-4">
          <div className="text-center">
            <Badge variant="outline" className="rounded-full mb-4 border-primary/40 text-primary font-bold">Good questions</Badge>
            <h2 className="font-[family-name:var(--font-nunito)] font-black text-3xl md:text-4xl tracking-tight">
              Frequently asked
            </h2>
          </div>
          <Accordion type="single" collapsible className="mt-10 bg-card rounded-3xl border border-border/70 px-6 divide-y divide-border/60">
            {FAQS.map((f, i) => (
              <AccordionItem key={f.q} value={`q${i}`} className="border-0">
                <AccordionTrigger className="text-left font-[family-name:var(--font-nunito)] font-extrabold text-base hover:no-underline py-5">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="rounded-[2.5rem] nt-cta-gradient text-white px-6 py-14 md:py-20 text-center relative overflow-hidden">
          <div className="absolute inset-0 nt-dot-pattern opacity-20" aria-hidden="true" />
          <div className="relative">
            <span className="text-5xl">🥗</span>
            <h2 className="font-[family-name:var(--font-nunito)] font-black text-3xl md:text-5xl tracking-tight mt-4">
              Tonight&rsquo;s dinner is already sorted.
            </h2>
            <p className="mt-4 text-white/85 max-w-xl mx-auto">
              Join thousands of South African parents turning mealtime stress into mealtime smiles.
              Free to start, no card needed.
            </p>
            <Button
              size="lg"
              onClick={startFree}
              className="mt-8 bg-white text-primary hover:bg-white/90 rounded-full text-base font-extrabold h-13 px-9 shadow-xl hover:-translate-y-0.5 transition-all"
            >
              Build my child&rsquo;s plan <Heart className="ml-1 h-5 w-5 fill-primary" />
            </Button>
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="mt-auto border-t border-border/60 bg-card">
        <div className="mx-auto max-w-6xl px-4 py-10 grid sm:grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-lg nt-cta-gradient grid place-items-center text-white">
                <Sprout className="h-4 w-4" />
              </span>
              <span className="font-[family-name:var(--font-nunito)] font-extrabold">NutriTummies</span>
            </div>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Healthy, affordable meals for South African kids — planned by AI, approved by moms.
            </p>
          </div>
          <div>
            <div className="font-[family-name:var(--font-nunito)] font-extrabold mb-3">Product</div>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
              <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
            </ul>
          </div>
          <div>
            <div className="font-[family-name:var(--font-nunito)] font-extrabold mb-3">Company</div>
            <ul className="space-y-2 text-muted-foreground">
              <li>Our story</li>
              <li>Contact</li>
              <li>Careers</li>
            </ul>
          </div>
          <div>
            <div className="font-[family-name:var(--font-nunito)] font-extrabold mb-3">Legal</div>
            <ul className="space-y-2 text-muted-foreground">
              <li>Privacy (POPIA)</li>
              <li>Terms of use</li>
              <li>Cookie notice</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Nutri Tummies (Pty) Ltd · Johannesburg, South Africa · Made with <Leaf className="inline h-3 w-3 text-primary" /> and love
        </div>
      </footer>
    </div>
  );
}
