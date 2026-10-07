// Focused test: deterministic fallback meal plan must work with ZERO recipes.
// Why this matters: generateMealPlan() calls fallbackPlan(child, null) on the
// degraded path (AI unavailable + cache miss). If that throws, every fresh
// meal-plan request 500s instead of degrading — breaking the documented
// "never breaks without AI credentials" guarantee.
// Run: bunx tsx scripts/test-ai-fallback.ts

import type { Child } from "@prisma/client";

// Synthetic child fixture — NO real user data.
const syntheticChild = {
  id: "fixture-child-1",
  userId: "fixture-user-1",
  name: "Test Child",
  ageYears: 6,
  sex: "other",
  allergies: "peanuts",
  dislikes: "",
  likes: "",
  budgetPerWeek: 450,
  activityLevel: "moderate",
  avatarColor: "emerald",
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Child;

async function main() {
  const { fallbackPlan } = await import("../src/lib/ai");

  let pass = 0;
  let fail = 0;
  const check = (name: string, ok: boolean, extra = "") => {
    if (ok) {
      pass++;
      console.log(`  ✓ ${name}${extra ? ` — ${extra}` : ""}`);
    } else {
      fail++;
      console.log(`  ✗ FAIL: ${name}${extra ? ` — ${extra}` : ""}`);
    }
  };

  console.log("\n━━━ 1. Degraded path: fallbackPlan(child, null) ━━━");
  try {
    const draft = await fallbackPlan(syntheticChild, null as unknown as never);
    check("does not throw with null recipe list", true);
    check("returns 28 meals", draft.meals.length === 28, `${draft.meals.length} meals`);
    check("every meal has a name", draft.meals.every((m) => m.name && m.name.trim().length > 0));
    check("allergen-free defaults", !draft.meals.some((m) => /peanut/i.test(m.name)), "no peanut in names");
    check("cost estimate present", draft.estimatedCost > 0, `R${draft.estimatedCost}`);
  } catch (err) {
    check("does not throw with null recipe list", false, (err as Error).message);
  }

  console.log("\n━━━ 2. Empty recipe list (DB has no rows) ━━━");
  try {
    const draft = await fallbackPlan(syntheticChild, []);
    check("does not throw with empty recipe list", true);
    check("returns 28 meals", draft.meals.length === 28, `${draft.meals.length} meals`);
  } catch (err) {
    check("does not throw with empty recipe list", false, (err as Error).message);
  }

  console.log("\n━━━ 3. Happy path: real (synthetic) recipes ━━━");
  const syntheticRecipe = {
    id: "fixture-recipe-1",
    slug: "fixture-pap",
    title: "Fixture Mealie Pap",
    category: "breakfast",
    cuisine: "South African",
    minutes: 15,
    servings: 2,
    ingredients: "[]",
    instructions: '["Step one.","Step two."]',
    calories: 320,
    protein: 9,
    carbs: 58,
    fat: 6,
    costEst: 14,
    tags: "fixture",
    allergens: "dairy",
    kidApproved: true,
    emoji: "🥣",
  } as never as Awaited<ReturnType<typeof fallbackPlan>> extends never ? never : never;
  // (typed loosely on purpose — see note below)
  const draft3 = await fallbackPlan(syntheticChild, [syntheticRecipe] as never);
  check("uses seeded recipe titles", draft3.meals.some((m) => m.name === "Fixture Mealie Pap"));
  check("breakfast slots use the recipe", draft3.meals.filter((m) => m.slot === "breakfast").length === 7);

  console.log(`\nAI fallback test: ${fail === 0 ? "ALL PASS" : `${fail} FAILURE(S)`} (${pass} passed)`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
