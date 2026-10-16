/**
 * @tepisawah/staff — First-Time System Setup (Inisialisasi Pemilik Pertama).
 *
 * Rendered when the database is completely empty (0 registered staff profiles).
 * Allows the restaurant owner to register their official Owner account directly
 * from the browser, bootstraping the system and assigning the `owner` role.
 */
import { useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@tepisawah/auth";
import { getSupabaseClient } from "../lib/supabase.js";

interface FirstTimeSetupProps {
  onSetupComplete: () => void;
}

export function FirstTimeSetup({ onSetupComplete }: FirstTimeSetupProps): ReactNode {
  const { signIn } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedEmail || !password) {
      setError("Nama lengkap, email resmi, dan kata sandi wajib diisi.");
      return;
    }

    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter demi keamanan sistem restoran.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok. Harap periksa kembali.");
      return;
    }

    setLoading(true);
    try {
      const client = getSupabaseClient() as any;

      // 1. Sign up user via Supabase Auth
      const { data: authData, error: authError } = await client.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            display_name: trimmedName,
            phone: trimmedPhone || undefined,
          },
        },
      });

      if (authError) throw authError;

      const newUserId = authData.user?.id;
      if (!newUserId) {
        throw new Error("Pendaftaran berhasil dibuat, namun ID pengguna tidak terbit. Silakan muat ulang.");
      }

      // 2. Fetch 'owner' role ID
      const { data: roleData, error: roleError } = await client
        .from("roles")
        .select("id")
        .eq("code", "owner")
        .single();

      if (roleError || !roleData) {
        throw new Error("Peran 'owner' tidak ditemukan di basis data.");
      }

      // 3. Assign 'owner' role to this user
      const { error: assignError } = await client.from("user_roles").insert({
        user_id: newUserId,
        role_id: roleData.id,
      });

      if (assignError) {
        console.warn("Peringatan penugasan peran owner:", assignError);
      }

      setSuccess("Inisialisasi berhasil! Membuka portal pengelola restoran…");

      // 4. Automatically sign in
      try {
        await signIn(trimmedEmail, password);
      } catch (signInErr) {
        console.warn("Auto-signin gagal, pengguna dapat login manual:", signInErr);
      }

      // 5. Notify parent
      setTimeout(() => {
        onSetupComplete();
      }, 800);
    } catch (err: any) {
      console.error("Gagal inisialisasi akun owner:", err);
      setError(`Gagal melakukan inisialisasi: ${err.message || err}`);
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background: "radial-gradient(ellipse at top, #fbfbf9 0%, #fefae0 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "32rem",
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid var(--c-border, #e7e5e4)",
          padding: "clamp(1.5rem, 5vw, 2.25rem)",
          boxShadow: "0 20px 40px -15px rgba(24, 58, 29, 0.15)",
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <span
            style={{
              display: "inline-block",
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "0.25rem 0.75rem",
              borderRadius: "999px",
              background: "var(--c-forest-light, #dcfce7)",
              color: "var(--c-forest, #2e6b34)",
              marginBottom: "0.75rem",
            }}
          >
            Inisialisasi Sistem Pertama Kali
          </span>
          <h1
            style={{
              fontFamily: "var(--font-serif, serif)",
              fontSize: "1.65rem",
              fontWeight: 700,
              color: "var(--c-deepmoss, #183a1d)",
              margin: "0 0 0.5rem 0",
            }}
          >
            Daftarkan Akun Pemilik (Owner)
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#57534e",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Sistem mendeteksi belum ada staf terdaftar di database. Daftarkan akun Pemilik Resto utama untuk mengaktifkan portal dan mulai menambah staf dengan centang tugas.
          </p>
        </div>

        {/* Error / Success Feedback */}
        {error && (
          <div
            role="alert"
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              color: "#991b1b",
              fontSize: "0.875rem",
              marginBottom: "1.25rem",
              lineHeight: 1.4,
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              color: "#166534",
              fontSize: "0.875rem",
              marginBottom: "1.25rem",
              lineHeight: 1.4,
              fontWeight: 600,
            }}
          >
            {success}
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1rem" }}>
            <label
              htmlFor="owner-name"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "var(--c-coffeebrown, #6f3f24)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Nama Lengkap Pemilik
            </label>
            <input
              id="owner-name"
              type="text"
              required
              style={{
                width: "100%",
                minHeight: "2.75rem",
                padding: "0.55rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid #d6d3d1",
                fontSize: "0.9375rem",
                outline: "none",
              }}
              placeholder="Contoh: Bapak Siswanto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1rem" }}>
            <label
              htmlFor="owner-email"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "var(--c-coffeebrown, #6f3f24)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Email Resmi Pemilik
            </label>
            <input
              id="owner-email"
              type="email"
              required
              style={{
                width: "100%",
                minHeight: "2.75rem",
                padding: "0.55rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid #d6d3d1",
                fontSize: "0.9375rem",
                outline: "none",
              }}
              placeholder="Contoh: owner@tepisawah.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1rem" }}>
            <label
              htmlFor="owner-phone"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "var(--c-coffeebrown, #6f3f24)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Nomor WhatsApp / HP (Opsional)
            </label>
            <input
              id="owner-phone"
              type="tel"
              style={{
                width: "100%",
                minHeight: "2.75rem",
                padding: "0.55rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid #d6d3d1",
                fontSize: "0.9375rem",
                outline: "none",
              }}
              placeholder="Contoh: 081234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1rem" }}>
            <label
              htmlFor="owner-password"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "var(--c-coffeebrown, #6f3f24)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Kata Sandi Utama
            </label>
            <input
              id="owner-password"
              type="password"
              required
              minLength={8}
              style={{
                width: "100%",
                minHeight: "2.75rem",
                padding: "0.55rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid #d6d3d1",
                fontSize: "0.9375rem",
                outline: "none",
              }}
              placeholder="Minimal 8 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1.5rem" }}>
            <label
              htmlFor="owner-confirm-password"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "var(--c-coffeebrown, #6f3f24)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Konfirmasi Kata Sandi
            </label>
            <input
              id="owner-confirm-password"
              type="password"
              required
              minLength={8}
              style={{
                width: "100%",
                minHeight: "2.75rem",
                padding: "0.55rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid #d6d3d1",
                fontSize: "0.9375rem",
                outline: "none",
              }}
              placeholder="Ketik ulang kata sandi di atas"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              minHeight: "3rem",
              padding: "0.75rem 1.25rem",
              borderRadius: "8px",
              border: "1px solid var(--c-deepmoss, #183a1d)",
              background: "var(--c-deepmoss, #183a1d)",
              color: "#ffffff",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {loading ? "Mendaftarkan & Menginisialisasi…" : "Daftarkan Owner & Buka Portal"}
          </button>
        </form>
      </div>
    </div>
  );
}
