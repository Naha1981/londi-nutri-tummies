# 🥗 Nutri Tummies

**AI-powered child nutrition for South African families.** Plan a full week of budget-friendly, allergy-safe meals your kids will actually eat — in under a minute.

Nutri Tummies takes the daily stress out of feeding a family: it generates personalised 7-day meal plans around each child's age, allergies and your weekly food budget (in Rand), builds your shopping list, learns from what your kids actually ate, and gives you an AI nutrition coach in your pocket.

---

## ✨ Features

| Area | What you get |
|---|---|
| 🤖 **AI Meal Planning** | 7-day plans (breakfast, lunch, dinner, snack) tuned to age, allergies, budget and SA staples — with portions, ZAR cost estimates and nutrition notes |
| 🛒 **Smart Shopping Lists** | One tap generates a categorised shopping list from any meal plan, with running Rand totals |
| 👶 **Multi-Child Profiles** | Each child gets their own profile, allergen flags, avatar and plan |
| 🍲 **Recipe Library** | 20 South African kid-approved recipes seeded in (pap, bobotie, vetkoek, amagwinya, bunny chow, samp & more) plus AI recipe generation from what's already in your kitchen |
| 📔 **Food Diary** | Track what was actually eaten with star ratings — the AI uses this to improve future plans |
| 💬 **AI Nutrition Coach** | Ask anything about fussy eating, portion sizes, budget swaps — chat history saved |
| 💰 **Budget Guardrails** | Set a weekly food budget; plans are generated to land inside it |
| 💳 **Built-in Billing** | PayFast & Yoco checkout with signed webhooks (demo mode until merchant keys are set) |
| 🚦 **Scale Hardening** | DB-backed rate limiting on AI endpoints + AI response caching for cost control |
| 🆓 **Freemium + 14-Day Trial** | Free tier (1 child, 1 plan), 14-day premium trial on signup, then R79/month or R790/year |
| 🔒 **POPIA-ready** | Privacy policy & terms built in, session-cookie auth, scrypt password hashing, per-user data isolation on every API call |

## 🖼️ Screenshots

| | |
|---|---|
| ![Landing](screenshots/01-landing.png) | ![Dashboard](screenshots/03-dashboard-plan.png) |
| ![Planner](screenshots/04-planner.png) | ![Coach](screenshots/07-coach.png) |

## 🧱 Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS 4 + shadcn/ui, custom Nunito-based brand system
- **State:** Zustand + TanStack Query
- **Database:** Prisma ORM (SQLite in dev — swap `DATABASE_URL` to hosted Postgres for production)
- **Auth:** Custom session-cookie auth (scrypt hashing, httpOnly cookies)
- **AI:** z-ai-web-dev-sdk (GLM) with structured JSON output and deterministic fallbacks if the model is unavailable
- **Validation:** Zod on every API route

## 🚀 Getting Started

```bash
# 1. Install dependencies
bun install        # or npm install

# 2. Configure environment
cp .env.example .env   # then edit DATABASE_URL if needed

# 3. Create the database and seed the recipe library
bun run db:push
bunx tsx scripts/seed.ts

# 4. Start the dev server
bun run dev
```

Open http://localhost:3000, create an account and add your first child profile.

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Prisma connection string. SQLite (`file:...`) for local dev, Postgres URL for production. |
| `NEXT_PUBLIC_APP_URL` | ⬜ | Public URL — used to build payment return/webhook URLs. Falls back to request host. |
| `PAYFAST_MERCHANT_ID` | ⬜ | PayFast merchant ID — setting this + the key switches billing to live PayFast checkout. |
| `PAYFAST_MERCHANT_KEY` | ⬜ | PayFast merchant key. |
| `PAYFAST_PASSPHRASE` | ⬜ | PayFast passphrase (used for ITN signature verification). |
| `PAYFAST_MODE` | ⬜ | `sandbox` (default) or `live`. |
| `YOCO_SECRET_KEY` | ⬜ | Yoco secret key — switches billing to Yoco hosted checkout. |

**No payment keys set?** Billing runs in clearly-labelled **demo mode**: the full upgrade flow works, payments are simulated, and adding real keys later switches checkout to the live provider with zero code changes.

## ☁️ Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel (framework auto-detected; `postinstall` generates the Prisma client automatically).
2. Set `DATABASE_URL` in Vercel → Settings → Environment Variables (use a hosted Postgres such as Neon or Vercel Postgres — the serverless filesystem has no persistent SQLite).
3. Run `npx prisma db push` against the production database (locally with the prod URL, or via a one-off job), then seed recipes with `npx tsx scripts/seed.ts`.
4. Optionally set `NEXT_PUBLIC_APP_URL` and payment provider keys (see table above).
5. Deploy. All AI features degrade gracefully to deterministic fallbacks if no model credentials are available, so the app never breaks.

### Going live with payments

1. Sign up at PayFast (or Yoco) and grab your merchant credentials.
2. Add them as Vercel environment variables → redeploy.
3. Point PayFast's ITN at `https://your-domain/api/billing/notify` (done automatically if `NEXT_PUBLIC_APP_URL` is set).
4. Test with `PAYFAST_MODE=sandbox` first, then switch to `live`.

## 📁 Project Structure

```
prisma/schema.prisma        # User, Session, Child, MealPlan, PlanMeal, Recipe,
                            # DiaryEntry, ShoppingItem, CoachMessage
src/lib/                    # auth (sessions/entitlements), db, ai service layer
src/app/api/                # 10 route groups, Zod-validated, ownership-checked
src/components/views/       # Landing, Auth, Onboarding, Dashboard, Planner,
                            # Recipes, Diary, Shopping, Coach, Settings
src/components/marketing/   # Public landing page sections
scripts/seed.ts             # 20 SA recipes with ZAR costs & allergens
```

## 💳 Monetisation

Free tier → 14-day premium trial → Premium (R79/mo) or Pro (R129/mo). Entitlements are enforced server-side in `src/lib/auth.ts` (children count, plan generations, coach messages per day).

---

Built with ❤️ for South African parents.
