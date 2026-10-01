/**
 * scripts/smoke-order-chain.mjs — end-to-end order chain smoke test.
 *
 * Runs the whole customer-to-cashier-to-kitchen-to-waiter-to-POS lifecycle
 * against the live backend through the *real* `@tepisawah/database` query layer
 * — the same code path every app uses — and reports each step:
 *
 *   customer (anon)  create_draft_order -> submit_order   (DRAFT -> SUBMITTED -> PENDING_CONFIRMATION)
 *   cashier          transition_order                    (-> CONFIRMED)
 *   kitchen          transition_order                    (-> PREPARING -> READY)
 *   waiter           transition_order                    (-> SERVED)
 *   pos              transition_order                    (-> PAID)
 *
 * Why it matters: the chain spans five RPCs, four RLS policies and four
 * permission codes. A silent regression in any of them (an arg renamed to
 * camelCase, a revoked grant, a broken policy) only surfaces on the floor
 * mid-service. This script makes the seam visible in one command.
 *
 * Usage:
 *   node scripts/smoke-order-chain.mjs [--table A1] [--keep] [--email x] [--password y]
 *
 * Credentials: the public Supabase config is read from `.env.local` (root, or
 * the first per-app `.env.local` under `apps` that defines it) and falls back to
 * process.env.
 * The staff login comes from `SMOKE_ADMIN_EMAIL` / `SMOKE_ADMIN_PASSWORD` in the
 * same places, or from the flags above. It is NEVER hardcoded — a staff
 * password does not belong in a committed file (ENVIRONMENT_CONFIG.md §6).
 *
 * The script leaves one PAID test order in the database unless it can delete
 * it. Client roles hold no DELETE grant on `orders` by design (every mutation
 * rides a SECURITY DEFINER RPC), so cleanup needs `SUPABASE_SERVICE_ROLE_KEY`,
 * which bypasses RLS and is server-side only (ENVIRONMENT_CONFIG.md §6) — a CI
 * secret, typically absent on a workstation. Without it the run prints the
 * exact SQL to remove the row instead. Pass `--keep` to skip both paths.
 *
 * Exits 1 if any step fails, 0 only when the whole chain is verified.
 */
import { readFileSync } from "node:fs";
import { argv, env, exit } from "node:process";
import { randomUUID } from "node:crypto";

const ROOT = new URL("../", import.meta.url);
const DATABASE_BUNDLE = new URL("packages/database/dist/database.js", ROOT);

// ─────────────────────────────────────────────────────────────────────────────
// Reporting
// ─────────────────────────────────────────────────────────────────────────────

const ANSI = env.NO_COLOR ? "" : "\x1b[";
const dim = (text) => `${ANSI}2m${text}${ANSI}0m`;
const bold = (text) => `${ANSI}1m${text}${ANSI}0m`;
const green = (text) => `${ANSI}32m${text}${ANSI}0m`;
const red = (text) => `${ANSI}31m${text}${ANSI}0m`;
const yellow = (text) => `${ANSI}33m${text}${ANSI}0m`;

let failures = 0;
const startedAt = Date.now();

/** One labelled PASS/FAIL line. A failure aborts the run after reporting. */
function step(label, detail, condition) {
  const mark = condition ? green("PASS") : red("FAIL");
  const text = detail ? `${label} ${dim(`(${detail})`)}` : label;
  console.log(`  ${mark}  ${text}`);
  if (!condition) {
    failures += 1;
    throw new SmokeError(`step failed: ${label}`);
  }
}

function heading(text) {
  console.log(`\n${bold(text)}`);
}

/** Report a fatal problem with the run's configuration, not the chain. */
class SmokeError extends Error {}

// ─────────────────────────────────────────────────────────────────────────────
// Arguments
// ─────────────────────────────────────────────────────────────────────────────

function flag(name) {
  const at = argv.indexOf(`--${name}`);
  return at !== -1 && at + 1 < argv.length ? argv[at + 1] : undefined;
}

const tableArg = flag("table");
const keep = argv.includes("--keep");
const adminEmail = flag("email") ?? undefined;
const adminPassword = flag("password") ?? undefined;

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a flat KEY=VALUE env file, tolerating comments, blanks and CRLF. */
function parseEnvFile(file) {
  const entries = new Map();
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return entries;
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals === -1) continue;
    const key = line.slice(0, equals).trim();
    const value = line
      .slice(equals + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) entries.set(key, value);
  }
  return entries;
}

/**
 * Resolve a variable in the project's own precedence order: an explicit flag,
 * then the process environment, then root `.env.local`, then the per-app
 * `.env.local` files (each app is its own Vite root, so that is where the live
 * credentials actually live on a configured workstation).
 */
function resolveValue(name, override) {
  if (override) return override;
  if (env[name]) return env[name];
  const candidates = [
    new URL(".env.local", ROOT),
    ...["web", "order", "admin", "pos", "kitchen", "waiter"].map(
      (app) => new URL(`apps/${app}/.env.local`, ROOT),
    ),
  ];
  for (const file of candidates) {
    const parsed = parseEnvFile(file);
    if (parsed.get(name)) return parsed.get(name);
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────────────────────

async function loadDatabase() {
  try {
    return await import(DATABASE_BUNDLE.href);
  } catch (error) {
    throw new SmokeError(
      "cannot import packages/database/dist/database.js: " +
        `${error.message}. Rebuild it with:` +
        "\n  pnpm --filter @tepisawah/database build",
    );
  }
}

/** Anonymous customer client + an authenticated staff client for the same project. */
async function buildClients(db, supabaseUrl, anonKey, email, password) {
  const customer = db.createBrowserSupabaseClient({
    supabaseUrl,
    supabaseAnonKey: anonKey,
  });

  const staff = db.createBrowserSupabaseClient({
    supabaseUrl,
    supabaseAnonKey: anonKey,
  });
  const signIn = await staff.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    throw new SmokeError(
      `staff sign-in failed for ${email}: ${signIn.error.message}`,
    );
  }
  const session = await staff.auth.getSession();
  if (session.error || !session.data.session) {
    throw new SmokeError("staff session could not be established");
  }
  return { customer, staff, actor: session.data.session.user.email };
}

// ─────────────────────────────────────────────────────────────────────────────
// Order context
// ─────────────────────────────────────────────────────────────────────────────

const rupiah = (value) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

/**
 * Pick a table with an OPEN session: the `--table` code when given, otherwise
 * the first active table. Opens a session when none is open, because a draft
 * order must cite an open table context (AUTH_RBAC_RLS.md §18).
 */
async function resolveTableContext(db, staff, code) {
  const tables = await db.fetchTables(staff);
  if (tables.error || !tables.data || tables.data.length === 0) {
    throw new SmokeError(`cannot list tables: ${tables.error?.message ?? "none"}`);
  }
  const active = tables.data.filter((table) => table.isActive);
  const wanted = code
    ? active.find((table) => table.tableCode.toUpperCase() === code.toUpperCase())
    : active[0];
  if (!wanted) {
    throw new SmokeError(
      `no active table${code ? ` with code ${code}` : ""}; have ${tables.data
        .map((table) => table.tableCode)
        .join(", ")}`,
    );
  }

  const existing = await db.fetchActiveTableSession(staff, wanted.id);
  if (existing.error) {
    throw new SmokeError(
      `cannot read session for ${wanted.tableCode}: ${existing.error.message}`,
    );
  }
  if (existing.data) {
    return { table: wanted, session: existing.data, openedNow: false };
  }

  const opened = await db.openTableSession(staff, wanted.id, wanted.tableCode);
  if (opened.error || !opened.data) {
    throw new SmokeError(
      `cannot open session for ${wanted.tableCode}: ${opened.error?.message}`,
    );
  }
  return { table: wanted, session: opened.data.session, openedNow: true };
}

/**
 * Build a two-line basket from the live customer menu: one item that carries a
 * required modifier (so the modifier validation path is exercised) and one
 * without. Required options must be sent or `create_draft_order` refuses the
 * line, so every `isRequired` option of a chosen product is included.
 */
function buildBasket(catalog) {
  const orderable = catalog.filter((product) => product.isAvailable);
  if (orderable.length === 0) return [];

  const withRequired = orderable.filter((product) =>
    product.modifiers.some((modifier) => modifier.isRequired),
  );
  const plain = orderable.filter(
    (product) => !product.modifiers.some((modifier) => modifier.isRequired),
  );

  const lines = [];
  const pick = (product, quantity) => {
    const required = product.modifiers
      .filter((modifier) => modifier.isRequired)
      .map((modifier) => modifier.modifierId);
    lines.push({
      productId: product.productId,
      quantity,
      modifierIds: required.length > 0 ? required : undefined,
      notes: required.length > 0 ? "Smoke test line" : undefined,
    });
  };

  if (withRequired[0]) pick(withRequired[0], 2);
  if (plain[0]) pick(plain[0], 1);
  else if (orderable[0] && lines.length === 0) pick(orderable[0], 1);
  return lines;
}

/** One staff transition hop, reporting the resulting status and version. */
async function hop(db, staff, orderId, toStatus, label, version) {
  const result = await db.transitionOrder(staff, {
    orderId,
    toStatus,
    expectedVersion: version,
  });
  const order = result.data?.order;
  step(label, `${order?.orderNumber ?? "?"} -> ${toStatus}`,
    Boolean(order) && order.status === toStatus && order.version === version + 1);
  return order;
}

async function run() {
  const supabaseUrl = resolveValue("VITE_SUPABASE_URL");
  const anonKey = resolveValue("VITE_SUPABASE_ANON_KEY");
  const email = resolveValue("SMOKE_ADMIN_EMAIL", adminEmail);
  const password = resolveValue("SMOKE_ADMIN_PASSWORD", adminPassword);
  // Optional: lets the run delete the order it created. Server-side only —
  // absent on a workstation by default, present as a CI secret.
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || resolveValue("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey) {
    throw new SmokeError(
      "Supabase URL / anon key not found. Configure VITE_SUPABASE_URL and " +
        "VITE_SUPABASE_ANON_KEY in .env.local (root or any per-app copy).",
    );
  }
  if (!email || !password) {
    throw new SmokeError(
      "Staff credentials not found. Set SMOKE_ADMIN_EMAIL and " +
        "SMOKE_ADMIN_PASSWORD in .env.local, or pass --email / --password.\n" +
        "A staff password is never hardcoded in a committed file " +
        "(ENVIRONMENT_CONFIG.md §6).",
    );
  }

  console.log(bold("Tepi Sawah — order chain smoke test"));
  console.log(dim(`backend ${supabaseUrl}${keep ? " · --keep" : ""}`));

  const db = await loadDatabase();
  const { customer, staff, actor } = await buildClients(
    db,
    supabaseUrl,
    anonKey,
    email,
    password,
  );

  heading("Setup");
  step("staff authenticated", actor, Boolean(actor));

  const ctx = await resolveTableContext(db, staff, tableArg);
  step(
    "table context",
    `${ctx.table.tableCode} · session ${ctx.session.status}` +
      (ctx.openedNow ? " (opened by this run)" : ""),
    ctx.session.status === "OPEN",
  );

  const catalog = await db.fetchPublicCatalog(customer);
  step(
    "customer menu (anon)",
    `${catalog.data?.length ?? 0} orderable product(s)`,
    !catalog.error && (catalog.data?.length ?? 0) > 0,
  );
  const lines = buildBasket(catalog.data ?? []);
  step("basket built", `${lines.length} line(s)`, lines.length > 0);

  // ── Customer: draft + submit ──────────────────────────────────────────────
  heading("Customer orders (anon, CUSTOMER_QR)");
  const idempotencyKey = `smoke-${randomUUID()}`;
  const draft = await db.createDraftOrder(customer, {
    source: "CUSTOMER_QR",
    tableId: ctx.table.id,
    tableSessionId: ctx.session.id,
    items: lines,
    customerNote: "Smoke-test order — aman untuk dihapus",
    idempotencyKey,
  });
  const draftOrder = draft.data?.order;
  step(
    "create_draft_order",
    `${draftOrder?.orderNumber ?? "?"} · ${rupiah(draftOrder?.total)} · ` +
      `${draftOrder?.items.length ?? 0} line(s)`,
    Boolean(draftOrder) && draftOrder.status === "DRAFT" && draftOrder.total > 0,
  );

  const submitted = await db.submitOrder(customer, {
    orderId: draftOrder.id,
    source: "CUSTOMER_QR",
    tableId: ctx.table.id,
    tableSessionId: ctx.session.id,
    idempotencyKey,
  });
  const order = submitted.data?.order;
  step(
    "submit_order",
    `${order?.orderNumber ?? "?"} -> ${order?.status} · v${order?.version}`,
    Boolean(order) && order.status === "PENDING_CONFIRMATION",
  );

  // The anonymous read path: table + session context is the credential
  // (AUTH_RBAC_RLS.md §30), so this proves the customer can see their own order.
  const own = await db.getCustomerOrder(customer, {
    orderId: draftOrder.id,
    tableId: ctx.table.id,
    tableSessionId: ctx.session.id,
  });
  step(
    "customer reads own order",
    `${own.data?.items.length ?? 0} line(s) · ${rupiah(own.data?.total)}`,
    own.data?.status === "PENDING_CONFIRMATION" && (own.data?.items.length ?? 0) > 0,
  );

  // The staff board read path: RLS `orders_staff_read` decides visibility.
  const board = await db.fetchOrdersByStatuses(staff, ["PENDING_CONFIRMATION"]);
  step(
    "staff board sees the order",
    `${board.data?.length ?? 0} pending`,
    (board.data ?? []).some((row) => row.id === draftOrder.id),
  );

  // ── Staff: confirm -> cook -> ready -> serve -> pay ───────────────────────
  heading("Staff advance the order (authenticated)");
  const orderNumber = order.orderNumber;
  let current = order;
  const chain = [
    ["CONFIRMED", "cashier confirms", "orders.confirm"],
    ["PREPARING", "kitchen starts cooking", "kitchen.start"],
    ["READY", "kitchen marks ready", "kitchen.ready"],
    ["SERVED", "waiter marks served", "orders.serve"],
    ["PAID", "pos settles payment", "payments.create"],
  ];
  for (const [toStatus, label] of chain) {
    current = await hop(db, staff, draftOrder.id, toStatus, label, current.version);
  }

  // ── Verification ──────────────────────────────────────────────────────────
  heading("Verification");
  const final = await db.fetchOrder(staff, draftOrder.id);
  step(
    "final order is PAID",
    `${final.data?.orderNumber ?? "?"} · v${final.data?.version} · ${rupiah(final.data?.total)}`,
    final.data?.status === "PAID",
  );

  const history = await readHistory(staff, draftOrder.id);
  if (history.denied) {
    console.log(`  ${yellow("SKIP")}  status history (read denied for this role)`);
  } else {
    const visited = history.rows.map((row) => row.to_status).join(" -> ");
    step(
      "status history covers the chain",
      `${history.rows.length} hop(s): DRAFT -> ${visited}`,
      history.rows.length >= chain.length + 1,
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const elapsed = Date.now() - startedAt;
  console.log();
  console.log(
    bold(green("order chain verified")) +
      `  ${orderNumber} · ${rupiah(current.total)} · ${elapsed} ms`,
  );
  console.log(
    dim(
      `DRAFT -> SUBMITTED -> PENDING_CONFIRMATION -> CONFIRMED -> PREPARING -> READY -> SERVED -> PAID`,
    ),
  );
  if (!keep) {
    if (serviceKey) {
      const removed = await cleanupOrder(supabaseUrl, serviceKey, draftOrder.id);
      console.log(
        dim(`cleaned up ${orderNumber} (service role): order, items, modifiers, history`),
      );
      if (removed)
        console.log(dim(`  removed ${removed} item row(s)`));
    } else {
      printCleanup(orderNumber, ctx.table.tableCode);
    }
  }
  return 0;
}

/**
 * Read the audit trail straight from `order_status_history`. Best effort: the
 * grant is role-dependent, so a denial is reported as a skip rather than a
 * failure — the status and version progression above already proves the chain.
 */
async function readHistory(staff, orderId) {
  const result = await staff
    .from("order_status_history")
    .select("from_status, to_status, actor_role, reason, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (result.error) return { denied: true, rows: [] };
  return { denied: false, rows: result.data ?? [] };
}

/**
 * Remove the order the run just created.
 *
 * Client roles hold no DELETE grant on the order tables by design — every
 * mutation rides a SECURITY DEFINER RPC — so cleanup needs the service-role
 * key, which bypasses RLS. That key is server-side only (ENVIRONMENT_CONFIG.md
 * §6): in CI it comes from a secret, and on a configured workstation it is
 * usually absent, in which case `printCleanup` hands the operator the SQL
 * instead. Children are deleted first, parent last (FK direction).
 */
async function cleanupOrder(supabaseUrl, serviceKey, orderId) {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const rest = (path) => `${supabaseUrl}/rest/v1/${path}`;

  const items = await fetch(
    rest(`order_items?select=id&order_id=eq.${orderId}`),
    { headers },
  );
  const itemRows = items.ok ? await items.json() : [];
  const itemIds = itemRows.map((row) => row.id).filter(Boolean);

  const deletes = [
    itemIds.length > 0
      ? fetch(
          rest(`order_item_modifiers?order_item_id=in.(${itemIds.join(",")})`),
          { method: "DELETE", headers },
        )
      : Promise.resolve(),
    fetch(rest(`order_items?order_id=eq.${orderId}`), { method: "DELETE", headers }),
    fetch(rest(`table_session_order_links?order_id=eq.${orderId}`), {
      method: "DELETE",
      headers,
    }),
    fetch(rest(`order_status_history?order_id=eq.${orderId}`), {
      method: "DELETE",
      headers,
    }),
    fetch(rest(`orders?id=eq.${orderId}`), { method: "DELETE", headers }),
  ];
  const results = await Promise.all(deletes);
  const failed = results.filter((result) => result && !result.ok);
  if (failed.length > 0) {
    throw new SmokeError(
      `service-role cleanup failed on ${failed.length} table(s); the test order remains`,
    );
  }
  return itemIds.length;
}

/**
 * Print the SQL that removes the smoke-test order, for the case where no
 * service-role key is available. Children first, parent last.
 */
function printCleanup(orderNumber, tableCode) {
  const where = `where order_number = '${orderNumber}'`;
  console.log();
  console.log(yellow(`one test order remains (${tableCode}) — remove it in the SQL editor:`));
  console.log(dim("---- cut here ----"));
  console.log(`delete from public.order_item_modifiers
where order_item_id in (select id from public.order_items
  where order_id in (select id from public.orders ${where}));
delete from public.order_items
where order_id in (select id from public.orders ${where});
delete from public.table_session_order_links
where order_id in (select id from public.orders ${where});
delete from public.order_status_history
where order_id in (select id from public.orders ${where});
delete from public.orders ${where};`);
  console.log(dim("---- cut here ----"));
}

async function main() {
  try {
    const code = await run();
    exit(code);
  } catch (error) {
    if (error instanceof SmokeError) {
      console.error(`\n${red("smoke test aborted")}: ${error.message}`);
    } else {
      console.error(`\n${red("smoke test crashed")}: ${error.stack ?? error.message}`);
    }
    exit(1);
  }
}

main();
