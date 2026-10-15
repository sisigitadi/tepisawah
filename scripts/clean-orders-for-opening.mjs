/**
 * scripts/clean-orders-for-opening.mjs — Reset trial transaction data for Opening Day.
 *
 * Cleans trial orders, items, modifiers, status history, and session links so that
 * the restaurant opens with a clean slate:
 *   - Laporan omzet kasir mulai dari Rp 0
 *   - Antrean dapur bersih tanpa sisa tiket uji coba
 *   - Seluruh meja berstatus 'AVAILABLE' dan siap menerima tamu pembukaan
 *   - Katalog menu, kategori, foto WebP, QR meja, dan akun staf AMAN TERJAGA.
 *
 * Safety requirement: Must pass `--confirm` flag to execute!
 *
 * Run: node scripts/clean-orders-for-opening.mjs --confirm
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
  console.log("  PERINGATAN: SKRIP PEMBERSIHAN DATA TRANSAKSI UJI COBA");
  console.log("=====================================================================");
  console.log("Skrip ini akan menghapus seluruh data pesanan uji coba (orders, items,");
  console.log("history, session links) dan mengembalikan status semua meja ke AVAILABLE.");
  console.log("\nKatalog menu, meja, QR code, dan akun staf TIDAK AKAN DIHAPUS.");
  console.log("\nUntuk menjalankan, sertakan parameter --confirm:");
  console.log("  node scripts/clean-orders-for-opening.mjs --confirm\n");
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

    console.log("1. Menghapus order_item_modifiers uji coba...");
    const r1 = await client.query("DELETE FROM public.order_item_modifiers;");
    console.log(`   Dihapus: ${r1.rowCount} baris`);

    console.log("2. Menghapus order_items uji coba...");
    const r2 = await client.query("DELETE FROM public.order_items;");
    console.log(`   Dihapus: ${r2.rowCount} baris`);

    console.log("3. Menghapus order_status_history uji coba...");
    const r3 = await client.query("DELETE FROM public.order_status_history;");
    console.log(`   Dihapus: ${r3.rowCount} baris`);

    console.log("4. Menghapus table_session_order_links uji coba...");
    const r4 = await client.query("DELETE FROM public.table_session_order_links;");
    console.log(`   Dihapus: ${r4.rowCount} baris`);

    console.log("5. Menghapus orders uji coba...");
    const r5 = await client.query("DELETE FROM public.orders;");
    console.log(`   Dihapus: ${r5.rowCount} baris`);

    console.log("6. Menutup table_sessions yang masih aktif...");
    const r6 = await client.query("UPDATE public.table_sessions SET status = 'CLOSED' WHERE status = 'ACTIVE';");
    console.log(`   Sesi ditutup: ${r6.rowCount}`);

    console.log("7. Mengembalikan status seluruh meja aktif menjadi 'AVAILABLE'...");
    const r7 = await client.query("UPDATE public.tables SET status = 'AVAILABLE' WHERE is_active = true;");
    console.log(`   Meja siap: ${r7.rowCount}`);

    await client.query("COMMIT;");
    console.log("\nBERHASIL: Database telah bersih dan siap 100% untuk Hari Pembukaan (Opening Day)!");
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    await client.end();
  }
}

async function runViaRest(url, key) {
  console.log(`Menghubungkan via PostgREST API (${url})...`);

  const headers = {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };

  const steps = [
    { name: "order_item_modifiers", path: "/rest/v1/order_item_modifiers?id=neq.00000000-0000-0000-0000-000000000000" },
    { name: "order_items", path: "/rest/v1/order_items?id=neq.00000000-0000-0000-0000-000000000000" },
    { name: "order_status_history", path: "/rest/v1/order_status_history?id=neq.00000000-0000-0000-0000-000000000000" },
    { name: "table_session_order_links", path: "/rest/v1/table_session_order_links?order_id=neq.00000000-0000-0000-0000-000000000000" },
    { name: "orders", path: "/rest/v1/orders?id=neq.00000000-0000-0000-0000-000000000000" },
  ];

  for (const step of steps) {
    console.log(`Menghapus ${step.name}...`);
    const res = await fetch(`${url}${step.path}`, { method: "DELETE", headers });
    if (!res.ok) {
      console.warn(`Peringatan pada ${step.name}: HTTP ${res.status}`);
    }
  }

  console.log("Mengupdate status meja aktif menjadi 'AVAILABLE'...");
  await fetch(`${url}/rest/v1/tables?is_active=eq.true`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "AVAILABLE" }),
  });

  console.log("\nBERHASIL: Transaksi uji coba telah dibersihkan via REST API!");
}

async function main() {
  console.log("=====================================================================");
  console.log("  Tepi Sawah Resto — Persiapan Hari Pembukaan: Reset Transaksi Uji Coba");
  console.log("=====================================================================\n");

  try {
    if (dbUrl) {
      await runViaPg(dbUrl);
    } else if (projectUrl && serviceRoleKey) {
      await runViaRest(projectUrl, serviceRoleKey);
    } else {
      console.error(
        "Gagal: Tidak ditemukan DATABASE_URL atau SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Harap sediakan koneksi database di file environment."
      );
      exit(1);
    }
  } catch (err) {
    console.error("Gagal membersihkan data transaksi:", err);
    exit(1);
  }
}

void main();
