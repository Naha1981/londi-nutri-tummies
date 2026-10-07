// Nutri Tummies — migration export tool (non-destructive)
//
// Exports user-owned + reference tables to JSONL for a Lovable (or any)
// migration. Safety rules baked in:
//   • --database-url is REQUIRED on the command line (never reads .env, never guesses)
//   • DRY RUN by default: prints per-table row counts only; no data leaves the DB
//   • --write is required to produce files; output dir must not exist (or pass --force)
//   • NEVER exports: Session (bearer tokens), RateLimit, AiCache (transient)
//   • passwordHash is null in the users export unless --include-password-hashes is set
//   • logs only table names and counts — no row content, no secrets
//
// Usage:
//   bunx tsx scripts/export-for-migration.ts --database-url file:./db/custom.db            # dry run
//   bunx tsx scripts/export-for-migration.ts --database-url file:./db/custom.db \
//        --write --out ./migration-export                                                   # real export
//
// Postgres source: the Prisma client in this repo is generated for SQLite. To
// export from Postgres, temporarily set the datasource provider in
// prisma/schema.prisma to "postgresql", run `bunx prisma generate`, then pass
// the Postgres URL. (See docs/lovable-migration/data-migration.md §6.)

import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

type TableSpec = {
  name: string; // export file name (snake_case)
  sensitivity: string; // documented classification
  count: (db: PrismaClient) => Promise<number>;
  rows: (db: PrismaClient) => Promise<unknown[]>;
};

const TOOL_VERSION = "1.0.0";

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--write") args.write = true;
    else if (a === "--force") args.force = true;
    else if (a === "--include-password-hashes") args.includeHashes = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function usage(): string {
  return `
Migration export tool (dry-run by default — no files written without --write)

  --database-url <url>             REQUIRED. Prisma connection string, passed
                                   explicitly (e.g. file:./db/custom.db or a
                                   Postgres URL). Never read from .env.
  --write                          Actually write JSONL files (default: dry run).
  --out <dir>                      Output directory (default ./migration-export).
                                   Must not already exist, unless --force.
  --force                          Allow writing into an existing (empty-ish) dir.
  --include-password-hashes        Include User.passwordHash in users.jsonl.
                                   Only for a confirmed hash-import path — see
                                   docs/lovable-migration/data-migration.md §5.
  --tables a,b                     Export only these tables (comma-separated).
  --help                           This message.

Excluded by design: Session (bearer tokens), RateLimit, AiCache (transient).
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const databaseUrl = typeof args["database-url"] === "string" ? (args["database-url"] as string) : "";
  if (!databaseUrl) {
    console.error("ERROR: --database-url is required. The tool never reads .env or guesses a connection.\n");
    console.error(usage());
    process.exit(1);
  }

  const includeHashes = args.includeHashes === true;
  const onlyTables =
    typeof args.tables === "string" && args.tables
      ? (args.tables as string).split(",").map((s) => s.trim()).filter(Boolean)
      : null;

  const db = new PrismaClient({
    // NOTE: no query logging here — this tool must never print row data.
    datasources: { db: { url: databaseUrl } },
  });

  // Sensitivity classifications mirror docs/lovable-migration/data-migration.md §2.
  const TABLES: TableSpec[] = [
    {
      name: "users",
      sensitivity: "high — email, name, plan; passwordHash excluded unless --include-password-hashes",
      count: (d) => d.user.count(),
      rows: async (d) => {
        const users = await d.user.findMany({ orderBy: { createdAt: "asc" } });
        return users.map((u) => ({
          id: u.id,
          email: u.email,
          // Password hashes stay out of the export unless explicitly requested.
          // They are scrypt 'salt:hash' strings tied to the legacy auth system.
          passwordHash: includeHashes ? u.passwordHash : null,
          name: u.name,
          plan: u.plan,
          trialEndsAt: u.trialEndsAt?.toISOString() ?? null,
          premiumUntil: u.premiumUntil?.toISOString() ?? null,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
        }));
      },
    },
    {
      name: "children",
      sensitivity: "HIGHEST — minors' personal & health data (allergies)",
      count: (d) => d.child.count(),
      rows: (d) =>
        d.child.findMany({ orderBy: { createdAt: "asc" } }).then((rows) =>
          rows.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
          }))
        ),
    },
    {
      name: "meal_plans",
      sensitivity: "medium — derived from child profiles",
      count: (d) => d.mealPlan.count(),
      rows: (d) =>
        d.mealPlan.findMany({ orderBy: { createdAt: "asc" } }).then((rows) =>
          rows.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))
        ),
    },
    {
      name: "plan_meals",
      sensitivity: "medium — generated content",
      count: (d) => d.planMeal.count(),
      rows: (d) => d.planMeal.findMany({ orderBy: { id: "asc" } }),
    },
    {
      name: "diary_entries",
      sensitivity: "HIGHEST — minors' eating records + free-text notes",
      count: (d) => d.diaryEntry.count(),
      rows: (d) =>
        d.diaryEntry.findMany({ orderBy: { createdAt: "asc" } }).then((rows) =>
          rows.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))
        ),
    },
    {
      name: "shopping_items",
      sensitivity: "low",
      count: (d) => d.shoppingItem.count(),
      rows: (d) =>
        d.shoppingItem.findMany({ orderBy: { createdAt: "asc" } }).then((rows) =>
          rows.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))
        ),
    },
    {
      name: "coach_messages",
      sensitivity: "high — chat may contain child feeding/health details",
      count: (d) => d.coachMessage.count(),
      rows: (d) =>
        d.coachMessage.findMany({ orderBy: { createdAt: "asc" } }).then((rows) =>
          rows.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))
        ),
    },
    {
      name: "payment_orders",
      sensitivity: "high — financial records",
      count: (d) => d.paymentOrder.count(),
      rows: (d) =>
        d.paymentOrder.findMany({ orderBy: { createdAt: "asc" } }).then((rows) =>
          rows.map((o) => ({
            ...o,
            createdAt: o.createdAt.toISOString(),
            updatedAt: o.updatedAt.toISOString(),
          }))
        ),
    },
    {
      name: "recipes",
      sensitivity: "low — shared reference/seed data",
      count: (d) => d.recipe.count(),
      rows: (d) => d.recipe.findMany({ orderBy: { slug: "asc" } }),
    },
  ];

  const selected = onlyTables ? TABLES.filter((t) => onlyTables.includes(t.name)) : TABLES;
  if (selected.length === 0) {
    console.error(`ERROR: no matching tables for --tables ${onlyTables?.join(",")}`);
    await db.$disconnect();
    process.exit(1);
  }

  // Redact credentials from the connection string for the manifest/logs.
  const redactUrl = (url: string) => {
    try {
      return url.replace(/:\/\/[^@]*@/, "://***@");
    } catch {
      return "(unprintable)";
    }
  };

  console.log(`\nNutri Tummies migration export v${TOOL_VERSION}`);
  console.log(`Source: ${redactUrl(databaseUrl)}`);
  console.log(`Mode:   ${args.write === true ? "WRITE (files will be created)" : "DRY RUN (counts only)"}\n`);

  const counts: Record<string, number> = {};
  try {
    for (const t of selected) {
      const n = await t.count(db);
      counts[t.name] = n;
      console.log(`  ${t.name.padEnd(16)} ${String(n).padStart(7)} rows   (${t.sensitivity})`);
    }
  } catch (err) {
    const e = err as { message?: string; code?: string };
    const firstLines = (e.message ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(" | ");
    console.error(
      "\nERROR: could not read the database. If this is a Postgres URL, the Prisma client\n" +
        "in this repo is currently generated for SQLite — see the header comment of this\n" +
        "script (provider swap + bunx prisma generate) or docs/lovable-migration/data-migration.md §6.\n" +
        "Also check that the path is correct (tip: absolute file: URLs avoid relative-path ambiguity)."
    );
    console.error(`Detail: ${[e.code, firstLines].filter(Boolean).join(" — ")}`);
    await db.$disconnect();
    process.exit(1);
  }

  console.log(
    "\nExcluded by design (never exported): Session (bearer tokens), RateLimit, AiCache (transient)."
  );

  if (args.write !== true) {
    console.log("\nDry run complete — nothing was written. Pass --write to export JSONL files.\n");
    await db.$disconnect();
    process.exit(0);
  }

  const outDir = path.resolve(typeof args.out === "string" ? (args.out as string) : "./migration-export");
  if (existsSync(outDir) && args.force !== true) {
    console.error(`\nERROR: output directory already exists: ${outDir}\nUse --force to allow writing into it, or choose --out <new-dir>.\n`);
    await db.$disconnect();
    process.exit(1);
  }
  await mkdir(outDir, { recursive: true });

  const manifest = {
    tool: "export-for-migration",
    version: TOOL_VERSION,
    exportedAt: new Date().toISOString(),
    source: redactUrl(databaseUrl),
    passwordHashesIncluded: includeHashes,
    excludedTables: ["Session", "RateLimit", "AiCache"],
    importOrder: ["users", "children", "meal_plans", "plan_meals", "diary_entries", "shopping_items", "coach_messages", "payment_orders", "recipes"],
    sensitivity: Object.fromEntries(selected.map((t) => [t.name, t.sensitivity])),
    rowCounts: {} as Record<string, number>,
    notes: [
      "Children/diary/coach data are minors' personal information under POPIA — store this export encrypted and delete after the retention window.",
      "User.plan is the STORED value; the effective plan depends on trialEndsAt/premiumUntil (see handoff §4).",
      "JSONL rows use source (Prisma/camelCase) column names; target mapping is docs/lovable-migration/data-migration.md §3.",
    ],
  };

  for (const t of selected) {
    const rows = await t.rows(db);
    manifest.rowCounts[t.name] = rows.length;
    if (rows.length !== counts[t.name]) {
      console.error(`ERROR: count mismatch for ${t.name} (counted ${counts[t.name]}, fetched ${rows.length}) — aborting.`);
      await db.$disconnect();
      process.exit(1);
    }
    const file = path.join(outDir, `${t.name}.jsonl`);
    const body = rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "");
    await writeFile(file, body, "utf8");
    console.log(`  wrote ${path.relative(process.cwd(), file)} (${rows.length} rows)`);
  }

  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`  wrote ${path.relative(process.cwd(), path.join(outDir, "manifest.json"))}`);
  console.log(`\nExport complete. Verify counts against the manifest before importing.\n`);

  await db.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
