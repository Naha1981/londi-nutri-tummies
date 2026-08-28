import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, entitlementsFor, planActive } from "@/lib/auth";

const childSchema = z.object({
  name: z.string().trim().min(1).max(40),
  ageYears: z.number().int().min(1).max(17),
  sex: z.enum(["male", "female", "other"]).default("other"),
  allergies: z.string().trim().max(200).default(""),
  dislikes: z.string().trim().max(200).default(""),
  likes: z.string().trim().max(200).default(""),
  budgetPerWeek: z.number().min(100).max(5000).default(450),
  activityLevel: z.enum(["low", "moderate", "high"]).default("moderate"),
  avatarColor: z.string().trim().max(20).default("emerald"),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const children = await db.child.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ children });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const parsed = childSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please check the child's details (name and age 1-17 required)." }, { status: 400 });
    }
    const ent = entitlementsFor(planActive(user));
    const count = await db.child.count({ where: { userId: user.id } });
    if (ent.maxChildren !== -1 && count >= ent.maxChildren) {
      return NextResponse.json(
        {
          error: "The Free plan covers one child. Upgrade to Family Premium to add more children.",
          upgrade: true,
        },
        { status: 402 }
      );
    }
    const child = await db.child.create({ data: { ...parsed.data, userId: user.id } });
    return NextResponse.json({ child });
  } catch (err) {
    console.error("[children:POST]", err);
    return NextResponse.json({ error: "Could not add the child. Please try again." }, { status: 500 });
  }
}
