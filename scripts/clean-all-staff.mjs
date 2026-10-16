/**
 * scripts/clean-all-staff.mjs — Wipe all staff accounts and trial transactions.
 *
 * Resets database to 0 users so the restaurant starts with a clean slate for Opening Day.
 * Requires `--confirm` flag to execute!
 *
 * Run: node scripts/clean-all-staff.mjs --confirm
 */
import { argv, env, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import pg from "pg";
import { loadEnvFile } from "./env-file.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
loadEnvFile(join(ROOT, ".env.staging.local"));
loadEnvFile(join(ROOT, ".env.production.local"));
loadEnvFile(join(ROOT, ".env.local"));
loadEnvFile(join(ROOT, ".env"));

const hasConfirm = argv.includes("--confirm");

if (!hasConfirm) {
  console.log("=====================================================================");
  console.log("  PERINGATAN: PEMBERSIHAN TOTAL DATA STAF & TRANSAKSI UJI COBA");
  console.log("=====================================================================");
  console.log("Skrip ini akan menghapus:");
  console.log("  - SELURUH akun staf di auth.users, profiles, dan user_roles (0 user)");
  console.log("  - Seluruh pesanan, item, riwayat status, dan sesi meja");
  console.log("\nKatalog menu dan meja TETAP AMAN.");
  console.log("\nUntuk mengeksekusi, jalankan dengan bendera --confirm:");
  console.log("  node scripts/clean-all-staff.mjs --confirm\n");
  exit(0);
}

function resolveEnv(...names) {
  for (const name of names) {
    const value = env[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

const dbPassword = resolveEnv("STAGING_DB_PASSWORD", "DB_PASSWORD", "POSTGRES_PASSWORD");
const projectUrl = resolveEnv("STAGING_SUPABASE_URL", "VITE_SUPABASE_URL", "PROD_SUPABASE_URL");

if (!dbPassword || !projectUrl) {
  console.error(
    "clean-all-staff: Database password atau URL Supabase tidak ditemukan.\n" +
    "Jalankan skrip SQL secara langsung via Supabase Dashboard SQL Editor:\n" +
    "  supabase/scripts/wipe-all-staff-and-transactions.sql"
  );
  exit(1);
}

const projectHost = new URL(projectUrl).hostname;
const connectionUri = `postgresql://postgres:${encodeURIComponent(
  dbPassword,
)}@db.${projectHost}:5432/postgres`;

async function executeWipe() {
  console.log(`Menghubungkan ke PostgreSQL: db.${projectHost}:5432...`);
  const client = new pg.Client({ connectionString: connectionUri });

  try {
    await client.connect();
    console.log("Terhubung ke database.");

    await client.query("BEGIN;");

    console.log("1. Membersihkan relasi transaksi pesanan uji coba...");
    await client.query("DELETE FROM public.order_item_modifiers;");
    await client.query("DELETE FROM public.order_items;");
    await client.query("DELETE FROM public.order_status_history;");
    await client.query("DELETE FROM public.table_session_order_links;");
    await client.query("DELETE FROM public.orders;");
    await client.query("DELETE FROM public.table_sessions;");

    console.log("2. Menghapus seluruh penugasan peran dan profil staf...");
    const rRoles = await client.query("DELETE FROM public.user_roles;");
    const rProfiles = await client.query("DELETE FROM public.profiles;");
    console.log(`   Dihapus: ${rRoles.rowCount} penugasan peran, ${rProfiles.rowCount} profil staf.`);

    console.log("3. Menghapus seluruh akun otentikasi di schema auth...");
    const rUsers = await client.query("DELETE FROM auth.users;");
    console.log(`   Dihapus: ${rUsers.rowCount} akun pengguna di auth.users.`);

    console.log("4. Mereset status seluruh meja menjadi AVAILABLE...");
    await client.query("UPDATE public.tables SET status = 'AVAILABLE' WHERE is_active = true;");

    await client.query("COMMIT;");
    console.log("\n=====================================================================");
    console.log("  BERHASIL: Database telah bersih total (0 staf, 0 pesanan uji coba).");
    console.log("  Portal staf kini siap menampilkan First-Time Owner Setup Screen.");
    console.log("=====================================================================\n");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Gagal mengeksekusi pembersihan:", err.message || err);
    console.log("\nCATATAN ALTERNATIF:");
    console.log("Jika koneksi jaringan IPv4 workstation Anda memblokir koneksi port 5432 Supabase,");
    console.log("jalankan file berikut langsung di Supabase Dashboard -> SQL Editor:");
    console.log("  supabase/scripts/wipe-all-staff-and-transactions.sql");
  } finally {
    await client.end();
  }
}

void executeWipe();
