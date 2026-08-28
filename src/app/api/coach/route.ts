import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, entitlementsFor, planActive } from "@/lib/auth";
import { coachReply } from "@/lib/ai";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const messages = await db.coachMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    take: 60,
  });
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const parsed = z.object({ message: z.string().trim().min(1).max(1000) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Please type a message." }, { status: 400 });

    const ent = entitlementsFor(planActive(user));
    if (ent.coachMessagesPerDay !== -1) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayCount = await db.coachMessage.count({
        where: { userId: user.id, role: "user", createdAt: { gte: startOfDay } },
      });
      if (todayCount >= ent.coachMessagesPerDay) {
        return NextResponse.json(
          { error: "You've used your 5 free coach messages today. Upgrade for unlimited coaching.", upgrade: true },
          { status: 402 }
        );
      }
    }

    // persist user message
    const userMsg = await db.coachMessage.create({
      data: { userId: user.id, role: "user", content: parsed.data.message },
    });

    const history = await db.coachMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      take: 14,
    });
    const children = await db.child.findMany({ where: { userId: user.id } });
    const profiles = children
      .map((c) => `- ${c.name}, ${c.ageYears}y: likes ${c.likes || "n/a"}; dislikes ${c.dislikes || "n/a"}; allergies ${c.allergies || "none"}`)
      .join("\n");

    const reply = await coachReply(history, profiles);
    if (!reply) {
      const assistantMsg = await db.coachMessage.create({
        data: {
          userId: user.id,
          role: "assistant",
          content:
            "I'm having trouble connecting right now. Meanwhile, a tip that works for most fussy eaters: serve one 'safe' food they like alongside one new food, keep portions small, and let them see you enjoying the new food too. Please try again in a moment. 🌱",
        },
      });
      return NextResponse.json({ userMessage: userMsg, message: assistantMsg, degraded: true });
    }
    const assistantMsg = await db.coachMessage.create({
      data: { userId: user.id, role: "assistant", content: reply },
    });
    return NextResponse.json({ userMessage: userMsg, message: assistantMsg });
  } catch (err) {
    console.error("[coach:POST]", err);
    return NextResponse.json({ error: "The coach is unavailable right now." }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await db.coachMessage.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
}
