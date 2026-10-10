# Client Roadmap Review — Technical Verification & Migration Interaction

**Reviewed:** the client-feedback implementation roadmap ("Nutrition first. Healthier habits for life.") shared by the client on 2026-10-10.
**Reviewed against:** actual source at branch `lovable-migration-prep` (base `origin/main` @ `84ba70a`, plus this branch's commits).
**Method:** every factual claim about the code was checked in the source (file:line evidence below); the third-party security advisory was verified against public advisories. Nothing below is assumed.

The roadmap's product direction (nutrition-led positioning, budget transparency, clearer onboarding, calmer UI, security baseline, future adult module) is **consistent with the migration plan** in [README.md](README.md). This document fact-checks its technical claims, records what this branch already fixed, and maps each roadmap phase onto the migration so work is done **once, in the right place** — not twice.

---

## 1. Fact-Check of the Roadmap's Technical Claims

| # | Roadmap claim | Verdict | Evidence (confirmed in source) |
|---|---|---|---|
| 1 | Landing hero is "Healthy tummies. Happy kids. No more mealtime battles." | ✅ TRUE | `src/components/marketing/Landing.tsx:191-195` |
| 2 | AI service asks for 28 meals, allergy rules, budget, nutrition estimates | ✅ TRUE | meal-plan system prompt in `src/lib/ai.ts` (verbatim copy in [ai-provider-boundary.md](ai-provider-boundary.md) §2.1) |
| 3 | No post-generation validation that plans are nutritionally balanced / budget-accurate | ✅ TRUE (nuance) | Validation exists but is **structural only**: `sanitizePlan` clamps values, dedupes (day, slot), requires ≥28 meals (`src/lib/ai.ts`). There is **no** food-group-coverage, portion, or budget-fit validation after generation |
| 4 | Fallback plan does not independently prove its cost fits the budget | ✅ TRUE | `fallbackPlan()` (`src/lib/ai.ts`): when the recipe pool has matches, meal cost = the recipe's stored `costEst` — **not** capped by budget; totals can exceed `budgetPerWeek` with no warning. (Empty-pool path costs `budget/28` per meal by construction.) |
| 5 | Budget slider runs R150–R2,000; server accepts as low as R100 | ✅ TRUE | slider `min={150} max={2000}` (`OnboardingView.tsx:223`); API `budgetPerWeek: z.number().min(100).max(5000)` (`src/app/api/children/route.ts:13`) — **the two floors disagree** (150 vs 100) |
| 6 | Activity options are "Calm / Normal / Very active" | ✅ TRUE | `OnboardingView.tsx:166-168` — `🏡 Calm`, `🤸 Normal`, `⚽ Very active` (emoji-prefixed, stored as `low/moderate/high`) |
| 7 | `next-auth` appears in dependencies; sign-in screens use the custom cookie flow | ✅ TRUE | `package.json:66` (`next-auth ^4.24.11`, **never imported anywhere** — dead dependency, also listed in handoff §6); auth is custom scrypt + `nt_session` cookie |
| 8 | No Google or Microsoft sign-in | ✅ TRUE | `AuthView.tsx` has email/password only |
| 9 | Password ≥ 8 chars but `12345678` is accepted | ✅ TRUE | `signup/route.ts:9` — `z.string().min(8).max(100)`, no blocklist/complexity check |
| 10 | No password-reset or email verification | ✅ TRUE | handoff §4 — no email infrastructure exists at all |
| 11 | No protection against repeated login attempts | ✅ TRUE | `login/route.ts` has no rate limiting. v1.1 added rate limiting **only** to the 4 AI endpoints (10/min/user, `src/lib/ratelimit.ts`) — signup/login remain unprotected |
| 12 | API restricts child age to 17 | ✅ TRUE | `children/route.ts:8` — `ageYears: z.number().int().min(1).max(17)` |
| 13 | `bun.lock` resolves Next.js to 16.1.3 | ✅ TRUE **at the time of review** — and fixed on this branch | Confirmed `next@16.1.3` in `bun.lock`; upgraded to **16.4.0** by this branch (see §2) |
| 14 | Advisory GHSA-2xp9-vwfh-vxw4: critical RCE in the Image Optimization API (AVIF/libheif) for Next.js < 16.3.3, published Aug 2026 | ✅ TRUE — verified externally | Public advisories confirm: heap buffer overflow in libheif via sharp, **CVSS 4.0: 9.5**, unauthenticated RCE when an attacker-controlled AVIF image is processed; patched releases **15.5.24 / 16.3.3** (patch disables AVIF optimisation). Exposure here is **reduced but not zero**: the app uses no `next/image` and renders no user-supplied images, but `/_next/image` exists by default on any Next.js deployment |
| 15 | Both "Nutri Tummies" and "NutriTummies" spellings appear in the repo | ✅ TRUE | `NutriTummies` (no space): `Landing.tsx:592` (footer logo), `OnboardingView.tsx:95`. Everything else — page title, README, `/api/health` service name, prompts — uses "Nutri Tummies" |

**One correction to the roadmap's framing:** it reads as if the app has no privacy/legal surface. As of v1.1 there is a full POPIA privacy policy (11 sections incl. children's consent per s34) and terms of use, reachable from the landing footer, signup consent line, and Settings (`LegalView.tsx`). What still doesn't exist: data-subject export/delete paths, subscription cancellation UI, and any email infrastructure — those gaps are real and already tracked in the handoff.

---

## 2. Already Fixed on This Branch (before/with this review)

1. **Next.js 16.1.3 → 16.4.0** (commit "security: upgrade Next.js…"). Closes claim #14. Verified end-to-end: offline tests (AI fallback 9/9, PayFast 6/6), `tsc --noEmit` 0 tracked errors, ESLint clean, production build succeeds, and a full browser journey on the upgraded runtime — landing → signup → onboarding → dashboard → AI meal-plan generation (28 meals, R435 ≤ R450 budget, peanut-allergy respected) → planner rendering, zero console errors.
2. **Broken graceful degradation** (pre-existing, found by this branch's earlier audit — the roadmap wasn't aware of it): fresh meal-plan requests used to **500** instead of degrading whenever the AI provider was unavailable. Fixed + regression-tested by `scripts/test-ai-fallback.ts`. This is directly relevant to the roadmap's Phase 1 concern about the fallback path's honesty.

## 3. Confirmed but Deliberately NOT Fixed Here (and why)

These Phase 6 items are confirmed real (§1 claims #9–#11) but are **not implemented on this branch**:

- **Weak-password rejection** (e.g. block `12345678`) — ~10-line change, but it alters signup behaviour of the legacy app.
- **Login/signup rate limiting** — the limiter exists (`src/lib/ratelimit.ts`); wiring it to auth endpoints is small, but again a behaviour change.
- **OAuth (Google/Microsoft), password reset, email verification** — significant build effort on a custom auth stack.

**Rationale:** the migration plan replaces this app's entire auth layer with Lovable Auth (handoff §8 "Needs adaptation"), and the current app has **no production deployment, no production database, and billing in demo mode** — there is nothing publicly exposed to protect today. Building auth hardening twice (once here, once in Lovable) is exactly the wasted Lovable time/money this migration prep exists to avoid.

**Conditional exception:** if the Next.js app must go **publicly live before the Lovable cutover**, do these three first, in this order: (1) weak-password rejection, (2) login rate limiting, (3) password reset via an email provider. Treat that as a launch gate — the Next.js RCE patch (done) was the only unconditional item because the rollback plan keeps this app deployable during the migration window.

## 4. The 7 ESLint Findings (eslint-plugin-react-hooks 7.1.0)

Upgrading the lint toolchain alongside Next.js surfaced a new rule, `set-state-in-effect`, which flags 7 pre-existing patterns. **No checks were disabled**: the plugin is pinned at 7.0.1 (the version the codebase was validated against) via `package.json` → `resolutions`, and the findings are recorded here instead. Fix them during the roadmap's Phase 4 rework (those files are rewritten there anyway), then remove the pin.

| File:line | Pattern | Recommended fix |
|---|---|---|
| `src/components/views/DashboardView.tsx:54` | `setLoading(true)` synchronously in fetch effect | initialise `loading` state to `true`; drop the sync set (stale-while-revalidate on child switch) |
| `src/components/views/PlannerView.tsx:47` | same | same |
| `src/components/views/DiaryView.tsx:49` | same (also re-runs on date change) | same, keyed on `child+date` |
| `src/components/views/ShoppingView.tsx:41` | same | same |
| `src/components/UpgradeDialog.tsx:43` | `setDone(false); setDemoOrder(null)` on dialog open | reset state during render when `upgradeOpen` flips (React "adjusting state when a prop changes" pattern) |
| `src/components/ui/carousel.tsx:98` | shadcn boilerplate sync setState | update to current shadcn carousel source, or reset-on-prop-change pattern |
| `src/hooks/use-mobile.ts:14` | sync `setState` from matchMedia listener registration | replace with `useSyncExternalStore` (canonical fix; current shadcn does this) |

## 5. Roadmap Phase × Migration Plan Mapping

Where each roadmap phase should actually be executed, so nothing is built twice:

| Roadmap phase | Do it… | Rationale / migration hook |
|---|---|---|
| **1. Nutrition engine** (rules, variety, post-generation validation, honest fallback) | **Spec now → implement in Lovable (migration Phase 5)** | The validation rules are the acceptance criteria for the rebuilt AI layer. Writing them as a testable spec (food-group coverage per day/week, per-meal portion sanity by age, budget-fit check with honest warning, allergen exclusion asserted **after** generation — not just in the prompt) costs nothing here and makes the Lovable rebuild verifiable. Note the fallback budget gap (§1 #4) belongs in the same spec. **Do not advertise "nutritionally balanced" until this exists** — agreed. |
| **2. Budget experience** (tiers, what the budget covers, honest warnings) | **Product decision now → implement in Lovable (Phase 3/5)** | Also fix the R100-vs-R150 floor inconsistency (§1 #5) in the new build. Tier thresholds should come from the validated cost data Phase 1 produces. |
| **3. Onboarding upgrade** (activity wording, 3-tier preferences, guided food groups) | **Design now → implement in Lovable (Phase 2–3)** | The 3-category preference split (enjoys / dislikes / usually-refuses) and food-group structure are **new API fields** — decide their target-schema shape before Lovable Phase 3 (core data CRUD) so the tables are created once. Current schema has single `likes`/`dislikes` comma-strings. |
| **4. UI redesign** (remove emojis, Lucide icons, simplify nav, responsive pass) | **In Lovable (Phases 1–5, during the paste-based rebuild)** | Doing this in the Next.js app now is double work: every view gets pasted into Lovable and restyled there anyway. Emoji inventory for the rewriter: activity buttons (`🏡🤸⚽`), `Coach Nandi ✨` tab label, per-slot meal emojis (`🌅☀️🍎🌙`), `Recipe.emoji` **DB column** (default `🍽️` — schema change to drop), toast copy. |
| **5. Landing page & copy** | **Approve copy now → implement in Lovable (Phase 1, static shell)** | The proposed positioning ("Nourishing meals. Healthier habits. A stronger start in life.") and feature table replace the current hero (§1 #1). Resolve the Pro-tier pricing contradictions first (handoff §7 #3 — landing says R199/30-children "Crèche & Pro", code sells R129 unlimited): the new landing must ship with one truth. |
| **6. Security & privacy** | **Split** — see §3 | Done: Next.js RCE patch. Conditional pre-launch: weak-password rejection, login rate limiting, password reset. Never here: OAuth + email verification (Lovable Auth provides them; handoff decision P4). POPIA policy text already exists (§1 correction) — carry it to Lovable, update processor list. |
| **7. Adult wellness platform** (person vs recipient) | **Architecture decision BEFORE Lovable Phase 3; build much later** | The draft target schema (`data-migration.md` §3) is child-centric, like the current app. If the person-vs-recipient split is the agreed end-state, design it into the Lovable schema **now** (a `profiles`/`persons` table the `users` auth record links to, children as one profile type) even though only child profiles are built initially — otherwise the next expansion forces another data migration. This is the single most time-saving early decision in this list. |

## 6. New Product Decisions Added by the Roadmap

Appended to handoff §11 (see that file for the original P1–P8 / T1–T6):

| # | Decision | Why it matters now |
|---|---|---|
| P9 | **Brand spelling**: standardise on "Nutri Tummies" (or "NutriTummies") | Copy lands in Lovable Phase 1; fix once, everywhere, for free there. Current split: `Landing.tsx:592`, `OnboardingView.tsx:95` |
| P10 | **Person-vs-recipient profile split** (roadmap Phase 7) | Must be decided before Lovable Phase 3 creates the core tables (see §5 row 7) |
| P11 | **Onboarding preference model** (3 categories + food groups vs current likes/dislikes strings) | New target-schema fields; decide before Lovable Phase 3 |
| P12 | **Pre-cutover launch of the legacy app?** | If yes, the §3 conditional security work becomes mandatory before it goes public |

## 7. Suggested Order (merging roadmap + migration)

1. **Decisions first (no code):** P1 (Pro tier truth), P9 (spelling), P10 (profile split), P11 (preference model), P4 (re-onboarding UX), P6 (AI provider + budget).
2. **Write the Phase 1 nutrition/budget validation spec** — it doubles as the Lovable acceptance criteria (handoff Phase 5 acceptance checks).
3. **Migration Phases 0–4** per the handoff (export, static shell w/ new copy, auth, core CRUD with the decided schema, recipes).
4. **Migration Phase 5 (AI layer)** implementing the validation spec alongside the prompts/fallbacks from `ai-provider-boundary.md` — this is where roadmap Phase 1–3 actually get built.
5. **Billing (Phase 6), data import (Phase 7), cutover (Phase 8)** per the handoff.
6. **Post-cutover:** remove the ESLint pin once the Phase 4 UI rework has fixed the §4 patterns (they are rewritten during steps 3–4 anyway); adult module per roadmap Phase 7 when the child product is validated.

**Net effect on Lovable time/cost:** every roadmap item that touches UI or backend lands *inside* the migration phases that were already planned — none of them adds a separate workstream in Lovable, provided the schema decisions (P10, P11) are made before Phase 3.
