# Nutri Tummies → Lovable Migration Handoff

**Branch:** `lovable-migration-prep` · **Base:** `origin/main` @ `84ba70a` (v1.1 scale-hardening)
**Audited:** full source tree (every tracked file under `src/`, `prisma/`, `scripts/`, config). This document describes what was actually inspected in the code — not what the README claims. Confirmed inconsistencies are listed in [§7](#7-readme-vs-implementation-discrepancies).

> **Scope note.** Nothing in this folder creates or configures a Lovable project, Lovable Cloud, or external accounts. Anything that depends on how Lovable actually behaves is marked **[verify during migration]**. No Lovable-specific APIs are invented here.

---

## 1. Current-State Architecture (confirmed from source)

**One deployable Next.js 16 App Router app.** A single client-side-rendered page (`src/app/page.tsx`) hosts the entire product — there is **no URL routing between app sections**. View switching is Zustand state (`view`: landing/auth/onboarding/app; `tab`: 7 app tabs). The only URL state is `?billing=return|cancel&order=…` for payment redirects and `#features|#pricing|#faq` anchors on the landing page.

| Layer | Implementation | Files |
|---|---|---|
| UI | React 19 client components, Tailwind CSS 4, shadcn/ui (full set), Nunito/Nunito Sans via `next/font` | `src/components/views/*`, `src/components/marketing/Landing.tsx`, `src/components/UpgradeDialog.tsx` |
| Client state | Zustand only. **TanStack Query is installed but never used** (plain `fetch` + `useEffect` everywhere) | `src/store/useAppStore.ts` |
| API | 20 Next.js Route Handlers (JSON, Zod-validated), all stateless | `src/app/api/**` |
| Auth | Custom: scrypt `salt:hash` passwords, random 32-byte session tokens in a `Session` table, httpOnly cookie `nt_session` (30-day). **No email verification, no password reset, no account deletion** | `src/lib/auth.ts` |
| DB | Prisma ORM, SQLite in dev (`file:./db/custom.db`, gitignored). Schema-first (`prisma db push` — **no migration history exists**) | `prisma/schema.prisma`, `src/lib/db.ts` |
| AI | `z-ai-web-dev-sdk` (GLM) called from **two places**: the service module and one route that bypasses it. JSON-in/JSON-out with loose parsing, deterministic fallbacks, DB-backed cache + rate limit | `src/lib/ai.ts`, `src/app/api/shopping/generate/route.ts`, `src/lib/aicache.ts`, `src/lib/ratelimit.ts` |
| Billing | Provider auto-detection: PayFast (MD5-signed form POST + ITN webhook) → Yoco (hosted checkout + verified webhook) → demo mode. Idempotent fulfilment writes `plan` + `premiumUntil` | `src/lib/payments.ts`, `src/lib/billing.ts`, `src/app/api/billing/**` |

**Server-side ownership checks are consistent**: every route that touches user-owned rows does `findFirst({ where: { id, userId } })` before read/write (verified in children, children/[id], mealplan, diary, diary/[id], shopping, shopping/generate, coach, billing/orders, billing/demo-complete). `Recipe` is the one **global shared table** (see §3 data classification).

**Build/deploy assumptions (confirmed):**
- `next.config.ts`: `typescript.ignoreBuildErrors: true` (TS errors did NOT fail builds — see §6), `output: "standalone"` unless `VERCEL` env is set.
- `postinstall: prisma generate` — Prisma client must be generated at install time (relevant for any CI/Lovable preview).
- No test framework. Three script-based checks exist: `scripts/test-payfast.ts` (pure, offline), `scripts/test-hardening.ts` (needs a running dev server), `scripts/test-ai-fallback.ts` (pure, offline — added by this branch).
- ESLint config disables most meaningful rules (`no-unused-vars`, `@typescript-eslint/*`, `react-hooks/exhaustive-deps`, …) — a green `lint` run is a weak signal.
- `src/lib/db.ts` sets `log: ['query']` on PrismaClient **unconditionally, including production** — every SQL statement (containing emails, child names, allergies) can reach server logs. Recommended fix (not applied — changes production logging behaviour): `log: process.env.NODE_ENV === 'production' ? ['error'] : ['query']`.

---

## 2. Screen-by-Screen Migration Map

All views are already `"use client"` React components that talk to the API over `fetch` — this is the single biggest asset for a Lovable rebuild: the views can be lifted with mainly mechanical edits.

| # | Screen | Component | APIs consumed | Reuse in Lovable |
|---|---|---|---|---|
| 1 | Landing (hero, features, how-it-works, pricing, FAQ, footer w/ legal links) | `marketing/Landing.tsx` | none | **High** — plain React/Tailwind. Replace `next/font` usage (inherited from layout) |
| 2 | Auth (signin/signup toggle, legal links) | `views/AuthView.tsx` | `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me` | **Adapt** — swap to Lovable Auth calls; keep form + copy |
| 3 | Onboarding (first child profile form) | `views/OnboardingView.tsx` | `POST /api/children` | **High** — swap fetch target |
| 4 | App shell (desktop sidebar + mobile bottom nav, plan badge, active-child switch, sign out) | `views/AppShell.tsx` | `POST /api/auth/logout` | **High** — introduce real routes if desired (currently tab state only) |
| 5 | Dashboard (greeting, today's meals, generate/regenerate plan, quick actions) | `views/DashboardView.tsx` | `GET/POST /api/mealplan` | **High** |
| 6 | Meal Planner (7-day × 4-slot grid, per-day detail, "add to shopping list") | `views/PlannerView.tsx` | `GET/POST /api/mealplan`, `POST /api/shopping/generate` | **High** |
| 7 | Recipes (search + category filter, detail dialog, AI "cook from my kitchen") | `views/RecipesView.tsx` | `GET/POST /api/recipes` | **High** — AI recipe generation needs the new AI boundary |
| 8 | Food Diary (day view, add entry w/ rating, delete) | `views/DiaryView.tsx` | `GET/POST /api/diary`, `DELETE /api/diary/[id]` | **High** |
| 9 | Shopping (list w/ checkboxes, totals, add/edit/remove, clear checked) | `views/ShoppingView.tsx` | `GET/POST/PATCH/DELETE /api/shopping` | **High** |
| 10 | Coach Nandi (chat UI, history, clear chat) | `views/CoachView.tsx` | `GET/POST/DELETE /api/coach` | **High** — chat persistence + AI call move to backend |
| 11 | Settings (children CRUD, budget slider, payment history, legal links, sign out) | `views/SettingsView.tsx` | `GET/POST /api/children`, `PATCH/DELETE /api/children/[id]`, `GET /api/billing/orders` | **High** |
| 12 | Legal overlay (POPIA privacy policy + terms) | `views/LegalView.tsx` | none | **High** — static content |
| 13 | Upgrade dialog (pricing toggle monthly/yearly, PayFast form-submit / Yoco redirect / demo pay button) | `UpgradeDialog.tsx` | `GET/POST /api/billing/checkout`, `POST /api/billing/demo-complete`, `GET /api/auth/me` | **Rebuild** — checkout flow must target whatever billing you adopt in Lovable |

**Journey not obvious from the nav:** signup → automatic 14-day `premium_trial` → onboarding (first child) → dashboard. Payment return lands on `/?billing=return&order=…`, shows a toast, and re-fetches the session after 5 s (webhook may arrive slightly later than the redirect).

---

## 3. API Surface (each route: reads/writes)

| Route | Methods | Tables read | Tables written | Notes |
|---|---|---|---|---|
| `/api/auth/signup` | POST | User | User, Session | Zod: name 2–60, email, password ≥ 8. Creates `premium_trial` + `trialEndsAt` = +14 d |
| `/api/auth/login` | POST | User, Session | Session | Generic 401 on bad creds |
| `/api/auth/me` | GET | Session, User, Child | — | Returns user + children + entitlements; plan is the *effective* plan via `planActive()` |
| `/api/auth/logout` | POST | Session | Session (delete) | |
| `/api/children` | GET, POST | Child | Child | POST enforces `maxChildren` (free = 1); returns 402 + `upgrade:true` |
| `/api/children/[id]` | PATCH, DELETE | Child | Child (+ cascades MealPlan, PlanMeal, DiaryEntry) | Ownership-checked |
| `/api/mealplan` | GET, POST, DELETE | Child, MealPlan, PlanMeal, Recipe, AiCache, RateLimit | MealPlan, PlanMeal, AiCache, RateLimit | POST: free plan = 1 plan/child/week (blocks regeneration, 402); burst limit 10 AI calls/min; plan cached 1 h; replaces plan for child+week atomically; **fallback path fixed on this branch** (see §6) |
| `/api/recipes` | GET, POST | Recipe (+ Child for POST) | Recipe | **GET is public (no auth)** — returns the whole shared library. POST = AI recipe, premium-only, creates a **global** Recipe row (visible to all users, incl. anonymous) |
| `/api/diary` | GET, POST | Child, DiaryEntry | DiaryEntry | Filters: childId, from, to |
| `/api/diary/[id]` | DELETE | DiaryEntry | DiaryEntry | Ownership-checked |
| `/api/shopping` | GET, POST, PATCH, DELETE | ShoppingItem | ShoppingItem | DELETE modes: `checked` / `all` / `{id}` |
| `/api/shopping/generate` | POST | MealPlan, PlanMeal, Child, AiCache, RateLimit | ShoppingItem, AiCache, RateLimit | AI builds list from plan (7-day cache); fallback = fixed 18-item staples list scaled to budget. **This route calls the AI SDK directly, bypassing `src/lib/ai.ts`** |
| `/api/coach` | GET, POST, DELETE | CoachMessage, Child, AiCache, RateLimit | CoachMessage, AiCache, RateLimit | Free = 5 user messages/day; history window 14 msgs (12 sent to model); 24 h cache; canned fallback reply on AI failure |
| `/api/billing/checkout` | GET, POST | User, PaymentOrder | PaymentOrder | GET = provider + plan catalogue; POST = create pending order, return PayFast fields / Yoco URL / demo orderId |
| `/api/billing/notify` | POST | PaymentOrder, User | PaymentOrder, User | PayFast ITN: MD5 signature verify + `payment_status === COMPLETE` + `amount_gross ≥ amountCents`, then `fulfilOrder` (idempotent) |
| `/api/billing/webhook/yoco` | POST | PaymentOrder, User | PaymentOrder, User | Re-verifies by fetching the checkout from Yoco's API with the secret key before fulfilling |
| `/api/billing/demo-complete` | POST | PaymentOrder, User | PaymentOrder, User | **Only when no real provider configured**; refuses otherwise (403) |
| `/api/billing/orders` | GET | PaymentOrder | — | Last 20 orders for the user |
| `/api/health` | GET | Recipe (count only) | — | Liveness + DB check |
| `/api` | GET | — | — | Leftover scaffold "Hello, world!" — safe to delete |

---

## 4. Auth, Entitlements & Plan Logic (must be reproduced or consciously changed)

**Password/session mechanics (current):** scrypt (default N, 64-byte hash, 16-byte hex salt, format `salt:hash`), 32-byte hex session token, cookie `nt_session` httpOnly/sameSite=lax/secure-in-prod, 30-day expiry, sessions deleted lazily when expired.

**Plan state machine (current — `src/lib/auth.ts`):**

| Stored `User.plan` | Meaning | Effective plan after… |
|---|---|---|
| `free` | default before any signup | — |
| `premium_trial` | 14-day trial from signup | `trialEndsAt` passes → effective `free` |
| `premium` / `pro` | paid, `premiumUntil` set by webhook | `premiumUntil` passes → effective `free` |

`planActive()` computes the effective plan **without writing it back** — the stored value can stay `premium_trial` forever while the user is effectively free. **Migration must carry the raw values + both timestamps and reproduce this logic** (or materialise the effective plan once, as a deliberate cutover decision).

**Entitlements (server-enforced):**

| | Free | premium_trial / premium / pro |
|---|---|---|
| Children | 1 | unlimited |
| Plans per week | 1 per child (regeneration blocked) | unlimited |
| Coach messages | 5 per day | unlimited |
| AI recipes | ✗ | ✓ |

**Gaps to decide on for the Lovable build** (none exist today): password reset, email verification, account/data deletion (POPIA §24/25 right), subscription cancellation UI, any admin surface, any email infrastructure at all.

---

## 5. AI Layer (see `ai-provider-boundary.md` for the full inventory & swap guide)

- 5 AI functions: meal plan, recipe, coach, shopping list, plus `nutritionInsight` which is **dead code — never called**.
- 2 integration sites: `src/lib/ai.ts` (4 functions) **and** `shopping/generate/route.ts` (inline, bypasses the boundary). The boundary doc consolidates the contract so the Lovable rebuild has one seam to swap.
- Every AI call: loose JSON parse (fence-strip + outermost braces) → shape validation/sanitisation → deterministic fallback → DB cache (TTLs: meal plan 1 h, coach 24 h, recipe 7 d, shopping 7 d) → shared burst limit 10 AI calls/min/user.
- Prompts are embedded product assets — copied verbatim into the boundary doc.
- `z-ai-web-dev-sdk` is **sandbox-specific and must not be carried into Lovable** — replace with an HTTP call to whichever LLM provider you choose.

---

## 6. Verified Issues Fixed on This Branch (small, proven, migration-relevant)

1. **Broken graceful degradation (runtime bug, fixed + regression-tested).** `generateMealPlan()`'s degraded path called `fallbackPlan(child, null)` → `TypeError: Cannot read properties of null (reading 'filter')` → every fresh meal-plan request would **500 instead of degrading** whenever the AI provider was unavailable and the cache missed — precisely the "no AI credentials" situation a Lovable deployment starts in. Proven by `scripts/test-ai-fallback.ts` (failed before the fix, all 9 checks pass after). Fix: `fallbackPlan` now accepts `Recipe[] | null`.
2. **7 TypeScript errors in tracked files** (masked by `ignoreBuildErrors: true`): the above null-typing in `ai.ts`, `let child = null` inference in `recipes/route.ts` (2 errors), duplicate `main()` across the two test scripts (TS2393, 2 errors × 2 files). Fixed with type annotations and `export {}` module scoping — zero runtime behaviour change. `npx tsc --noEmit` now reports **0 errors in tracked files**.
3. **New focused test**: `scripts/test-ai-fallback.ts` (offline, no server needed) locks in the degraded-path behaviour with synthetic fixtures only.

**Known issues documented but deliberately NOT changed** (behaviour/production impact — your call):
- `ignoreBuildErrors: true` in `next.config.ts` (recommend removing **after** this branch proves tsc clean).
- `log: ['query']` on PrismaClient in production (POPIA-sensitive; see §1).
- Dead code: `nutritionInsight`, `/api` hello route, unused deps (`next-auth`, `next-intl`, `uuid`, `sharp`, `framer-motion`, `@dnd-kit/*`, `@mdxeditor`, `react-syntax-highlighter`, `recharts` (only referenced by the unused `ui/chart.tsx`), `@tanstack/react-query`, …).
- `GET /api/recipes` is public and AI recipes are global — fine for a shared library, but it means a premium user's AI-generated recipe is immediately visible to everyone. Confirm this is intended before migrating (it affects schema ownership design).

---

## 7. README-vs-Implementation Discrepancies (confirmed)

| # | Claim | Reality |
|---|---|---|
| 1 | "Food Diary … the AI uses this to improve future plans" (README + landing copy) | **Not implemented.** Meal-plan generation reads only the child profile. Diary data is never fed back into anything |
| 2 | "Weekly nutrition insights" (Premium perk in UpgradeDialog; Pro perk in `PLANS`) | **Not implemented.** `nutritionInsight()` is dead code |
| 3 | Landing pricing card: "Crèche & Pro" **R199/mo**, "Up to 30 children", group features | `PLANS.pro_monthly` = **R129/mo**, entitlement = **unlimited** children; Pro is not purchasable in the UpgradeDialog (API only); group features don't exist |
| 4 | README monetisation: "Premium (R79/mo) or Pro (R129/mo)" | Omits the yearly plan (R790/yr) that the UI actually sells |
| 5 | "State: Zustand + TanStack Query" | TanStack Query installed but never used |
| 6 | "All AI features degrade gracefully … the app never breaks" (README deploy section) | Was false for meal plans until the fix on this branch; **recipe generation still has no fallback** (returns 503 on AI failure) |
| 7 | Pricing copy "Prices include VAT" | VAT handling is not implemented anywhere in code (display copy only) |

---

## 8. Reuse / Adapt / Rebuild for a Lovable-Native Stack

**Likely reusable (source material to paste into Lovable prompts/code):**
- All 13 view components + UpgradeDialog (plain client React + Tailwind + shadcn/ui — Lovable's native idiom). Mechanical edits: strip `"use client"` (no-ops there), replace `next/font` (self-host Nunito or use a CSS import), swap `fetch("/api/…")` for the Lovable client/backend calls.
- `useAppStore.ts` (Zustand) — works as-is in a Vite React app; `zar()`, date helpers, avatar colour map.
- The shadcn/ui component set if Lovable's project doesn't already include equivalents (Lovable ships shadcn by default **[verify during migration]**).
- Global CSS tokens (`globals.css` brand palette, gradients, Nunito font vars).
- The seed recipe library (`scripts/seed.ts` — 20 SA recipes) as reference/seed data.
- All AI prompts + JSON contracts + fallback/caching/rate-limit policies (see `ai-provider-boundary.md`).
- POPIA privacy policy & terms text (`LegalView.tsx`) — copy the wording, update the "contact/controller" details.

**Needs adaptation:**
- Auth: replace cookie sessions with Lovable Auth. Email/password signup UX carries over; password hashes do **not** (see `data-migration.md` §account-migration).
- Entitlements: reimplement as server-side checks in the Lovable backend — the table in §4 is the spec.
- Billing: keep PayFast/Yoco (they're just HTTP + webhooks — work from any backend) but the checkout routes, signature verification, and fulfilment logic must be rebuilt as Lovable backend functions. `payments.ts` + `billing.ts` logic (incl. idempotent `fulfilOrder`) is the reference implementation to port.
- Rate limiting + AI cache: port the *policies* (10/min/user burst; TTL table) onto whatever the Lovable backend offers (tables, Redis-like store, or middleware) **[verify during migration]**.
- The payment-return handshake (`?billing=return` + re-poll after 5 s) — reimplement against the new return URLs.

**Rebuild (cannot be carried):**
- All 20 Next.js route handlers (Lovable has no Next.js server) — §3 is the complete API spec, one line per route.
- Prisma + SQLite dev database → hosted Postgres (Lovable Cloud) — schema mapping in `data-migration.md`.
- `z-ai-web-dev-sdk` integration → provider-agnostic HTTP AI call (boundary doc).
- Deployment config (`next.config.ts`, standalone output, Vercel assumptions) — irrelevant in Lovable.

---

## 9. Phased Migration Order (minimises time inside Lovable)

Each phase has an acceptance check you can run **before** opening Lovable, so Lovable time is spent only on assembly.

| Phase | Work | Where | Acceptance check |
|---|---|---|---|
| **0. Freeze & export** | Run `scripts/export-for-migration.ts` dry-run; decide open questions (§11); confirm target data schema | local | Dry-run prints row counts for all 9 exportable tables; zero secrets in output |
| **1. Static shell** | New Lovable project: paste global CSS + Landing + Legal views; wire navigation | Lovable | Landing renders pixel-comparable to `screenshots/01-landing.png`; privacy/terms open |
| **2. Auth + shell of app** | Lovable Auth (email/password), paste AppShell/Auth/Onboarding, define the 7 app routes | Lovable | Signup → onboarding → empty dashboard round-trip works; sign out works |
| **3. Core data CRUD** | Create backend tables per `data-migration.md`; paste Settings/Diary/Shopping views wired to new CRUD endpoints | Lovable | Can create/edit/delete a child, log diary entries, manage shopping items — all isolated per user |
| **4. Recipes + seed** | Import the 20 seed recipes; paste Recipes view; decide the public-vs-private library question (P3) | Lovable | Library lists 20 recipes with search + category filter |
| **5. AI features** | Implement the 4 live AI functions behind the boundary contract (prompts verbatim); port entitlements (§4), burst limits and cache TTLs | Lovable | Meal plan returns 28 valid meals or the deterministic fallback; coach answers or falls back; 11th AI call in a minute is throttled; free-tier limits enforced |
| **6. Billing** | Port checkout + webhook + `fulfilOrder` (idempotency!) to the Lovable backend; run PayFast sandbox | Lovable + PayFast sandbox | Sandbox payment flips account to premium; double-webhook does not double-extend; demo mode refuses when keys are set |
| **7. Data migration** | Import users/children/plans/diary/etc. from the export per `data-migration.md`; send re-onboarding emails | Lovable + email provider | Import counts match export manifest exactly; legacy user can log in via the new flow and sees their children |
| **8. Cutover** | See checklist below | both | Checklist complete |

**Time-saver principle:** every view component, prompt, policy table, and API contract in this folder is written so it can be pasted into Lovable as-is. Do your prompt engineering against these docs, not against the running app.

---

## 10. Cutover Checklist

**Data**
- [ ] Export re-run immediately before cutover; row counts recorded in `manifest.json`
- [ ] Import into the target DB; counts reconciled per table (manifest vs. target)
- [ ] `Recipe` library seeded (or imported) and slugs unique
- [ ] Spot-check one synthetic + one real (consented) account end-to-end
- [ ] Sessions, rate-limit counters, AI cache **not** migrated (by design — users simply log in again)

**Authentication / account recovery**
- [ ] Password strategy executed (see `data-migration.md` — current scrypt hashes are **not** assumed importable)
- [ ] Re-onboarding/magic-link email sends and lands (requires an email provider — none exists today)
- [ ] Support path for "I can't get in" users (manual verification flow)
- [ ] Old app kept available read-only as a fallback for a defined window (e.g. 30 days)

**Privacy (POPIA)**
- [ ] Privacy policy updated with the new processor/sub-processor list (Lovable, its DB/hosting, AI provider, email provider)
- [ ] Data-subject export/delete paths exist in the new system (none exist today)
- [ ] Query logging off in production; no child data in logs
- [ ] Children's data (allergies, diary, coach chats) classified and access-controlled in the target DB

**AI behaviour parity**
- [ ] Same JSON contracts; same sanitisation (clamps, 28-meal dedupe, category whitelists)
- [ ] Same fallbacks (meal plan, coach, shopping) — recipe fallback still absent (product decision P-decision)
- [ ] Allergen avoidance rule present in the meal-plan prompt verbatim (safety-critical)
- [ ] Burst limit + cache TTLs match §5 or are consciously re-tuned

**Payment testing**
- [ ] PayFast **sandbox** ITN round-trip (signature, amount, status checks all pass)
- [ ] Yoco webhook re-verification works (if used)
- [ ] Idempotency: replaying a webhook never double-extends `premiumUntil`
- [ ] Demo endpoints absent or refusing in production
- [ ] Underpayment / CANCELLED / FAILED paths mark the order correctly

**Rollback**
- [ ] Old (this) app deployable from `main` at any time (don't delete the Vercel project or the old DB)
- [ ] DNS/URL switch documented with a tested revert path
- [ ] Export files + manifest archived (they contain personal data — store under POPIA-appropriate controls and delete after retention window)

---

## 11. Decisions You Must Make

**Product decisions (yours to make, no investigation needed):**

| # | Decision | Context |
|---|---|---|
| P1 | Pro tier: keep `R129/mo unlimited` (code), `R199/mo / 30 children / crèche features` (landing), or drop Pro until built? | Three contradictory definitions exist (§7 #3) |
| P2 | Are "weekly nutrition insights" and "diary improves future plans" real roadmap items or marketing to remove? | Both are advertised, neither is implemented |
| P3 | Recipe library: global/shared (current) or per-user? | Currently AI recipes by any premium user are public to everyone |
| P4 | Password re-onboarding UX: magic link, forced reset, or invite email? | No email infra exists today; this choice gates Phase 7 |
| P5 | Keep PayFast/Yoco in the Lovable build, or use whatever billing Lovable offers natively? **[verify during migration]** | PayFast/Yoco port cleanly; native options may reduce code but add lock-in |
| P6 | Which LLM provider replaces GLM/z-ai-sdk in Lovable, and what's the monthly budget? | Affects cache TTL tuning |
| P7 | Do you want real URL routing per tab in the new app? | Current app is state-routed (no deep links) |
| P8 | VAT: actually include, or remove the "Prices include VAT" claim? | §7 #7 |

**Technical unknowns (must be verified inside Lovable — do not assume):**

| # | Unknown | Why it matters |
|---|---|---|
| T1 | Exact capabilities of Lovable Cloud's Postgres (row-level security? triggers? extensions?) and how the client SDK authenticates | Schema in `data-migration.md` marks RLS policies as draft |
| T2 | Whether Lovable Auth can import users with existing password hashes, and which formats it accepts | Decides P4 mechanics; current format is custom scrypt `salt:hexhash` |
| T3 | Whether Lovable projects support scheduled/background jobs (cache pruning is currently opportunistic, so this is optional) | Housekeeping parity |
| T4 | How Lovable handles custom domains + outbound webhooks (PayFast ITN must reach a stable public URL) | Phase 6 |
| T5 | Whether any project size constraints affect pasting the full view set | Phases 1–5 |
| T6 | Lovable's environment-variable/secret handling | Payment keys + AI keys |

---

## 12. What's in This Folder

| File | Purpose |
|---|---|
| `README.md` | This handoff |
| `data-migration.md` | Target schema mapping (draft DDL — **not applied anywhere**), sensitivity classification, transient-table exclusions, account/password migration recommendation, export tool guide |
| `ai-provider-boundary.md` | Every AI touchpoint, prompt (verbatim), JSON contract, sanitisation, fallback, cache/rate-limit policy — the seam to swap providers |
| `scripts/export-for-migration.ts` (repo root `scripts/`) | Non-destructive exporter: dry-run by default, explicit `--database-url` required, excludes sessions/rate-limits/cache, password hashes opt-in |
| `scripts/test-ai-fallback.ts` (repo root `scripts/`) | Offline regression test for the degraded AI path (synthetic fixtures only) |
