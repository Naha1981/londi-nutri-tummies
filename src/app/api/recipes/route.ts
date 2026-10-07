import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, entitlementsFor, planActive } from "@/lib/auth";
import { generateRecipe, RecipeDraft } from "@/lib/ai";
import type { Child } from "@prisma/client";
import { rateLimit, tooManyRequests, AI_BURST_LIMIT, AI_BURST_WINDOW, AI_RATE_MESSAGE } from "@/lib/ratelimit";
import { cacheKey, cacheGet, cacheSet, TTL_RECIPE } from "@/lib/aicache";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "recipe"
  );
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").toLowerCase().trim();
  const category = req.nextUrl.searchParams.get("category") || "";
  const recipes = await db.recipe.findMany({ orderBy: { title: "asc" } });
  const filtered = recipes.filter((r) => {
    if (category && r.category !== category) return false;
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(q) ||
      (r.tags || "").toLowerCase().includes(q) ||
      (r.ingredients || "").toLowerCase().includes(q)
    );
  });
  return NextResponse.json({ recipes: filtered });
}

// POST: AI-generate a recipe from ingredients on hand (Premium feature)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const parsed = z
      .object({ ingredients: z.string().trim().min(3).max(500), childId: z.string().optional() })
      .safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Tell us at least one ingredient you have." }, { status: 400 });

    const ent = entitlementsFor(planActive(user));
    if (!ent.aiRecipes) {
      return NextResponse.json(
        { error: "AI recipes are a Premium feature. Upgrade to create recipes from your ingredients.", upgrade: true },
        { status: 402 }
      );
    }

    let child: Child | null = null;
    if (parsed.data.childId) {
      child = await db.child.findFirst({ where: { id: parsed.data.childId, userId: user.id } });
    }

    // burst protection (all AI endpoints share one per-user budget)
    const burst = await rateLimit("ai", user.id, AI_BURST_LIMIT, AI_BURST_WINDOW);
    if (!burst.allowed) return tooManyRequests(burst.retryAfterSec, AI_RATE_MESSAGE);

    // 7-day cache keyed on the normalised ingredient set + child profile
    const ingredientsKey = parsed.data.ingredients
      .toLowerCase()
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .sort()
      .join(", ");
    const recipeCacheKey = cacheKey("recipe", {
      ingredients: ingredientsKey,
      child: child ? { age: child.ageYears, allergies: child.allergies } : null,
    });
    let draft = await cacheGet<RecipeDraft>(recipeCacheKey);

    if (draft) {
      // cache hit: reuse the existing library entry instead of duplicating it
      const existing = await db.recipe.findFirst({ where: { title: String(draft.title).slice(0, 80) } });
      if (existing) return NextResponse.json({ recipe: existing, ai: true, cached: true });
    } else {
      draft = await generateRecipe(parsed.data.ingredients, child);
      if (draft) await cacheSet("recipe", recipeCacheKey, draft, TTL_RECIPE);
    }
    if (!draft) {
      return NextResponse.json(
        { error: "The recipe chef is busy right now — please try again in a moment." },
        { status: 503 }
      );
    }

    const slug = `${slugify(draft.title)}-${Date.now().toString(36)}`;
    const recipe = await db.recipe.create({
      data: {
        slug,
        title: String(draft.title).slice(0, 80),
        category: ["breakfast", "lunch", "dinner", "snack"].includes(draft.category) ? draft.category : "dinner",
        cuisine: "South African",
        minutes: Math.max(5, Math.min(180, Math.round(Number(draft.minutes) || 25))),
        servings: Math.max(1, Math.min(12, Math.round(Number(draft.servings) || 2))),
        ingredients: JSON.stringify(
          (Array.isArray(draft.ingredients) ? draft.ingredients : [])
            .slice(0, 15)
            .map((i: { item?: string; qty?: string }) => ({ item: String(i?.item ?? "").slice(0, 60), qty: String(i?.qty ?? "").slice(0, 40) }))
            .filter((i) => i.item)
        ),
        instructions: JSON.stringify(
          (Array.isArray(draft.instructions) ? draft.instructions : [])
            .slice(0, 10)
            .map((s) => String(s).slice(0, 300))
            .filter(Boolean)
        ),
        calories: Math.max(0, Math.round(Number(draft.calories) || 0)),
        protein: Math.max(0, Math.round(Number(draft.protein) || 0)),
        carbs: Math.max(0, Math.round(Number(draft.carbs) || 0)),
        fat: Math.max(0, Math.round(Number(draft.fat) || 0)),
        costEst: Math.max(0, Math.round(Number(draft.costEst) || 0)),
        tags: (Array.isArray(draft.tags) ? draft.tags : []).map((t) => String(t).slice(0, 24)).slice(0, 8).join(","),
        allergens: (Array.isArray(draft.allergens) ? draft.allergens : []).map((a) => String(a).slice(0, 24)).slice(0, 8).join(","),
        kidApproved: true,
        emoji: String(draft.emoji || "🍽️").slice(0, 4),
      },
    });
    return NextResponse.json({ recipe, ai: true });
  } catch (err) {
    console.error("[recipes:POST]", err);
    return NextResponse.json({ error: "Could not create the recipe. Please try again." }, { status: 500 });
  }
}
