/**
 * scripts/clean-for-production-launch.mjs
 *
 * Standalone automated clean slate runner for Grand Opening production readiness.
 * Cleans:
 *   - Orders, order items, modifiers, status history, sessions, links
 *   - Cash shifts & operational cash transactions
 *   - Guest reservations
 *   - Non-admin staff accounts (preserves admin@tepisawah.id and owner profiles)
 *   - Resets all active tables to 'AVAILABLE'
 *
 * Preserves:
 *   - Master Menu Catalog (categories, products, variants, modifiers)
 *   - Tables layout & QR codes
 *   - Website CMS landing content
 *   - Tax, QRIS, Bank Account, & Printer settings
 *
 * Safety requirement: Must pass `--confirm` flag to execute!
 *
 * Usage:
 *   node scripts/clean-for-production-launch.mjs --confirm
 */

import { argv, env, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import pg from "pg";
import { loadEnvFile } from "./env-file.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
loadEnvFile(join(ROOT, ".env.production.local"));
loadEnvFile(join(ROOT, ".env.staging.local"));
loadEnvFile(join(ROOT, ".env.local"));
loadEnvFile(join(ROOT, ".env"));

const hasConfirm = argv.includes("--confirm");

if (!hasConfirm) {
  console.log("=====================================================================");
  console.log("  PERINGATAN: SKRIP PEMBERSIHAN DATA BERSIH MENUJU PRODUKSI");
  console.log("=====================================================================");
  console.log("Skrip ini akan mengosongkan seluruh pesanan, shift kasir, reservasi,");
  console.log("dan staf uji coba — HANYA mempertahankan akun Admin dan Master Data.");
  console.log("\nUntuk mengeksekusi, sertakan flag --confirm:");
  console.log("  node scripts/clean-for-production-launch.mjs --confirm\n");
  exit(0);
}

function resolveEnv(...names) {
  for (const name of names) {
    const value = env[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

const dbUrl = resolveEnv("DATABASE_URL", "PROD_DATABASE_URL", "STAGING_DATABASE_URL");
const projectUrl = resolveEnv("PROD_SUPABASE_URL", "SUPABASE_URL", "STAGING_SUPABASE_URL", "VITE_SUPABASE_URL");
const serviceRoleKey = resolveEnv("PROD_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "STAGING_SERVICE_ROLE_KEY");

async function runViaPg(connectionString) {
  console.log("Menghubungkan ke database via Postgres Client...");
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query("BEGIN;");

    console.log("1. Menghapus order_item_modifiers...");
    const r1 = await client.query("DELETE FROM public.order_item_modifiers;");
    console.log(`   Dihapus: ${r1.rowCount} baris`);

    console.log("2. Menghapus order_items...");
    const r2 = await client.query("DELETE FROM public.order_items;");
    console.log(`   Dihapus: ${r2.rowCount} baris`);

    console.log("3. Menghapus order_status_history...");
    const r3 = await client.query("DELETE FROM public.order_status_history;");
    console.log(`   Dihapus: ${r3.rowCount} baris`);

    console.log("4. Menghapus table_session_order_links...");
    const r4 = await client.query("DELETE FROM public.table_session_order_links;");
    console.log(`   Dihapus: ${r4.rowCount} baris`);

    console.log("5. Menghapus orders...");
    const r5 = await client.query("DELETE FROM public.orders;");
    console.log(`   Dihapus: ${r5.rowCount} baris`);

    console.log("6. Menghapus table_sessions...");
    const r6 = await client.query("DELETE FROM public.table_sessions;");
    console.log(`   Dihapus: ${r6.rowCount} baris`);

    console.log("7. Menghapus cash_transactions...");
    const r7 = await client.query("DELETE FROM public.cash_transactions;");
    console.log(`   Dihapus: ${r7.rowCount} baris`);

    console.log("8. Menghapus cash_shifts...");
    const r8 = await client.query("DELETE FROM public.cash_shifts;");
    console.log(`   Dihapus: ${r8.rowCount} baris`);

    console.log("9. Menghapus reservations...");
    const r9 = await client.query("DELETE FROM public.reservations;");
    console.log(`   Dihapus: ${r9.rowCount} baris`);

    console.log("10. Mengembalikan status seluruh meja ke 'AVAILABLE'...");
    const r10 = await client.query("UPDATE public.tables SET status = 'AVAILABLE', current_session_id = NULL WHERE is_active = true;");
    console.log(`    Meja siap: ${r10.rowCount}`);

    console.log("11. Menyeleksi dan melindungi akun Admin/Owner...");
    await client.query(`
      CREATE TEMP TABLE preserved_admin_users ON COMMIT DROP AS
      SELECT u.id 
      FROM auth.users u
      LEFT JOIN public.user_roles ur ON ur.user_id = u.id
      LEFT JOIN public.roles r ON r.id = ur.role_id
      WHERE lower(u.email) = 'admin@tepisawah.id' 
         OR r.name IN ('owner', 'superadmin', 'admin')
      GROUP BY u.id;
    `);

    await client.query(`
      INSERT INTO preserved_admin_users (id)
      SELECT id FROM auth.users 
      ORDER BY created_at ASC 
      LIMIT 1
      ON CONFLICT DO NOTHING;
    `);

    const adminCheck = await client.query("SELECT count(*) AS total FROM preserved_admin_users;");
    console.log(`    Akun admin yang dilindungi: ${adminCheck.rows[0].total}`);

    console.log("12. Menghapus staf uji coba non-admin...");
    const rRoles = await client.query("DELETE FROM public.user_roles WHERE user_id NOT IN (SELECT id FROM preserved_admin_users);");
    console.log(`    Peran staf dihapus: ${rRoles.rowCount}`);

    const rProf = await client.query("DELETE FROM public.profiles WHERE id NOT IN (SELECT id FROM preserved_admin_users);");
    console.log(`    Profil staf dihapus: ${rProf.rowCount}`);

    const rUsers = await client.query("DELETE FROM auth.users WHERE id NOT IN (SELECT id FROM preserved_admin_users);");
    console.log(`    Akun auth non-admin dihapus: ${rUsers.rowCount}`);

    // Pastikan admin memiliki role owner dan profil aktif
    await client.query(`
      DO $$
      DECLARE
        v_admin_id uuid;
        v_owner_role_id uuid;
      BEGIN
        SELECT id INTO v_admin_id FROM preserved_admin_users LIMIT 1;
        SELECT id INTO v_owner_role_id FROM public.roles WHERE name = 'owner' LIMIT 1;

        IF v_admin_id IS NOT NULL AND v_owner_role_id IS NOT NULL THEN
          INSERT INTO public.user_roles (user_id, role_id)
          VALUES (v_admin_id, v_owner_role_id)
          ON CONFLICT (user_id, role_id) DO NOTHING;

          UPDATE public.profiles
          SET is_active = true,
              display_name = COALESCE(NULLIF(display_name, ''), 'Administrator Tepi Sawah'),
              updated_at = now()
          WHERE id = v_admin_id;
        END IF;
      END $$;
    `);

    await client.query("COMMIT;");
    console.log("\nBERHASIL: Database bersih dan siap 100% untuk peluncuran resmi (Opening Day)!");
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    await client.end();
  }
}

async function runViaRest(url, key) {
  console.log(`Menghubungkan via PostgREST API (${url})...`);

  async function postgrestDelete(table, params = "") {
    const endpoint = `${url}/rest/v1/${table}?${params}`;
    const res = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=representation",
      },
    });
    if (!res.ok) {
      const txt = await res.text();
      console.warn(`Peringatan hapus ${table}: ${txt}`);
      return [];
    }
    return res.json();
  }

  console.log("1. Menghapus order_item_modifiers...");
  await postgrestDelete("order_item_modifiers", "id=neq.00000000-0000-0000-0000-000000000000");

  console.log("2. Menghapus order_items...");
  await postgrestDelete("order_items", "id=neq.00000000-0000-0000-0000-000000000000");

  console.log("3. Menghapus order_status_history...");
  await postgrestDelete("order_status_history", "id=neq.00000000-0000-0000-0000-000000000000");

  console.log("4. Menghapus table_session_order_links...");
  await postgrestDelete("table_session_order_links", "order_id=neq.00000000-0000-0000-0000-000000000000");

  console.log("5. Menghapus orders...");
  await postgrestDelete("orders", "id=neq.00000000-0000-0000-0000-000000000000");

  console.log("6. Menghapus table_sessions...");
  await postgrestDelete("table_sessions", "id=neq.00000000-0000-0000-0000-000000000000");

  console.log("7. Menghapus cash_transactions...");
  await postgrestDelete("cash_transactions", "id=neq.00000000-0000-0000-0000-000000000000");

  console.log("8. Menghapus cash_shifts...");
  await postgrestDelete("cash_shifts", "id=neq.00000000-0000-0000-0000-000000000000");

  console.log("9. Menghapus reservations...");
  await postgrestDelete("reservations", "id=neq.00000000-0000-0000-0000-000000000000");

  console.log("10. Reset status meja ke 'AVAILABLE'...");
  await fetch(`${url}/rest/v1/tables?is_active=eq.true`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ status: "AVAILABLE", current_session_id: null }),
  });

  console.log("\nBERHASIL: Transaksi dan shift telah dibersihkan via Supabase REST API.");
  console.log("Untuk membersihkan akun staf auth.users non-admin secara mendalam, jalankan skrip SQL:");
  console.log("  supabase/scripts/production-clean-slate-preserve-admin.sql di Supabase SQL Editor.");
}

async function main() {
  try {
    if (dbUrl) {
      await runViaPg(dbUrl);
    } else if (projectUrl && serviceRoleKey) {
      await runViaRest(projectUrl, serviceRoleKey);
    } else {
      console.error("\nERROR: Konfigurasi database tidak ditemukan.");
      console.error("Pastikan DATABASE_URL atau SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY tersedia di .env");
      console.error("Sebagai alternatif langsung, salin dan jalankan skrip berikut di Supabase SQL Editor:");
      console.error("  supabase/scripts/production-clean-slate-preserve-admin.sql\n");
      exit(1);
    }
  } catch (err) {
    console.error("\nGAGAL:", err.message);
    exit(1);
  }
}

main();
