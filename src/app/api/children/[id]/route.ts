import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  ageYears: z.number().int().min(1).max(17).optional(),
  sex: z.enum(["male", "female", "other"]).optional(),
  allergies: z.string().trim().max(200).optional(),
  dislikes: z.string().trim().max(200).optional(),
  likes: z.string().trim().max(200).optional(),
  budgetPerWeek: z.number().min(100).max(5000).optional(),
  activityLevel: z.enum(["low", "moderate", "high"]).optional(),
  avatarColor: z.string().trim().max(20).optional(),
});

function mondayOf(d: Date): string {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  // ownership check — never trust client-supplied ownership
  const child = await db.child.findFirst({ where: { id, userId: user.id } });
  if (!child) return NextResponse.json({ error: "Child not found" }, { status: 404 });
  try {
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid update data." }, { status: 400 });
    const updated = await db.child.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ child: updated });
  } catch (err) {
    console.error("[children:PATCH]", err);
    return NextResponse.json({ error: "Could not update the child." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  const child = await db.child.findFirst({ where: { id, userId: user.id } });
  if (!child) return NextResponse.json({ error: "Child not found" }, { status: 404 });
  await db.child.delete({ where: { id } }); // cascades to plans + diary
  return NextResponse.json({ ok: true, deletedMonday: mondayOf(new Date()) });
}
