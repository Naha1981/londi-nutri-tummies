import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, entitlementsFor, planActive } from "@/lib/auth";
import { generateMealPlan, fallbackPlan, MealPlanDraft } from "@/lib/ai";
import { rateLimit, tooManyRequests, AI_BURST_LIMIT, AI_BURST_WINDOW, AI_RATE_MESSAGE } from "@/lib/ratelimit";
import { cacheKey, cacheGet, cacheSet, TTL_MEALPLAN } from "@/lib/aicache";

function mondayOf(d: Date): string {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
}

// GET: active plan (and recent plans) for a child
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const childId = req.nextUrl.searchParams.get("childId");
  if (!childId) return NextResponse.json({ error: "childId required" }, { status: 400 });
  const child = await db.child.findFirst({ where: { id: childId, userId: user.id } });
  if (!child) return NextResponse.json({ error: "Child not found" }, { status: 404 });

  const week = req.nextUrl.searchParams.get("week") || mondayOf(new Date());
  const plan = await db.mealPlan.findFirst({
    where: { userId: user.id, childId, weekStart: week },
    include: { meals: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ plan: plan ?? null, week });
}

// POST: generate + persist a new AI meal plan for the week
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const parsed = z
      .object({ childId: z.string().min(1), week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const child = await db.child.findFirst({ where: { id: parsed.data.childId, userId: user.id } });
    if (!child) return NextResponse.json({ error: "Child not found" }, { status: 404 });

    const ent = entitlementsFor(planActive(user));
    const week = parsed.data.week || mondayOf(new Date());
    if (ent.maxPlansPerWeek !== -1) {
      const thisWeekPlans = await db.mealPlan.findMany({
        where: { userId: user.id, weekStart: week },
        select: { childId: true },
      });
      if (thisWeekPlans.some((p) => p.childId === child.id)) {
        return NextResponse.json(
          { error: "Free plan includes one weekly plan per child. Upgrade to regenerate anytime.", upgrade: true },
          { status: 402 }
        );
      }
    }

    // burst protection (all AI endpoints share one per-user budget)
    const burst = await rateLimit("ai", user.id, AI_BURST_LIMIT, AI_BURST_WINDOW);
    if (!burst.allowed) return tooManyRequests(burst.retryAfterSec, AI_RATE_MESSAGE);

    // generate via AI (cached for 1h — absorbs double-clicks/retries), fallback to recipe library
    const planCacheKey = cacheKey("mealplan", {
      age: child.ageYears,
      allergies: child.allergies,
      dislikes: child.dislikes,
      likes: child.likes,
      budgetBand: Math.round(child.budgetPerWeek / 25) * 25,
      activity: child.activityLevel,
      week,
    });
    let draft = await cacheGet<MealPlanDraft>(planCacheKey);
    if (!draft) {
      draft = await generateMealPlan(child);
      if (!draft.meals.length) {
        const recipes = await db.recipe.findMany();
        draft = await fallbackPlan(child, recipes);
      }
      if (draft.meals.length) await cacheSet("mealplan", planCacheKey, draft, TTL_MEALPLAN);
    }
    // dedupe: keep only the first meal per (day, slot) — max 28
    const seen = new Set<string>();
    draft.meals = draft.meals.filter((m) => {
      const key = `${m.day}:${m.slot}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // replace existing plan for this child+week atomically
    await db.$transaction(async (tx) => {
      await tx.mealPlan.deleteMany({ where: { userId: user.id, childId: child.id, weekStart: week } });
      const plan = await tx.mealPlan.create({
        data: {
          userId: user.id,
          childId: child.id,
          weekStart: week,
          budget: child.budgetPerWeek,
          estimatedCost: draft.estimatedCost,
          notes: draft.notes ?? "",
        },
      });
      await tx.planMeal.createMany({
        data: draft.meals.map((m) => ({
          mealPlanId: plan.id,
          day: m.day,
          slot: m.slot,
          name: m.name,
          description: m.description ?? "",
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          veggies: m.veggies,
          costEst: m.costEst,
          recipeText: m.recipeText ?? "",
        })),
      });
    });

    const plan = await db.mealPlan.findFirst({
      where: { userId: user.id, childId: child.id, weekStart: week },
      include: { meals: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ plan, degraded: (draft.notes || "").includes("Offline") });
  } catch (err) {
    console.error("[mealplan:POST]", err);
    return NextResponse.json({ error: "Could not generate the meal plan. Please try again." }, { status: 500 });
  }
}

// DELETE: remove a plan
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const planId = req.nextUrl.searchParams.get("planId");
  if (!planId) return NextResponse.json({ error: "planId required" }, { status: 400 });
  const plan = await db.mealPlan.findFirst({ where: { id: planId, userId: user.id } });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  await db.mealPlan.delete({ where: { id: planId } });
  return NextResponse.json({ ok: true });
}
