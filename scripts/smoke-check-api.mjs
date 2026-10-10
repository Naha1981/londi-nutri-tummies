// Nutri Tummies — API surface smoke check
//
// Walks the full public API surface of the running app (read-only by default)
// and prints PASS/FAIL per endpoint. Use it to verify the app after upgrades
// (e.g. the Next.js 16.4.0 security patch) and as the behavioural baseline
// for the Lovable rebuild: the rebuilt backend should satisfy the same checks
// (adapted to its own transport) before cutover.
//
// Safe by design:
//   • Read-only unless --generate is passed (which creates one meal plan and
//     therefore may invoke one AI call, subject to cache/rate limit).
//   • Uses a synthetic test account (created via signup if it doesn't exist).
//     Never point --email at a real account.
//
// Usage:
//   node scripts/smoke-check-api.mjs                                   # http://localhost:3000
//   node scripts/smoke-check-api.mjs --base http://localhost:3000 \
//        --email smoke@example.com --password 'TestPass1234!' --name 'Smoke' \
//        [--generate]

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) =>
    a.startsWith("--") ? [a.slice(2), all[i + 1]?.startsWith("--") ? true : all[i + 1] ?? true] : []
  )
);

const BASE = (typeof args.base === "string" && args.base) || "http://localhost:3000";
const EMAIL = (typeof args.email === "string" && args.email) || "smoke-test@example.com";
const PASSWORD = (typeof args.password === "string" && args.password) || "TestPass1234!";
const NAME = (typeof args.name === "string" && args.name) || "Smoke Test";

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

async function main() {
  // --- auth: login, or signup a fresh synthetic account ---
  let res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (res.status === 401) {
    res = await fetch(`${BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: NAME, email: EMAIL, password: PASSWORD }),
    });
    check("signup (synthetic account)", res.status === 200, `status ${res.status}`);
  } else {
    check("login", res.status === 200, `status ${res.status}`);
  }
  const token = /nt_session=([^;]+)/.exec(res.headers.get("set-cookie") || "")?.[1];
  check("session cookie issued", !!token);
  if (!token) throw new Error("cannot continue without a session");
  const H = { Cookie: `nt_session=${token}` };

  // --- session surface ---
  const me = await (await fetch(`${BASE}/api/auth/me`, { headers: H })).json();
  check("GET /api/auth/me", !!me.user?.email, `${me.user?.email} · plan ${me.user?.plan}`);
  const child = me.children?.[0];
  check("has at least one child profile", !!child, child ? `${child.name} (age ${child.ageYears})` : "run onboarding first");

  if (child) {
    const monday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    })();

    const mp = await (await fetch(`${BASE}/api/mealplan?childId=${child.id}&week=${monday}`, { headers: H })).json();
    check("GET /api/mealplan", mp.plan !== undefined, mp.plan ? `${mp.plan.meals?.length ?? 0} meals · R${mp.plan.estimatedCost}` : "no plan yet (use --generate)");

    if (args.generate === true) {
      const gen = await (
        await fetch(`${BASE}/api/mealplan`, {
          method: "POST",
          headers: { ...H, "Content-Type": "application/json" },
          body: JSON.stringify({ childId: child.id }),
        })
      ).json();
      check("POST /api/mealplan (generate)", !!gen.plan, `${gen.plan?.meals?.length ?? 0} meals · degraded: ${gen.degraded ?? false}`);
    }

    const diary = await (await fetch(`${BASE}/api/diary?childId=${child.id}`, { headers: H })).json();
    check("GET /api/diary", Array.isArray(diary.entries), `${diary.entries?.length ?? 0} entries`);
  }

  const recipes = await (await fetch(`${BASE}/api/recipes`, { headers: H })).json();
  check("GET /api/recipes", Array.isArray(recipes.recipes), `${recipes.recipes?.length ?? 0} in library`);

  const shopping = await (await fetch(`${BASE}/api/shopping`, { headers: H })).json();
  check("GET /api/shopping", Array.isArray(shopping.items), `${shopping.items?.length ?? 0} items`);

  const coach = await (await fetch(`${BASE}/api/coach`, { headers: H })).json();
  check("GET /api/coach", Array.isArray(coach.messages), `${coach.messages?.length ?? 0} messages`);

  const checkout = await (await fetch(`${BASE}/api/billing/checkout`, { headers: H })).json();
  check("GET /api/billing/checkout", !!checkout.provider, `provider: ${checkout.provider}`);

  const orders = await (await fetch(`${BASE}/api/billing/orders`, { headers: H })).json();
  check("GET /api/billing/orders", Array.isArray(orders.orders), `${orders.orders?.length ?? 0} orders`);

  const health = await (await fetch(`${BASE}/api/health`)).json();
  check("GET /api/health", health.status === "ok", `db: ${health.database}`);

  console.log(failures === 0 ? "\nSmoke check: ALL PASS" : `\nSmoke check: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Smoke check crashed:", e.message);
  process.exit(1);
});
