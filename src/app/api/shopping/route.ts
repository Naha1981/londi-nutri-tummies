import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const items = await db.shoppingItem.findMany({
    where: { userId: user.id },
    orderBy: [{ checked: "asc" }, { category: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ items });
}

const itemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  qty: z.string().trim().max(30).default(""),
  category: z.string().trim().max(30).default("General"),
  estCost: z.number().min(0).max(10000).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    // support single item or {items: [...]} from meal-plan generation
    const parsed = body && Array.isArray((body as { items?: unknown[] }).items)
      ? z.object({ items: z.array(itemSchema).min(1).max(80) }).safeParse(body)
      : z.object({ items: z.array(itemSchema).min(1).max(80) }).safeParse({ items: [body] });
    if (!parsed.success) return NextResponse.json({ error: "Please enter an item name." }, { status: 400 });
    const created = await db.shoppingItem.createMany({
      data: parsed.data.items.map((i) => ({ ...i, userId: user.id as string })),
    });
    return NextResponse.json({ created: created.count });
  } catch (err) {
    console.error("[shopping:POST]", err);
    return NextResponse.json({ error: "Could not add the item." }, { status: 500 });
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  checked: z.boolean().optional(),
  name: z.string().trim().min(1).max(80).optional(),
  qty: z.string().trim().max(30).optional(),
  estCost: z.number().min(0).max(10000).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
    const { id, ...data } = parsed.data;
    const item = await db.shoppingItem.findFirst({ where: { id, userId: user.id } });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    await db.shoppingItem.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[shopping:PATCH]", err);
    return NextResponse.json({ error: "Could not update the item." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const mode = req.nextUrl.searchParams.get("mode"); // "checked" | "all" | specific id
  if (mode === "checked") {
    await db.shoppingItem.deleteMany({ where: { userId: user.id, checked: true } });
    return NextResponse.json({ ok: true });
  }
  if (mode === "all") {
    await db.shoppingItem.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ ok: true });
  }
  if (mode) {
    const item = await db.shoppingItem.findFirst({ where: { id: mode, userId: user.id } });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    await db.shoppingItem.delete({ where: { id: mode } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Missing mode parameter." }, { status: 400 });
}
