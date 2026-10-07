# AI Provider Boundary — Inventory & Swap Guide

**Purpose:** everything the AI layer does, in one place, so the `z-ai-web-dev-sdk` integration can be replaced by any HTTP-based LLM provider (inside Lovable or elsewhere) without behaviour drift. The SDK is sandbox-specific and **must not** be carried into the new stack.

All prompts below are copied **verbatim** from the source (`src/lib/ai.ts`, `src/app/api/shopping/generate/route.ts` at branch `lovable-migration-prep`). They are product assets — preserve wording, especially the allergen rules (safety-critical).

---

## 1. Integration Points (exactly two)

| # | Site | Functions | Notes |
|---|---|---|---|
| 1 | `src/lib/ai.ts` | `generateMealPlan`, `generateRecipe`, `coachReply`, `nutritionInsight` (dead code), shared `chat()` | The intended boundary. `chat(messages, maxTokens)` → `string \| null` |
| 2 | `src/app/api/shopping/generate/route.ts` | inline `zai.chat.completions.create(...)` | **Bypasses the boundary** — same pattern duplicated inline. During migration, route this through the new single boundary |

**Common call shape (all five functions):**

```
messages: [{role:"system", content: <prompt>}, {role:"user", content: <inputs>}]
temperature: 0.7 (meal plan, recipe, coach) · 0.4 (shopping)
max_tokens: 6000 (meal plan) · 2500 (recipe, shopping) · 1200 (coach) · 400 (insight)
parse: strip markdown fences → take substring from first "{" to last "}" → JSON.parse
on parse/model failure: function-specific fallback (see §4)
```

**Replacement seam:** implement one function with this signature against your new provider —

```ts
type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
async function chat(messages: ChatMessage[], maxTokens?: number): Promise<string | null>;
```

— returning `null` on any failure (never throwing), and all five features keep working with zero other changes.

---

## 2. Prompts (verbatim)

### 2.1 Meal plan — `generateMealPlan(child)` (system)

```
You are Nutri Tummies, an expert paediatric nutritionist and South African family meal planner.
Create a 7-day meal plan for ONE child. Rules:
- Use affordable, widely-available South African ingredients (mealie meal, chicken, beans, butternut, spinach/morogo, eggs, maas, wors, rice, potatoes, tomatoes, onions, apples, bananas).
- STRICTLY avoid the child's allergens. This is a safety-critical rule.
- Balance: each day breakfast, lunch, dinner, one snack.
- Respect the weekly budget across all 28 meals (costs are estimates in ZAR).
- Kid-friendly portions and flavours; hide vegetables in sauces where sensible.
- Be culturally familiar: pap, boerewors, bobotie, vetkoek, amagwinya, samp, chakalaka (mild), gatsby-style rolls, etc.
Return ONLY valid JSON matching exactly this shape:
{"estimatedCost": number, "notes": string, "meals": [{"day": 0-6, "slot": "breakfast|lunch|dinner|snack", "name": string, "description": string, "calories": number, "protein": number, "carbs": number, "fat": number, "veggies": boolean, "costEst": number, "recipeText": string}]}
"day": 0=Monday ... 6=Sunday. Exactly 28 meals (7 days x 4 slots). protein/carbs/fat in grams. Keep description under 15 words, recipeText under 60 words.
```

**User message template:**

```
Create the weekly plan for this child:
Name: {name}
Age: {ageYears} years
Sex: {sex}
Activity level: {activityLevel}
STRICT ALLERGIES (never include these): {allergies}        // or "No known allergies"
Dislikes (avoid where possible): {dislikes}
Likes (use often): {likes}
Weekly food budget: R{budgetPerWeek}
```

### 2.2 Recipe — `generateRecipe(ingredients, child)` (system)

```
You are Nutri Tummies' recipe creator. Create ONE kid-friendly, budget-conscious South African recipe using (mostly) the ingredients provided.
{If child: The child is {ageYears} years old. STRICTLY avoid these allergens: {allergies || "none"}.}
Return ONLY valid JSON:
{"title": string, "category": "breakfast|lunch|dinner|snack", "minutes": number, "servings": number, "ingredients": [{"item": string, "qty": string}], "instructions": [string], "calories": number, "protein": number, "carbs": number, "fat": number, "costEst": number, "tags": [string], "allergens": [string], "emoji": string}
Use a food emoji for "emoji". 6-12 ingredients, 4-8 instruction steps. costEst is total cost in ZAR.
```

**User message:** `Ingredients I have: {ingredients}`

### 2.3 Coach — `coachReply(history, childProfiles)` (system)

```
You are Coach Nandi, Nutri Tummies' warm, practical picky-eating and child nutrition coach for South African parents.
Style: encouraging, down-to-earth, concrete. Use local context (shop prices in Rand, SA foods like pap, morogo, amagwinya).
Give actionable advice: small steps, mealtime routines, gentle exposure techniques, budget swaps.
NEVER diagnose medical conditions. For allergy reactions, weight loss, or health worries, advise seeing a clinic or doctor.
Keep replies under 220 words. Use short paragraphs or a short list. No markdown headers.
{If children: The parent's children:
- {name}, {age}y: likes {likes}; dislikes {dislikes}; allergies {allergies}}
```

**History window:** last 14 messages (DB), of which the last 12 are sent to the model; each message content truncated to 2000 chars.

### 2.4 Shopping list — inline in `shopping/generate/route.ts` (system)

```
You are Nutri Tummies' shopping list builder for South African parents.
Given a week of meals for a child, produce ONE consolidated grocery list (dedupe shared ingredients across meals).
Estimate realistic Shoprite/Checkers prices in Rand. Aim to fit the family budget.
Return ONLY valid JSON: {"items": [{"name": string, "qty": string, "category": "Produce|Protein|Dairy|Dry Goods|Bakery|Frozen|Other", "estCost": number}]}
15-30 items. qty like "2 kg", "1 dozen", "500 g". estCost is total ZAR for that item.
```

**User message:** `Meals for the week (child {child.name}, budget R{budget}):\n{mealSummary}` where mealSummary = `"{slot}: {name}"` joined by `"; "`, sorted by day then slot.

### 2.5 Nutrition insight — `nutritionInsight(summary)` (system) — **DEAD CODE, never called**

```
You are Nutri Tummies' nutrition analyst. Given a child's weekly eating summary, write ONE practical insight for the parent (under 90 words). Warm, specific, actionable. Mention a concrete improvement or win. No markdown.
```

Kept here for the product decision (handoff P2): implement or delete.

---

## 3. Output Sanitisation (must be reproduced — this is the real validation layer)

Loose JSON parsing means the model's output is only trusted after these passes:

**Meal plan (`sanitizePlan`):**
- drop meals with empty/missing names; clamp `day` to 0–6 (default 0); invalid `slot` → `"snack"`
- `name` ≤ 80 chars, `description` ≤ 140, `recipeText` ≤ 400, `notes` ≤ 300
- numeric fields: `Math.max(0, round(x || 0))` for calories/protein/carbs/fat/costEst
- `veggies` coerced to boolean; `estimatedCost` falls back to the sum of meal costs
- route-level: dedupe to first meal per `(day, slot)`, max 28; accept only if ≥ 28 meals returned

**Recipe (route-level):**
- `title` ≤ 80; `category` must be one of the four, else `"dinner"`
- `minutes` clamp 5–180, `servings` clamp 1–12, at most 15 ingredients (item ≤ 60, qty ≤ 40 chars), at most 10 instructions (≤ 300 chars each)
- tags/allergens: ≤ 8 entries, ≤ 24 chars each, stored comma-joined
- slug: kebab-case title + timestamp suffix (uniqueness)

**Shopping list (route-level):**
- ≤ 40 items; `name` ≤ 60, `qty` ≤ 30; `category` must be one of the seven, else `"Other"`; `estCost` ≥ 0 rounded

**Coach:** plain text, no structural validation; ≤ 220 words is prompt-enforced only.

---

## 4. Fallbacks (degradation contract)

| Feature | On AI failure | Notes |
|---|---|---|
| Meal plan | `fallbackPlan(child, recipes)` — deterministic 28-meal plan: allergen-filtered seed recipes by category, else generic staples ("Mealie pap", "Chicken & rice", "Fruit & yoghurt cup"); per-meal budget = weekly/28; `notes: "Offline plan generated from the Nutri Tummies recipe library."`; the UI shows a "generated from the offline recipe library" toast (`degraded: true`) | **Bug fixed on this branch:** the internal call with a null recipe list used to throw; regression-tested by `scripts/test-ai-fallback.ts` |
| Recipe | **No fallback** — 503 "The recipe chef is busy right now" | Product decision: keep or add one |
| Coach | Canned message: "I'm having trouble connecting right now. Meanwhile, a tip that works for most fussy eaters: serve one 'safe' food they like alongside one new food, keep portions small, and let them see you enjoying the new food too. Please try again in a moment. 🌱" (`degraded: true`) | Fixed copy, do not lose it — it's user-facing |
| Shopping list | Fixed 18-item staple list (mealie meal, chicken, eggs, oil, butternut, morogo, tomatoes, onions, potatoes, rice, milk, maas, apples, bananas, bread, peanut butter, beans, wors) with costs as fixed fractions of the child's weekly budget (12%, 20%, 8%, 6%, …) | Reproduce the exact fractions from source if parity matters |
| Insight | n/a (dead code) | |

---

## 5. Caching & Rate Limiting (cost-control policies to port)

**Cache (`src/lib/aicache.ts`)** — DB table `AiCache`, key = `sha256(kind + "::" + canonical JSON of inputs)`, value = JSON response, TTLs:

| Kind | Key inputs | TTL |
|---|---|---|
| `mealplan` | age, allergies, dislikes, likes, **budget band (rounded to R25)**, activity, week | 1 h (absorbs double-clicks/retries) |
| `coach` | normalised question + child profiles + last-3-message tail | 24 h |
| `recipe` | sorted lowercase ingredient list + child age/allergies | 7 d |
| `shopping` | planId only | 7 d |

Cache hits never break requests (`catch → null`); expired rows pruned opportunistically on ~2% of writes. On cache hit for recipes, the route reuses the existing library row instead of creating a duplicate.

**Rate limit (`src/lib/ratelimit.ts`)** — DB fixed-window counter, scope `ai` shared across **all four** AI endpoints, **10 calls / 60 s / user**. 429 response carries `retryAfterSec` and the message: `"That's a lot of AI magic in one minute — give it a breather and try again shortly."` Limiter failure = allow (never take the API down). Entitlement quotas (5 coach msgs/day free, etc.) are separate and live in auth logic.

---

## 6. Migration Checklist for the AI Layer

- [ ] One `chat()` seam implemented against the new provider (§1); shopping generation routed through it
- [ ] All five prompts preserved verbatim (or deliberately edited — record diffs)
- [ ] Sanitisation passes reproduced (§3) — they, not the prompts, are the safety net
- [ ] Fallback table (§4) reproduced, incl. the fixed coach copy
- [ ] Cache TTLs and key recipes (§5) ported or consciously re-tuned for the new provider's cost
- [ ] Burst limit 10/min/user ported; entitlement quotas ported (see handoff §4)
- [ ] Secrets: provider API key stored in the new backend's secret store — never in client code
- [ ] Verify with: `scripts/test-ai-fallback.ts` logic ported as the new backend's first test
