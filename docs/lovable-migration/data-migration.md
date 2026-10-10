# Data Migration — Schema Mapping & Export Guide

**Status: DRAFT FOR REVIEW.** The SQL below was **not applied to any database.** It is a proposed mapping from the actual Prisma schema (`prisma/schema.prisma`, audited at branch `lovable-migration-prep`) to a hosted Postgres / Lovable Cloud-style database. Column types follow plain Postgres; anything Lovable Cloud-specific (RLS helpers, client SDK types, auth integration) is marked **[verify during migration]**.

---

## 1. Source Data Model (actual, confirmed)

11 tables. All user-owned rows carry `userId` with `onDelete: Cascade` from `User`.

```
User 1─n Session
User 1─n Child 1─n MealPlan 1─n PlanMeal
User 1─n MealPlan            (denormalised userId on MealPlan + PlanMeal via plan)
User 1─n DiaryEntry (also FK → Child)
User 1─n ShoppingItem        (no child link — list is per-user, not per-child)
User 1─n CoachMessage        (no child link)
User 1─n PaymentOrder
Recipe                      (GLOBAL — no userId, no owner)
RateLimit, AiCache          (transient, key-value style)
```

Idiosyncrasies the target schema must preserve or consciously change:

1. **`MealPlan` has both `userId` and `childId`** (both cascade). A plan belongs to a user *and* a child.
2. **`DiaryEntry` also has both** — same pattern.
3. **`Recipe.ingredients` / `instructions` are JSON strings** (not arrays) — `'[{"item":"Eggs","qty":"3"}]'`.
4. **`Child.allergies/dislikes/likes/tags` are comma-separated strings**, not arrays.
5. **`weekStart` and `date` are `YYYY-MM-DD` strings**, not date columns.
6. **`PlanMeal` has no `userId`** — ownership is reached via `MealPlan`. The current code never queries PlanMeal directly except through its plan.
7. **`Recipe` rows created by AI (POST /api/recipes) have no owner** — they're global from creation.
8. **`Session.token` is stored raw** (only the DB holds it; the cookie carries the same value). Never export.
9. IDs are Prisma `cuid()` strings — safe as text primary keys in Postgres.

---

## 2. Table Classification

| Table | Classification | Migrate? | Sensitivity | Notes |
|---|---|---|---|---|
| `User` | user-owned | **Yes** | 🔴 High | email, name, plan, password hash (see §5), trial/subscription dates |
| `Child` | user-owned | **Yes** | 🔴 **Highest — minors' data** | name, age, sex, **allergies** (health data), likes/dislikes, budget |
| `DiaryEntry` | user-owned | **Yes** | 🔴 **Highest — minors' data** | what a child ate, ratings, free-text notes (may contain health context) |
| `CoachMessage` | user-owned | **Yes** | 🔴 High | chat may contain feeding/health details about children |
| `MealPlan` | user-owned | **Yes** | 🟠 Medium | derived from child profile |
| `PlanMeal` | user-owned (via plan) | **Yes** | 🟠 Medium | generated content |
| `ShoppingItem` | user-owned | **Yes** | 🟢 Low | grocery lines; implies household composition at most |
| `PaymentOrder` | user-owned | **Yes** | 🔴 High (financial) | amounts, plan purchased, provider refs; keep for tax/dispute/POPIA records |
| `Recipe` | **static seed/reference + user-contributed global** | **Yes** (seed at minimum) | 🟢 Low | 20 seeded rows + any AI-generated rows (publicly visible today) |
| `Session` | transient | **No** | 🔴 (contains live bearer tokens) | force re-login at cutover instead |
| `RateLimit` | transient | **No** | — | fixed-window counters, self-expiring |
| `AiCache` | transient | **No** | 🟡 cached AI outputs (may embed child profile fragments) | cheaper to rebuild than to migrate; keys are input-hashes |

**Why not migrate the transient tables:** `Session` tokens are bearer credentials — exporting them creates a secrets-handling problem for zero benefit (cutover logs everyone out once anyway). `RateLimit` counters are only meaningful inside a running window. `AiCache` entries expire within 1 h–7 d and are keyed to the old AI provider's exact outputs; the new provider invalidates them semantically.

---

## 3. Proposed Target Schema (draft DDL — do NOT apply without review)

Conventions: snake_case, text cuid PKs preserved (so exports import without ID remapping), `created_at/updated_at` as `timestamptz`, FKs with the same cascade semantics, and a `legacy_*` prefix nowhere — original column names are kept 1:1 where possible so the importer is a straight column map.

```sql
-- DRAFT FOR REVIEW — NOT APPLIED
-- Mapping source: prisma/schema.prisma @ lovable-migration-prep

CREATE TABLE users (
  id              TEXT PRIMARY KEY,                -- cuid, preserved from export
  email           TEXT NOT NULL UNIQUE,
  -- password_hash intentionally NOT defined here: see §5 (account migration).
  -- If the target auth keeps its own credentials table, users below is the
  -- profile record and auth links by email/id  [verify during migration].
  name            TEXT NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'premium_trial'
                    CHECK (plan IN ('free','premium_trial','premium','pro')),
  trial_ends_at   TIMESTAMPTZ,
  premium_until   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE children (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  age_years       INTEGER NOT NULL CHECK (age_years BETWEEN 1 AND 17),
  sex             TEXT NOT NULL DEFAULT 'other',
  allergies       TEXT NOT NULL DEFAULT '',        -- comma-separated (source format kept)
  dislikes        TEXT NOT NULL DEFAULT '',
  likes           TEXT NOT NULL DEFAULT '',
  budget_per_week DOUBLE PRECISION NOT NULL DEFAULT 450,   -- ZAR
  activity_level  TEXT NOT NULL DEFAULT 'moderate',
  avatar_color    TEXT NOT NULL DEFAULT 'emerald',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX children_user_idx ON children(user_id);

CREATE TABLE meal_plans (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id        TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  week_start      TEXT NOT NULL,                   -- 'YYYY-MM-DD' (Monday); kept TEXT to match source
  status          TEXT NOT NULL DEFAULT 'active',
  budget          DOUBLE PRECISION,
  estimated_cost  DOUBLE PRECISION,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX meal_plans_user_week_idx ON meal_plans(user_id, week_start);
CREATE INDEX meal_plans_child_idx ON meal_plans(child_id);

CREATE TABLE plan_meals (
  id            TEXT PRIMARY KEY,
  meal_plan_id  TEXT NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day           INTEGER NOT NULL CHECK (day BETWEEN 0 AND 6),   -- 0=Mon
  slot          TEXT NOT NULL CHECK (slot IN ('breakfast','lunch','dinner','snack')),
  name          TEXT NOT NULL,
  description   TEXT,
  calories      INTEGER NOT NULL DEFAULT 0,
  protein       DOUBLE PRECISION NOT NULL DEFAULT 0,
  carbs         DOUBLE PRECISION NOT NULL DEFAULT 0,
  fat           DOUBLE PRECISION NOT NULL DEFAULT 0,
  veggies       BOOLEAN NOT NULL DEFAULT FALSE,
  cost_est      DOUBLE PRECISION NOT NULL DEFAULT 0,
  recipe_text   TEXT
);
CREATE INDEX plan_meals_plan_idx ON plan_meals(meal_plan_id);
-- Optional uniqueness the app already enforces in code (dedupe day+slot):
-- CREATE UNIQUE INDEX plan_meals_plan_day_slot_idx ON plan_meals(meal_plan_id, day, slot);

CREATE TABLE diary_entries (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id    TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,                       -- 'YYYY-MM-DD'
  slot        TEXT NOT NULL CHECK (slot IN ('breakfast','lunch','dinner','snack')),
  what        TEXT NOT NULL,
  servings    INTEGER NOT NULL DEFAULT 1,
  rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
  notes       TEXT,
  calories    INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX diary_user_date_idx ON diary_entries(user_id, date);
CREATE INDEX diary_child_idx ON diary_entries(child_id);

CREATE TABLE shopping_items (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  qty         TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'General',
  est_cost    DOUBLE PRECISION,
  checked     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shopping_user_idx ON shopping_items(user_id);

CREATE TABLE coach_messages (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX coach_user_created_idx ON coach_messages(user_id, created_at);

CREATE TABLE payment_orders (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL CHECK (provider IN ('payfast','yoco','demo')),
  plan_id       TEXT NOT NULL CHECK (plan_id IN ('premium_monthly','premium_yearly','pro_monthly')),
  plan_label    TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL,                  -- ZAR cents
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','paid','failed','cancelled')),
  provider_ref  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_orders_user_status_idx ON payment_orders(user_id, status);
CREATE INDEX payment_orders_status_updated_idx ON payment_orders(status, updated_at);

CREATE TABLE recipes (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('breakfast','lunch','dinner','snack')),
  cuisine       TEXT NOT NULL DEFAULT 'South African',
  minutes       INTEGER NOT NULL DEFAULT 20,
  servings      INTEGER NOT NULL DEFAULT 2,
  ingredients   TEXT NOT NULL,                     -- JSON string [{item,qty}] (source format kept)
  instructions  TEXT NOT NULL,                     -- JSON string [steps]
  calories      INTEGER NOT NULL DEFAULT 0,
  protein       DOUBLE PRECISION NOT NULL DEFAULT 0,
  carbs         DOUBLE PRECISION NOT NULL DEFAULT 0,
  fat           DOUBLE PRECISION NOT NULL DEFAULT 0,
  cost_est      DOUBLE PRECISION NOT NULL DEFAULT 0,
  tags          TEXT NOT NULL DEFAULT '',          -- comma-separated
  allergens     TEXT NOT NULL DEFAULT '',          -- comma-separated
  kid_approved  BOOLEAN NOT NULL DEFAULT TRUE,
  emoji         TEXT NOT NULL DEFAULT '🍽️'
);
CREATE INDEX recipes_category_idx ON recipes(category);

-- Transient tables (NOT migrated). Recreate equivalents in the target if the
-- Lovable backend keeps the same mechanisms  [verify during migration]:
--   sessions(token unique, user_id, expires_at)  — likely replaced by Lovable Auth
--   rate_limits(key unique, count, expires_at)
--   ai_cache(key unique, kind, response, hits, expires_at)
```

**Row-level security (draft — verify during migration):** if the target Postgres exposes RLS, the minimal policy set is: on every user-owned table, `USING (user_id = auth.uid())` where `auth.uid()` resolves the request's user **[verify how Lovable exposes auth identity to the DB]**. `recipes` is readable by all, writable by nobody directly (AI generation goes through backend code). `payment_orders` readable by owner; writes only via webhook/backend roles.

---

## 4. Type & Value Conversion Notes

| Source (SQLite/Prisma) | Target | Rule |
|---|---|---|
| `String` cuid ids | `TEXT` PK | copy verbatim — no remapping |
| `DateTime` | `TIMESTAMPTZ` | Prisma stores UTC; export emits ISO-8601 UTC |
| `Float` (budgets, macros, costs) | `DOUBLE PRECISION` | exact |
| `weekStart` / `date` `YYYY-MM-DD` | kept `TEXT` | converting to `DATE` is safe but changes nothing functionally; keep TEXT for a 1:1 import |
| `ingredients`/`instructions` JSON strings | kept `TEXT` | **do not** auto-parse to `JSONB` during migration — the app contract is string-typed; convert only if the new backend is written for `JSONB` |
| comma-separated allergies/tags | kept `TEXT` | same rationale |
| `plan` enum-ish strings | `CHECK` constraint | values confirmed: `free`, `premium_trial`, `premium`, `pro` |
| `slot`/`category` strings | `CHECK` constraint | values confirmed: 4 meal slots each |

**Effective-plan pitfall:** the stored `plan` may say `premium_trial` while the user is effectively `free` (expired trial — see handoff §4). Import raw values + both timestamps, and reproduce `planActive()`; or, as a one-off cutover decision, materialise effective plans and zero the stale fields. Pick one and record it in the manifest.

---

## 5. Account & Password Migration (recommendation)

**Do not assume the existing scrypt hashes can be imported into Lovable Auth.** The current format is custom — `scryptSync(password, salt, 64)` rendered as `salt-hex ':' hash-hex`, default cost parameters, no version marker, no algorithm metadata. Auth providers that accept imported hashes expect specific formats (e.g. bcrypt/argon2 strings or a documented scrypt envelope) **[verify during migration what Lovable Auth accepts — technical unknown T2]**. Treat importability as unconfirmed.

**Recommended flow (works regardless of T2's answer):**

1. Export users **without** password hashes (the exporter's default). Email, name, plan, dates are all you need to pre-create accounts.
2. Pre-create accounts in the target marked `needs_password_setup = true` (or equivalent), linked by email.
3. At cutover, send every legacy user a **magic-link / set-password email** (this is decision P4 in the handoff; it requires an email provider, which the current app does not have).
4. On first login, the user's children/plans/diary are already there — the re-login is the only friction.
5. Keep the legacy app reachable read-only for a window (e.g. 30 days) as the support fallback; after the window, retire the old DB.
6. Only if T2 confirms a compatible hash-import: re-export users **with** `--include-password-hashes`, import into the auth system, and skip the forced reset for users who opt to just sign in. The hashes are still needed by the legacy app during the overlap window, so never destroy the source.

**Why magic-link over forced-reset emails:** it removes typo/abuse surface for a parent audience, and it works even if the hash import turns out to be impossible. Both need email deliverability, so an email provider is unavoidable either way.

**Children's data:** all migrated child profiles are minors' personal information under POPIA. The import files are the most sensitive artifact this process produces — store them encrypted, limit access, record who ran the import, and delete the files after the retention window you set in the cutover checklist.

---

## 6. Export Tool (`scripts/export-for-migration.ts`)

Safety-first exporter, committed on this branch. Behaviour:

- **Explicit connection required:** `--database-url <url>` must be passed on the command line. Without it the tool prints usage and exits — it never reads `.env` implicitly and never guesses.
- **Dry-run by default.** Without `--write` it connects, counts rows per table, validates connectivity, and prints **only counts** — no personal data, no tokens, ever.
- **`--write` + `--out <dir>`** (default `./migration-export/`, refuses to overwrite an existing directory unless `--force`) produces:
  - one JSONL file per table (`users.jsonl`, `children.jsonl`, `meal_plans.jsonl`, `plan_meals.jsonl`, `diary_entries.jsonl`, `shopping_items.jsonl`, `coach_messages.jsonl`, `payment_orders.jsonl`, `recipes.jsonl`)
  - `manifest.json` — UTC timestamp, source URL **with password redacted**, per-table row counts, sensitivity classification, tool version.
- **Password hashes excluded by default.** The `users.jsonl` `passwordHash` field is `null` unless you pass `--include-password-hashes` (documented for the §5 step-6 case only).
- **Never exports:** `Session` (bearer tokens), `RateLimit`, `AiCache` — hard-excluded, not just defaulted.
- **No row content is ever logged** — only table names and counts.
- **Provider note:** the Prisma client in this repo is generated for SQLite, so as-is it exports the local dev DB (`--database-url file:./db/custom.db`). To export from a production Postgres, temporarily switch `prisma/schema.prisma` datasource provider to `postgresql`, run `bunx prisma generate`, then run the tool with the Postgres URL. (As of this branch there is no production database — billing runs in demo mode — so the SQLite path is the live scenario.)

Example dry run (safe, no files written):

```bash
bunx tsx scripts/export-for-migration.ts --database-url file:./db/custom.db
```

Example real export:

```bash
bunx tsx scripts/export-for-migration.ts \
  --database-url file:./db/custom.db \
  --write --out ./migration-export
```

**Importer expectation:** each JSONL line is one row with source column names (camelCase, as Prisma sees them) — the target column mapping is §3. IDs are preserved, so foreign relationships import as-is.

---

## 7. Import Order (respects FKs)

1. `users` → 2. `children` → 3. `meal_plans` → 4. `plan_meals` → 5. `diary_entries` → 6. `shopping_items` → 7. `coach_messages` → 8. `payment_orders` → 9. `recipes` (independent).

After import, run these reconciliation checks (counts must match `manifest.json` exactly):

```sql
-- DRAFT FOR REVIEW — reconciliation queries
SELECT 'users' t, count(*) FROM users
UNION ALL SELECT 'children', count(*) FROM children
UNION ALL SELECT 'meal_plans', count(*) FROM meal_plans
UNION ALL SELECT 'plan_meals', count(*) FROM plan_meals
UNION ALL SELECT 'diary_entries', count(*) FROM diary_entries
UNION ALL SELECT 'shopping_items', count(*) FROM shopping_items
UNION ALL SELECT 'coach_messages', count(*) FROM coach_messages
UNION ALL SELECT 'payment_orders', count(*) FROM payment_orders
UNION ALL SELECT 'recipes', count(*) FROM recipes;

-- orphans must all be 0 (cascades in source guarantee it, verify anyway)
SELECT count(*) FROM meal_plans mp
  LEFT JOIN children c ON c.id = mp.child_id
  LEFT JOIN users u ON u.id = mp.user_id
  WHERE c.id IS NULL OR u.id IS NULL;
SELECT count(*) FROM diary_entries d
  LEFT JOIN children c ON c.id = d.child_id
  LEFT JOIN users u ON u.id = d.user_id
  WHERE c.id IS NULL OR u.id IS NULL;
```
