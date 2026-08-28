// E2E verification of v1.1 hardening: billing (demo), rate limiting, AI caching.
// Run: bun scripts/test-hardening.ts
// Uses the dev server at http://localhost:3000.

const BASE = "http://localhost:3000";
let cookie = "";
let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, extra = "") {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ FAIL: ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

async function main() {
  console.log("\n━━━ 1. Signup + session ━━━");
  const email = `hardening_${Date.now()}@test.co.za`;
  let r = await api("POST", "/api/auth/signup", { name: "Hardening Tester", email, password: "testpass123" });
  check("signup", r.status === 200 && r.data.user, `plan=${r.data.user?.plan}`);
  check("premiumUntil in session payload", r.data.user && "premiumUntil" in r.data.user);

  console.log("\n━━━ 2. Child + meal plan (cache + rate-limit infra) ━━━");
  r = await api("POST", "/api/children", { name: "Thabo", ageYears: 6, allergies: "", budgetPerWeek: 450 });
  const childId = r.data.child?.id;
  check("create child", !!childId);

  r = await api("POST", "/api/mealplan", { childId });
  check("meal plan generated", r.status === 200 && r.data.plan?.meals?.length > 0, `${r.data.plan?.meals?.length} meals`);
  const planId = r.data.plan?.id;

  console.log("\n━━━ 3. Billing: catalogue + demo checkout ━━━");
  r = await api("GET", "/api/billing/checkout");
  check("plan catalogue", r.status === 200 && r.data.plans?.length === 3, `provider=${r.data.provider}`);
  check("demo provider (no keys configured)", r.data.provider === "demo");

  r = await api("POST", "/api/billing/checkout", { planId: "premium_monthly" });
  check("create order", r.status === 200 && r.data.mode === "demo" && r.data.orderId);
  const orderId = r.data.orderId;

  r = await api("GET", "/api/billing/orders");
  check("order history shows pending order", r.status === 200 && r.data.orders?.some((o: any) => o.id === orderId && o.status === "pending"));

  r = await api("POST", "/api/billing/demo-complete", { orderId });
  check("demo payment completes", r.status === 200 && r.data.ok === true, `plan=${r.data.plan}`);
  check("user upgraded to premium", r.data.plan === "premium");
  const until = r.data.premiumUntil ? new Date(r.data.premiumUntil) : null;
  check("premiumUntil ≈ +30 days", !!until && until.getTime() > Date.now() + 29 * 24 * 3600 * 1000, until?.toISOString());

  r = await api("POST", "/api/billing/demo-complete", { orderId });
  check("idempotent: second complete is alreadyPaid", r.status === 200 && r.data.alreadyPaid === true);

  r = await api("GET", "/api/auth/me");
  check("session now premium", r.data.user?.plan === "premium", `premiumUntil=${r.data.user?.premiumUntil}`);

  console.log("\n━━━ 4. Shopping list (cache path — before burst exhaustion) ━━━");
  r = await api("POST", "/api/shopping/generate", { planId });
  check("shopping list generated", r.status === 200 && r.data.created > 0, `${r.data.created} items`);
  r = await api("POST", "/api/shopping/generate", { planId });
  check("second generate served (cache hit)", r.status === 200 && r.data.created > 0);

  console.log("\n━━━ 5. Rate limiting (burst) ━━━");
  // 10 AI calls/min allowed; we've used several already. Same child+week → cached, fast.
  let lastStatus = 200;
  for (let i = 0; i < 12; i++) {
    const rr = await api("POST", "/api/mealplan", { childId });
    lastStatus = rr.status;
    if (lastStatus === 429) {
      check(`429 after burst (call #${i + 2})`, true, `retryAfterSec=${rr.data.retryAfterSec}`);
      break;
    }
  }
  if (lastStatus !== 429) check("429 after burst", false, `last status ${lastStatus}`);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nRESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Test run crashed:", e);
  process.exit(1);
});
