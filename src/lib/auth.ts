// Nutri Tummies — Authentication & Session Management
// scrypt password hashing + httpOnly session cookies (no external deps)

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "nt_session";
const SESSION_DAYS = 30;

// ---------- password hashing ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

// ---------- sessions ----------

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { token, userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => {});
  }
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  plan: string;
  trialEndsAt: Date | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }
    const u = session.user;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      plan: u.plan,
      trialEndsAt: u.trialEndsAt,
    };
  } catch {
    return null;
  }
}

// ---------- plan entitlements ----------

export type Entitlements = {
  maxChildren: number; // -1 = unlimited
  maxPlansPerWeek: number;
  coachMessagesPerDay: number; // -1 = unlimited
  aiRecipes: boolean;
  label: string;
};

export function entitlementsFor(plan: string): Entitlements {
  switch (plan) {
    case "pro":
      return { maxChildren: -1, maxPlansPerWeek: -1, coachMessagesPerDay: -1, aiRecipes: true, label: "Pro" };
    case "premium":
      return { maxChildren: -1, maxPlansPerWeek: -1, coachMessagesPerDay: -1, aiRecipes: true, label: "Premium" };
    case "premium_trial":
      return { maxChildren: -1, maxPlansPerWeek: -1, coachMessagesPerDay: -1, aiRecipes: true, label: "Premium Trial" };
    default:
      return { maxChildren: 1, maxPlansPerWeek: 1, coachMessagesPerDay: 5, aiRecipes: false, label: "Free" };
  }
}

export function planActive(user: { plan: string; trialEndsAt: Date | null }): string {
  if (user.plan === "premium_trial" && user.trialEndsAt && user.trialEndsAt < new Date()) {
    return "free";
  }
  return user.plan;
}
