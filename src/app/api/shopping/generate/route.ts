import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import ZAI from "z-ai-web-dev-sdk";

// POST: generate a consolidated shopping list (with ZAR estimates) from a child's active meal plan
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const parsed = z.object({ planId: z.string().min(1) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const plan = await db.mealPlan.findFirst({
      where: { id: parsed.data.planId, userId: user.id },
      include: { meals: true, child: true },
    });
    if (!plan) return NextResponse.json({ error: "Meal plan not found." }, { status: 404 });

    const mealSummary = plan.meals
      .sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot))
      .map((m) => `${m.slot}: ${m.name}`)
      .join("; ");

    let items: { name: string; qty: string; category: string; estCost: number }[] | null = null;

    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are Nutri Tummies' shopping list builder for South African parents.
Given a week of meals for a child, produce ONE consolidated grocery list (dedupe shared ingredients across meals).
Estimate realistic Shoprite/Checkers prices in Rand. Aim to fit the family budget.
Return ONLY valid JSON: {"items": [{"name": string, "qty": string, "category": "Produce|Protein|Dairy|Dry Goods|Bakery|Frozen|Other", "estCost": number}]}
15-30 items. qty like "2 kg", "1 dozen", "500 g". estCost is total ZAR for that item.`,
          },
          {
            role: "user",
            content: `Meals for the week (child ${plan.child.name}, budget R${Math.round(plan.child.budgetPerWeek)}):\n${mealSummary}`,
          },
        ],
        temperature: 0.4,
        max_tokens: 2500,
      });
      const raw = completion.choices[0]?.message?.content ?? "";
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const text = (fence ? fence[1] : raw).trim();
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end > start) {
        const parsedList = JSON.parse(text.slice(start, end + 1)) as {
          items?: { name?: string; qty?: string; category?: string; estCost?: number }[];
        };
        if (Array.isArray(parsedList.items)) {
          items = parsedList.items
            .filter((i) => i && typeof i.name === "string" && i.name.trim())
            .slice(0, 40)
            .map((i) => ({
              name: String(i.name).slice(0, 60),
              qty: String(i.qty ?? "").slice(0, 30),
              category: ["Produce", "Protein", "Dairy", "Dry Goods", "Bakery", "Frozen", "Other"].includes(String(i.category))
                ? String(i.category)
                : "Other",
              estCost: Math.max(0, Math.round(Number(i.estCost) || 0)),
            }));
        }
      }
    } catch (err) {
      console.error("[shopping:generate] AI failed, using fallback:", err);
    }

    // graceful degradation: staple-based fallback list
    if (!items || items.length === 0) {
      const budget = plan.child.budgetPerWeek;
      items = [
        { name: "Mealie meal (maize)", qty: "2.5 kg", category: "Dry Goods", estCost: Math.round(budget * 0.12) },
        { name: "Chicken pieces", qty: "1.5 kg", category: "Protein", estCost: Math.round(budget * 0.2) },
        { name: "Eggs", qty: "1 dozen", category: "Protein", estCost: Math.round(budget * 0.08) },
        { name: "Cooking oil", qty: "750 ml", category: "Dry Goods", estCost: Math.round(budget * 0.06) },
        { name: "Butternut", qty: "1 large", category: "Produce", estCost: Math.round(budget * 0.04) },
        { name: "Spinach (morogo)", qty: "2 bunches", category: "Produce", estCost: Math.round(budget * 0.04) },
        { name: "Tomatoes", qty: "1 kg", category: "Produce", estCost: Math.round(budget * 0.05) },
        { name: "Onions", qty: "1 kg", category: "Produce", estCost: Math.round(budget * 0.04) },
        { name: "Potatoes", qty: "2 kg", category: "Produce", estCost: Math.round(budget * 0.06) },
        { name: "Rice", qty: "1 kg", category: "Dry Goods", estCost: Math.round(budget * 0.05) },
        { name: "Milk", qty: "2 L", category: "Dairy", estCost: Math.round(budget * 0.06) },
        { name: "Maas / yoghurt", qty: "1 L", category: "Dairy", estCost: Math.round(budget * 0.05) },
        { name: "Apples", qty: "1 kg", category: "Produce", estCost: Math.round(budget * 0.04) },
        { name: "Bananas", qty: "1 bunch", category: "Produce", estCost: Math.round(budget * 0.03) },
        { name: "Brown bread", qty: "2 loaves", category: "Bakery", estCost: Math.round(budget * 0.05) },
        { name: "Peanut butter", qty: "400 g", category: "Dry Goods", estCost: Math.round(budget * 0.04) },
        { name: "Dried beans / lentils", qty: "500 g", category: "Dry Goods", estCost: Math.round(budget * 0.03) },
        { name: "Wors (boerewors)", qty: "500 g", category: "Protein", estCost: Math.round(budget * 0.07) },
      ];
    }

    await db.$transaction(async (tx) => {
      await tx.shoppingItem.deleteMany({ where: { userId: user.id, checked: false } });
      await tx.shoppingItem.createMany({
        data: items!.map((i) => ({ ...i, userId: user.id })),
      });
    });

    return NextResponse.json({ created: items.length, degraded: false });
  } catch (err) {
    console.error("[shopping:generate]", err);
    return NextResponse.json({ error: "Could not generate the shopping list." }, { status: 500 });
  }
}
