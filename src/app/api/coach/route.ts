import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, entitlementsFor, planActive } from "@/lib/auth";
import { coachReply } from "@/lib/ai";
import { rateLimit, tooManyRequests, AI_BURST_LIMIT, AI_BURST_WINDOW, AI_RATE_MESSAGE } from "@/lib/ratelimit";
import { cacheKey, cacheGet, cacheSet, TTL_COACH } from "@/lib/aicache";

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

    // burst protection (all AI endpoints share one per-user budget)
    const burst = await rateLimit("ai", user.id, AI_BURST_LIMIT, AI_BURST_WINDOW);
    if (!burst.allowed) return tooManyRequests(burst.retryAfterSec, AI_RATE_MESSAGE);

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

    const reply = await coachReplyCached(history, profiles, parsed.data.message);
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

// coach reply with a 24h cache: identical question + identical context (child
// profiles + tail of conversation) returns the cached answer instead of
// burning tokens on a repeat call.
async function coachReplyCached(history: { role: string; content: string }[], profiles: string, message: string) {
  const tail = history
    .slice(-3)
    .map((m) => `${m.role}:${m.content.slice(0, 120)}`)
    .join("|");
  const key = cacheKey("coach", {
    q: message.toLowerCase().trim(),
    profiles,
    tail,
  });
  const cached = await cacheGet<string>(key);
  if (cached) return cached;
  const reply = await coachReply(history, profiles);
  if (reply) await cacheSet("coach", key, reply, TTL_COACH);
  return reply;
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await db.coachMessage.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
}
