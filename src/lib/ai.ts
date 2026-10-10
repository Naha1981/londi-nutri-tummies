// Nutri Tummies — AI Service (backend only)
// Wraps z-ai-web-dev-sdk with typed helpers + graceful degradation fallbacks.
// Business rules live here, NOT in prompts. Prompts only orchestrate.

import ZAI from "z-ai-web-dev-sdk";
import type { Child, Recipe } from "@prisma/client";

export type PlanMealDraft = {
  day: number;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  description?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  veggies: boolean;
  costEst: number;
  recipeText?: string;
};

export type MealPlanDraft = {
  estimatedCost: number;
  notes?: string;
  meals: PlanMealDraft[];
};

async function chat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens = 4000
): Promise<string | null> {
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: maxTokens,
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch (err) {
    console.error("[ai:chat] failed:", err);
    return null;
  }
}

function parseJsonLoose<T>(raw: string | null): T | null {
  if (!raw) return null;
  let text = raw.trim();
  // strip markdown fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  // grab the outermost JSON object
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;

function childProfileText(child: Child): string {
  const bits = [
    `Name: ${child.name}`,
    `Age: ${child.ageYears} years`,
    `Sex: ${child.sex}`,
    `Activity level: ${child.activityLevel}`,
    child.allergies ? `STRICT ALLERGIES (never include these): ${child.allergies}` : "No known allergies",
    child.dislikes ? `Dislikes (avoid where possible): ${child.dislikes}` : "",
    child.likes ? `Likes (use often): ${child.likes}` : "",
    `Weekly food budget: R${Math.round(child.budgetPerWeek)}`,
  ].filter(Boolean);
  return bits.join("\n");
}

// ---------------- Meal Plan Generation ----------------

export async function generateMealPlan(child: Child): Promise<MealPlanDraft> {
  const sys = `You are Nutri Tummies, an expert paediatric nutritionist and South African family meal planner.
Create a 7-day meal plan for ONE child. Rules:
- Use affordable, widely-available South African ingredients (mealie meal, chicken, beans, butternut, spinach/morogo, eggs, maas, wors, rice, potatoes, tomatoes, onions, apples, bananas).
- STRICTLY avoid the child's allergens. This is a safety-critical rule.
- Balance: each day breakfast, lunch, dinner, one snack.
- Respect the weekly budget across all 28 meals (costs are estimates in ZAR).
- Kid-friendly portions and flavours; hide vegetables in sauces where sensible.
- Be culturally familiar: pap, boerewors, bobotie, vetkoek, amagwinya, samp, chakalaka (mild), gatsby-style rolls, etc.
Return ONLY valid JSON matching exactly this shape:
{"estimatedCost": number, "notes": string, "meals": [{"day": 0-6, "slot": "breakfast|lunch|dinner|snack", "name": string, "description": string, "calories": number, "protein": number, "carbs": number, "fat": number, "veggies": boolean, "costEst": number, "recipeText": string}]}
"day": 0=Monday ... 6=Sunday. Exactly 28 meals (7 days x 4 slots). protein/carbs/fat in grams. Keep description under 15 words, recipeText under 60 words.`;

  const user = `Create the weekly plan for this child:\n${childProfileText(child)}`;
  const raw = await chat(
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    6000
  );
  const parsed = parseJsonLoose<MealPlanDraft>(raw);
  if (parsed && Array.isArray(parsed.meals) && parsed.meals.length >= 28) {
    return sanitizePlan(parsed);
  }
  // graceful degradation: deterministic fallback from recipe library
  return fallbackPlan(child, null);
}

export async function fallbackPlan(child: Child, recipes: Recipe[] | null): Promise<MealPlanDraft> {
  // recipes may be null on the degraded path inside generateMealPlan() —
  // the plan then falls back to generic staple meals (never throws).
  const pool = recipes ?? [];
  const byCat = (c: string) => pool.filter((r) => r.category === c);
  const safe = (list: Recipe[]) =>
    list.filter((r) => {
      const allergens = (r.allergens || "").toLowerCase();
      return !(child.allergies || "")
        .toLowerCase()
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
        .some((a) => allergens.includes(a));
    });
  const pick = (list: Recipe[], i: number): Recipe | undefined => list[i % Math.max(list.length, 1)];
  const meals: PlanMealDraft[] = [];
  const perMealBudget = child.budgetPerWeek / 28;
  let total = 0;
  for (let d = 0; d < 7; d++) {
    for (const slot of SLOTS) {
      const pool = safe(byCat(slot));
      const r = pool.length ? pick(pool, d + slot.length) : undefined;
      const name = r?.title ?? (slot === "snack" ? "Fruit & yoghurt cup" : `${slot === "breakfast" ? "Mealie pap" : "Chicken & rice"} bowl`);
      const cost = Math.round(r?.costEst ?? perMealBudget);
      total += cost;
      meals.push({
        day: d,
        slot,
        name,
        description: r ? `${r.minutes} min · kid approved` : "Simple & balanced",
        calories: r?.calories ?? 380,
        protein: r?.protein ?? 14,
        carbs: r?.carbs ?? 45,
        fat: r?.fat ?? 12,
        veggies: true,
        costEst: cost,
        recipeText: r ? (JSON.parse(r.instructions || "[]") as string[]).slice(0, 2).join(" ") : undefined,
      });
    }
  }
  return {
    estimatedCost: Math.round(total || child.budgetPerWeek),
    notes: "Offline plan generated from the Nutri Tummies recipe library.",
    meals,
  };
}

function sanitizePlan(p: MealPlanDraft): MealPlanDraft {
  const meals = p.meals
    .filter((m) => m && typeof m.name === "string" && m.name.trim().length > 0)
    .map((m) => ({
      day: Math.min(Math.max(Number(m.day) || 0, 0), 6),
      slot: (SLOTS.includes(m.slot) ? m.slot : "snack") as PlanMealDraft["slot"],
      name: String(m.name).slice(0, 80),
      description: m.description ? String(m.description).slice(0, 140) : "",
      calories: Math.max(0, Math.round(Number(m.calories) || 0)),
      protein: Math.max(0, Math.round(Number(m.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(m.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(m.fat) || 0)),
      veggies: Boolean(m.veggies),
      costEst: Math.max(0, Math.round(Number(m.costEst) || 0)),
      recipeText: m.recipeText ? String(m.recipeText).slice(0, 400) : "",
    }));
  return {
    estimatedCost: Math.max(0, Math.round(Number(p.estimatedCost) || meals.reduce((s, m) => s + m.costEst, 0))),
    notes: p.notes ? String(p.notes).slice(0, 300) : "",
    meals,
  };
}

// ---------------- Recipe Generation ----------------

export type RecipeDraft = {
  title: string;
  category: string;
  minutes: number;
  servings: number;
  ingredients: { item: string; qty: string }[];
  instructions: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  costEst: number;
  tags: string[];
  allergens: string[];
  emoji: string;
};

export async function generateRecipe(ingredients: string, child: Child | null): Promise<RecipeDraft | null> {
  const sys = `You are Nutri Tummies' recipe creator. Create ONE kid-friendly, budget-conscious South African recipe using (mostly) the ingredients provided.
${child ? `The child is ${child.ageYears} years old. STRICTLY avoid these allergens: ${child.allergies || "none"}.` : ""}
Return ONLY valid JSON:
{"title": string, "category": "breakfast|lunch|dinner|snack", "minutes": number, "servings": number, "ingredients": [{"item": string, "qty": string}], "instructions": [string], "calories": number, "protein": number, "carbs": number, "fat": number, "costEst": number, "tags": [string], "allergens": [string], "emoji": string}
Use a food emoji for "emoji". 6-12 ingredients, 4-8 instruction steps. costEst is total cost in ZAR.`;
  const raw = await chat(
    [
      { role: "system", content: sys },
      { role: "user", content: `Ingredients I have: ${ingredients}` },
    ],
    2500
  );
  const parsed = parseJsonLoose<RecipeDraft>(raw);
  if (parsed && parsed.title && Array.isArray(parsed.ingredients) && parsed.ingredients.length > 0) {
    return parsed;
  }
  return null;
}

// ---------------- Coach Chat ----------------

export async function coachReply(
  history: { role: string; content: string }[],
  childProfiles: string
): Promise<string | null> {
  const sys = `You are Coach Nandi, Nutri Tummies' warm, practical picky-eating and child nutrition coach for South African parents.
Style: encouraging, down-to-earth, concrete. Use local context (shop prices in Rand, SA foods like pap, morogo, amagwinya).
Give actionable advice: small steps, mealtime routines, gentle exposure techniques, budget swaps.
NEVER diagnose medical conditions. For allergy reactions, weight loss, or health worries, advise seeing a clinic or doctor.
Keep replies under 220 words. Use short paragraphs or a short list. No markdown headers.
${childProfiles ? `The parent's children:\n${childProfiles}` : ""}`;

  const msgs: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: sys },
    ...history.slice(-12).map((h) => ({
      role: h.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(h.content).slice(0, 2000),
    })),
  ];
  return chat(msgs, 1200);
}

// ---------------- Nutrition Insight ----------------

export async function nutritionInsight(summary: string): Promise<string | null> {
  const sys = `You are Nutri Tummies' nutrition analyst. Given a child's weekly eating summary, write ONE practical insight for the parent (under 90 words). Warm, specific, actionable. Mention a concrete improvement or win. No markdown.`;
  return chat(
    [
      { role: "system", content: sys },
      { role: "user", content: summary },
    ],
    400
  );
}

export { DAYS, SLOTS };
