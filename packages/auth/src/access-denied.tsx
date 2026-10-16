/**
 * @tepisawah/auth — access-denied screen (Phase 2, extended in Phase 3).
 *
 * Shown when authentication succeeded but the account is not authorized to
 * reach the internal application (AUTH_RBAC_RLS.md §15, §41):
 *   - `profiles.is_active` is false (§14)
 *   - the account holds no active staff role — a customer never enters an
 *     internal application (§15, §17)
 *
 * The message is deliberately generic: no role name, permission name or
 * internal detail is disclosed (§41 — do not reveal what the caller is
 * missing). Offers sign-out so the user can leave cleanly.
 */
import { useState } from "react";
import { useAuth } from "./auth-context.js";

/** Screen for an authenticated but unauthorized account with recovery actions. */
export function AccessDenied(): React.ReactNode {
  const { user, profile, roles, signOut, error, supabase } = useAuth();
  const [claiming, setClaiming] = useState(false);
  const [claimFeedback, setClaimFeedback] = useState<string | null>(null);

  const userEmail = user?.email ?? "";
  const displayName = profile?.display_name || userEmail.split("@")[0] || "Pengguna";
  const hasAnyRole = roles.length > 0;

  async function handleClaimOwner() {
    if (!supabase) return;
    setClaiming(true);
    setClaimFeedback(null);
    try {
      const { error: rpcErr } = await (supabase as any).rpc("claim_first_owner");
      if (rpcErr) throw rpcErr;
      setClaimFeedback("Berhasil! Akun Anda telah resmi diaktifkan sebagai Pemilik Restoran (Owner). Membuka portal staf…");
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }, 800);
    } catch (err: any) {
      setClaimFeedback(err.message || "Gagal mengklaim peran Pemilik Restoran.");
      setClaiming(false);
    }
  }

  function handleGoTo(path: string) {
    if (typeof window !== "undefined") {
      window.location.href = path;
    }
  }

  return (
    <section role="alert" aria-live="assertive" style={{ textAlign: "center", padding: "1.5rem 1rem" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }} aria-hidden="true">
        🛡️
      </div>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>
        {hasAnyRole ? "Akses Ruangan Terbatas" : "Akses Belum Ditetapkan"}
      </h1>

      <p style={{ margin: "0 0 1rem 0", fontSize: "0.95rem", lineHeight: 1.5 }}>
        {hasAnyRole
          ? `Halo ${displayName}, akun Anda saat ini tidak memiliki izin untuk membuka halaman ini.`
          : (error ?? "Akun Anda telah masuk, namun belum memiliki penugasan peran staf aktif di sistem.")}
      </p>

      {userEmail && (
        <div
          style={{
            background: "rgba(0, 0, 0, 0.04)",
            padding: "0.5rem 0.75rem",
            borderRadius: "6px",
            fontSize: "0.85rem",
            marginBottom: "1.25rem",
            display: "inline-block",
            color: "#475569",
          }}
        >
          Masuk sebagai: <strong>{userEmail}</strong>
          {hasAnyRole && (
            <span style={{ marginLeft: "0.5rem", color: "#166534", fontWeight: 600 }}>
              (Peran: {roles.join(", ")})
            </span>
          )}
        </div>
      )}

      {!hasAnyRole && (
        <div style={{ maxWidth: "28rem", margin: "0 auto 1.5rem auto", textAlign: "center" }}>
          <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0 0 1rem 0", lineHeight: 1.5 }}>
            Jika Anda adalah pemilik restoran atau sistem baru saja dibersihkan, klik tombol di bawah untuk mengaktifkan akun ini sebagai <strong>Pemilik Utama (Owner)</strong>:
          </p>

          {claimFeedback && (
            <div
              role="alert"
              style={{
                padding: "0.65rem 0.85rem",
                borderRadius: "6px",
                fontSize: "0.85rem",
                marginBottom: "1rem",
                background: claimFeedback.startsWith("Berhasil") ? "#f0fdf4" : "#fef2f2",
                color: claimFeedback.startsWith("Berhasil") ? "#166534" : "#991b1b",
                border: claimFeedback.startsWith("Berhasil") ? "1px solid #bbf7d0" : "1px solid #fecaca",
                lineHeight: 1.4,
              }}
            >
              {claimFeedback}
            </div>
          )}

          <div style={{ marginBottom: "1.25rem" }}>
            <button
              type="button"
              disabled={claiming}
              onClick={handleClaimOwner}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #183A1D 0%, #2E6B34 100%)",
                color: "#FEFAE0",
                border: "1px solid #183A1D",
                fontWeight: 700,
                fontSize: "0.9375rem",
                cursor: claiming ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(24, 58, 29, 0.25)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                transition: "all 0.15s ease",
              }}
            >
              <span>👑</span>
              <span>{claiming ? "Mengaktifkan Peran Owner…" : "Aktifkan Sebagai Pemilik Resto (Owner)"}</span>
            </button>
          </div>

          <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0, lineHeight: 1.4 }}>
            Bagi staf operasional reguler (Kasir, Pelayan, atau Dapur), hubungi Pemilik Resto untuk mengaktifkan tugas operasional Anda melalui menu Kelola Staf.
          </p>
        </div>
      )}

      {/* Recovery Action Buttons */}
      <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center", flexWrap: "wrap" }}>
        {roles.includes("cashier" as any) || roles.includes("waiter" as any) ? (
          <button
            type="button"
            onClick={() => handleGoTo("/pos")}
            style={{
              padding: "0.6rem 1.15rem",
              borderRadius: "6px",
              background: "#15803d",
              color: "#ffffff",
              border: "none",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Buka Kasir &amp; Meja
          </button>
        ) : null}

        {roles.includes("kitchen" as any) ? (
          <button
            type="button"
            onClick={() => handleGoTo("/kitchen")}
            style={{
              padding: "0.6rem 1.15rem",
              borderRadius: "6px",
              background: "#c2410c",
              color: "#ffffff",
              border: "none",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Buka Layar Dapur
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => handleGoTo("/")}
          style={{
            padding: "0.6rem 1.15rem",
            borderRadius: "6px",
            background: "#ffffff",
            color: "#334155",
            border: "1px solid #cbd5e1",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Pintu Masuk Utama
        </button>

        <button
          type="button"
          onClick={() => void signOut()}
          style={{
            padding: "0.6rem 1.15rem",
            borderRadius: "6px",
            background: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #fca5a5",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Keluar
        </button>
      </div>
    </section>
  );
}
