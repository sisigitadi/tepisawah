/**
 * scripts/seed-production-staff.mjs — Provision official production staff accounts.
 *
 * Sets up the official accounts for Tepi Sawah Resto & Cafe staff:
 *   - Owner (Pemilik)
 *   - Kasir (Cashier)
 *   - Dapur (Kitchen Head)
 *   - Pramusaji (Waiter)
 *   - Admin (Manajer Operasional)
 *
 * Run: node scripts/seed-production-staff.mjs
 */
import { env, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { loadEnvFile } from "./env-file.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
loadEnvFile(join(ROOT, ".env.production.local"));
loadEnvFile(join(ROOT, ".env.staging.local"));
loadEnvFile(join(ROOT, ".env.local"));
loadEnvFile(join(ROOT, ".env"));

function resolveEnv(...names) {
  for (const name of names) {
    const value = env[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

const projectUrl = resolveEnv(
  "PROD_SUPABASE_URL",
  "SUPABASE_URL",
  "STAGING_SUPABASE_URL",
  "VITE_SUPABASE_URL"
);
const serviceRoleKey = resolveEnv(
  "PROD_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STAGING_SERVICE_ROLE_KEY"
);

if (!projectUrl || !serviceRoleKey) {
  console.error(
    "seed-production-staff: konfigurasi URL atau Service Role Key Supabase tidak ditemukan.\n" +
    "Pastikan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY disetel di env atau .env.production.local"
  );
  exit(1);
}

const STAFF_MEMBERS = [
  {
    role: "owner",
    name: "Bapak Siswanto (Owner)",
    email: env.STAFF_OWNER_EMAIL || "owner@tepisawah.id",
    password: env.STAFF_OWNER_PASSWORD || "TepiSawahOwner2026!",
    blurb: "Akses penuh seluruh operasional restoran, laporan omzet, dan konfigurasi.",
  },
  {
    role: "cashier",
    name: "Kasir Utama",
    email: env.STAFF_CASHIER_EMAIL || "kasir@tepisawah.id",
    password: env.STAFF_CASHIER_PASSWORD || "KasirSawah2026!",
    blurb: "Konfirmasi pesanan meja, proses pembayaran bill, dan cetak struk thermal.",
  },
  {
    role: "kitchen",
    name: "Kepala Dapur",
    email: env.STAFF_KITCHEN_EMAIL || "dapur@tepisawah.id",
    password: env.STAFF_KITCHEN_PASSWORD || "DapurSawah2026!",
    blurb: "Layar Kitchen Display System (KDS): terima tiket masak dan tandai siap saji.",
  },
  {
    role: "waiter",
    name: "Pramusaji Meja",
    email: env.STAFF_WAITER_EMAIL || "waiter@tepisawah.id",
    password: env.STAFF_WAITER_PASSWORD || "PelayanSawah2026!",
    blurb: "Monitor hidangan siap antar ke saung/meja dan pencatatan pesanan manual.",
  },
  {
    role: "admin",
    name: "Manajer Operasional",
    email: env.STAFF_ADMIN_EMAIL || "admin@tepisawah.id",
    password: env.STAFF_ADMIN_PASSWORD || "AdminSawah2026!",
    blurb: "Kelola menu katalog, QR meja, reservasi tamu, dan pengaturan sistem.",
  },
];

function adminHeaders() {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  };
}

async function restFetch(path, options = {}) {
  return await fetch(`${projectUrl}${path}`, {
    ...options,
    headers: { ...adminHeaders(), ...options.headers },
  });
}

async function loadExistingUsers() {
  const res = await restFetch("/auth/v1/admin/users?page=1&per_page=100", { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gagal mengambil data user: HTTP ${res.status}: ${text}`);
  }
  const body = await res.json();
  return Array.isArray(body) ? body : body.users || [];
}

async function provisionStaff(staff, existingUsers) {
  const existing = existingUsers.find((u) => u.email?.toLowerCase() === staff.email.toLowerCase());
  let userId;

  if (existing) {
    console.log(`[EXISTING] Mengupdate password akun ${staff.email} (${staff.name})...`);
    userId = existing.id;
    const res = await restFetch(`/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({
        password: staff.password,
        email_confirm: true,
        user_metadata: { display_name: staff.name },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gagal update user ${staff.email}: ${err}`);
    }
  } else {
    console.log(`[CREATE] Membuat akun baru ${staff.email} (${staff.name})...`);
    const res = await restFetch("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: staff.email,
        password: staff.password,
        email_confirm: true,
        user_metadata: { display_name: staff.name },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gagal membuat user ${staff.email}: ${err}`);
    }
    const created = await res.json();
    userId = created.id;
  }

  // Upsert profile
  const profileRes = await restFetch("/rest/v1/profiles", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      id: userId,
      display_name: staff.name,
      email: staff.email,
      is_active: true,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!profileRes.ok) {
    const err = await profileRes.text();
    console.warn(`Peringatan: Gagal upsert profiles untuk ${staff.email}: ${err}`);
  }

  // Upsert user role
  const roleRes = await restFetch("/rest/v1/user_roles", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: userId,
      role: staff.role,
    }),
  });
  if (!roleRes.ok) {
    const err = await roleRes.text();
    console.warn(`Peringatan: Gagal assign role ${staff.role} untuk ${staff.email}: ${err}`);
  }

  return { email: staff.email, role: staff.role, name: staff.name, password: staff.password };
}

async function run() {
  console.log("===============================================================");
  console.log("  Tepi Sawah Resto — Seed Akun Staf Produksi (Opening Ready)");
  console.log("===============================================================");
  console.log(`Target Supabase: ${projectUrl}\n`);

  try {
    const users = await loadExistingUsers();
    console.log(`Ditemukan ${users.length} akun auth yang sudah terdaftar.`);

    const results = [];
    for (const staff of STAFF_MEMBERS) {
      const res = await provisionStaff(staff, users);
      results.push(res);
    }

    console.log("\n===============================================================");
    console.log("  DAFTAR AKUN STAF RESMI TEPI SAWAH RESTO & CAFE:");
    console.log("===============================================================");
    for (const r of results) {
      console.log(`Peran     : ${r.role.toUpperCase()}`);
      console.log(`Nama      : ${r.name}`);
      console.log(`Email     : ${r.email}`);
      console.log(`Sandi     : ${r.password}`);
      console.log("---------------------------------------------------------------");
    }
    console.log("\nCatatan Keamanan:");
    console.log("1. Berikan akun ini kepada masing-masing penanggung jawab tugas.");
    console.log("2. Pastikan VITE_DEMO_MODE=false di lingkungan produksi agar menu");
    console.log("   ganti peran instan (demo switcher) otomatis tersembunyi.");
    console.log("3. Staf dapat langsung masuk melalui portal staf (port 5174).");
  } catch (err) {
    console.error("Gagal menjalankan seed staf produksi:", err);
    exit(1);
  }
}

void run();
