import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const entrySchema = z.object({
  childId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  what: z.string().trim().min(1).max(200),
  servings: z.number().int().min(1).max(10).default(1),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().trim().max(300).optional(),
  calories: z.number().int().min(0).max(3000).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const childId = req.nextUrl.searchParams.get("childId");
  const entries = await db.diaryEntry.findMany({
    where: {
      userId: user.id,
      ...(childId ? { childId } : {}),
      ...(from ? { date: { gte: from } } : {}),
      ...(to ? { date: { lte: to } } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const parsed = entrySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Please fill in what your child ate." }, { status: 400 });
    const child = await db.child.findFirst({ where: { id: parsed.data.childId, userId: user.id } });
    if (!child) return NextResponse.json({ error: "Child not found" }, { status: 404 });
    const entry = await db.diaryEntry.create({ data: { ...parsed.data, userId: user.id } });
    return NextResponse.json({ entry });
  } catch (err) {
    console.error("[diary:POST]", err);
    return NextResponse.json({ error: "Could not save the entry." }, { status: 500 });
  }
}
