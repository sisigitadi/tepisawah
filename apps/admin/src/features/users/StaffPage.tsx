/**
 * @tepisawah/admin — Staff & User Management (Kelola Staf Restoran).
 *
 * Manages staff profiles, assigned operational roles (Owner, Cashier/Waiter,
 * Kitchen, Supervisor, Admin), and account active status connected to Supabase.
 */
import { useEffect, useState, useMemo, type ReactNode } from "react";
import { getSupabaseClient } from "../../lib/supabase.js";

export interface StaffItem {
  id: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  role_code: string;
  role_name: string;
  role_id: string;
}

export interface AvailableRole {
  id: string;
  code: string;
  name: string;
  description?: string;
}

const ROLE_BADGES: Record<string, { label: string; bg: string; color: string; border: string }> = {
  owner: { label: "👑 Owner / Pemilik", bg: "#faf5ff", color: "#6b21a8", border: "#e9d5ff" },
  admin: { label: "🛡️ Administrator", bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  supervisor: { label: "⭐ Supervisor", bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
  cashier: { label: "💳 Kasir & Layanan Meja", bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" },
  waiter: { label: "🍽️ Pelayan Meja", bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4" },
  kitchen: { label: "👨‍🍳 Dapur & KDS", bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
};

export function StaffPage(): ReactNode {
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [availableRoles, setAvailableRoles] = useState<AvailableRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [editName, setEditName] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // New staff form state
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("cashier");
  const [newPassword, setNewPassword] = useState("TepiSawah2026!");
  const [creating, setCreating] = useState(false);

  async function loadData() {
    setLoading(true);
    setFeedback(null);
    try {
      const client = getSupabaseClient() as any;

      // 1. Fetch available roles
      const { data: rolesData, error: rolesError } = await client
        .from("roles")
        .select("id, code, name, description")
        .order("code", { ascending: true });

      if (rolesError) throw rolesError;
      const roles: AvailableRole[] = rolesData || [];
      setAvailableRoles(roles);

      // 2. Fetch profiles with user_roles
      const { data: profilesData, error: profilesError } = await client
        .from("profiles")
        .select("id, display_name, is_active, created_at, user_roles(role_id, roles(id, code, name))")
        .order("created_at", { ascending: true });

      if (profilesError) throw profilesError;

      const items: StaffItem[] = (profilesData || []).map((p: any) => {
        const ur = p.user_roles?.[0];
        const role = ur?.roles;
        return {
          id: p.id,
          display_name: p.display_name || "Staf Tanpa Nama",
          is_active: p.is_active !== false,
          created_at: p.created_at || new Date().toISOString(),
          role_code: role?.code || "cashier",
          role_name: role?.name || "Kasir",
          role_id: ur?.role_id || "",
        };
      });

      setStaffList(items);
    } catch (err: any) {
      console.error("Gagal memuat staf:", err);
      setFeedback({ message: `Gagal memuat data staf: ${err.message || err}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleToggleActive(staff: StaffItem) {
    setSavingId(staff.id);
    setFeedback(null);
    try {
      const client = getSupabaseClient() as any;
      const nextStatus = !staff.is_active;

      const { error } = await client
        .from("profiles")
        .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", staff.id);

      if (error) throw error;

      setStaffList((prev) =>
        prev.map((s) => (s.id === staff.id ? { ...s, is_active: nextStatus } : s))
      );
      setFeedback({
        message: `Status akun ${staff.display_name} berhasil ${nextStatus ? "diaktifkan" : "dinonaktifkan"}.`,
        type: "success",
      });
    } catch (err: any) {
      setFeedback({ message: `Gagal mengubah status: ${err.message || err}`, type: "error" });
    } finally {
      setSavingId(null);
    }
  }

  async function handleChangeRole(staff: StaffItem, nextRoleCode: string) {
    const selectedRole = availableRoles.find((r) => r.code === nextRoleCode);
    if (!selectedRole) return;

    setSavingId(staff.id);
    setFeedback(null);
    try {
      const client = getSupabaseClient() as any;

      // Delete existing role and insert new role
      await client.from("user_roles").delete().eq("user_id", staff.id);
      const { error } = await client.from("user_roles").insert({
        user_id: staff.id,
        role_id: selectedRole.id,
      });

      if (error) throw error;

      setStaffList((prev) =>
        prev.map((s) =>
          s.id === staff.id
            ? { ...s, role_code: selectedRole.code, role_name: selectedRole.name, role_id: selectedRole.id }
            : s
        )
      );
      setFeedback({
        message: `Peran ${staff.display_name} berhasil diubah menjadi ${selectedRole.name}.`,
        type: "success",
      });
    } catch (err: any) {
      setFeedback({ message: `Gagal mengubah peran: ${err.message || err}`, type: "error" });
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveName() {
    if (!editingStaff || !editName.trim()) return;
    setSavingId(editingStaff.id);
    setFeedback(null);
    try {
      const client = getSupabaseClient() as any;
      const trimmed = editName.trim();

      const { error } = await client
        .from("profiles")
        .update({ display_name: trimmed, updated_at: new Date().toISOString() })
        .eq("id", editingStaff.id);

      if (error) throw error;

      setStaffList((prev) =>
        prev.map((s) => (s.id === editingStaff.id ? { ...s, display_name: trimmed } : s))
      );
      setFeedback({ message: `Nama staf berhasil diperbarui menjadi "${trimmed}".`, type: "success" });
      setEditingStaff(null);
    } catch (err: any) {
      setFeedback({ message: `Gagal update nama: ${err.message || err}`, type: "error" });
    } finally {
      setSavingId(null);
    }
  }

  // Summary counts
  const stats = useMemo(() => {
    const total = staffList.length;
    const active = staffList.filter((s) => s.is_active).length;
    const foh = staffList.filter((s) => s.role_code === "cashier" || s.role_code === "waiter").length;
    const kitchen = staffList.filter((s) => s.role_code === "kitchen").length;
    const mgmt = staffList.filter((s) => s.role_code === "owner" || s.role_code === "admin" || s.role_code === "supervisor").length;
    return { total, active, foh, kitchen, mgmt };
  }, [staffList]);

  // Filtered staff
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchSearch =
        s.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.role_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.role_code.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (roleFilter === "ALL") return true;
      if (roleFilter === "FOH") return s.role_code === "cashier" || s.role_code === "waiter";
      if (roleFilter === "KITCHEN") return s.role_code === "kitchen";
      if (roleFilter === "MGMT") return s.role_code === "owner" || s.role_code === "admin";
      if (roleFilter === "ACTIVE") return s.is_active;
      if (roleFilter === "INACTIVE") return !s.is_active;
      return true;
    });
  }, [staffList, searchTerm, roleFilter]);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0" }}>
            👥 Kelola Staf Restoran
          </h1>
          <p style={{ color: "#64748b", margin: 0, fontSize: "0.95rem" }}>
            Kelola profil staf operasional, penugasan peran (Owner, Kasir &amp; Waiter, Dapur KDS, Admin), dan status hak akses.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: "0.9rem",
            }}
          >
            🔄 {loading ? "Memuat..." : "Segarkan"}
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1.15rem",
              borderRadius: "8px",
              border: "none",
              background: "#15803d",
              color: "#ffffff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.9rem",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            }}
          >
            ➕ Tambah Staf Baru
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderRadius: "8px",
            marginBottom: "1.5rem",
            background: feedback.type === "success" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${feedback.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            color: feedback.type === "success" ? "#166534" : "#991b1b",
            fontSize: "0.9rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ background: "#ffffff", padding: "1rem", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 500 }}>Total Staf Terdaftar</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a", marginTop: "0.25rem" }}>
            {stats.total}
          </div>
        </div>

        <div style={{ background: "#f0fdf4", padding: "1rem", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: "0.85rem", color: "#166534", fontWeight: 600 }}>Staf Aktif</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#15803d", marginTop: "0.25rem" }}>
            {stats.active}
          </div>
        </div>

        <div style={{ background: "#f0f9ff", padding: "1rem", borderRadius: "10px", border: "1px solid #bae6fd" }}>
          <div style={{ fontSize: "0.85rem", color: "#0369a1", fontWeight: 600 }}>Kasir &amp; Pelayan (FOH)</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0284c7", marginTop: "0.25rem" }}>
            {stats.foh}
          </div>
        </div>

        <div style={{ background: "#fff7ed", padding: "1rem", borderRadius: "10px", border: "1px solid #fed7aa" }}>
          <div style={{ fontSize: "0.85rem", color: "#9a3412", fontWeight: 600 }}>Dapur &amp; KDS</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#ea580c", marginTop: "0.25rem" }}>
            {stats.kitchen}
          </div>
        </div>

        <div style={{ background: "#faf5ff", padding: "1rem", borderRadius: "10px", border: "1px solid #e9d5ff" }}>
          <div style={{ fontSize: "0.85rem", color: "#6b21a8", fontWeight: 600 }}>Owner &amp; Manajemen</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#7e22ce", marginTop: "0.25rem" }}>
            {stats.mgmt}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        style={{
          background: "#ffffff",
          padding: "1rem",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          marginBottom: "1.5rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {[
            { key: "ALL", label: "Semua Staf" },
            { key: "FOH", label: "Kasir & Pelayan" },
            { key: "KITCHEN", label: "Dapur KDS" },
            { key: "MGMT", label: "Manajemen / Owner" },
            { key: "ACTIVE", label: "Aktif" },
            { key: "INACTIVE", label: "Nonaktif" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRoleFilter(tab.key)}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: roleFilter === tab.key ? "#15803d" : "#e2e8f0",
                background: roleFilter === tab.key ? "#15803d" : "#f8fafc",
                color: roleFilter === tab.key ? "#ffffff" : "#475569",
                fontWeight: roleFilter === tab.key ? 600 : 500,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ minWidth: "260px" }}>
          <input
            type="text"
            placeholder="Cari nama staf atau peran..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.85rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "0.9rem",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Staff Table */}
      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>Memuat daftar staf...</div>
      ) : filteredStaff.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            background: "#ffffff",
            borderRadius: "10px",
            border: "1px dashed #cbd5e1",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👥</div>
          <div style={{ fontWeight: 600, color: "#1e293b" }}>Tidak ada staf yang sesuai filter</div>
          <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.25rem" }}>
            Silakan ubah kata kunci pencarian atau bersihkan filter.
          </div>
        </div>
      ) : (
        <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>Staf</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>Peran Operasional</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600, textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((staff) => {
                const badge = ROLE_BADGES[staff.role_code] || {
                  label: staff.role_name,
                  bg: "#f1f5f9",
                  color: "#334155",
                  border: "#cbd5e1",
                };
                const isSaving = savingId === staff.id;

                return (
                  <tr
                    key={staff.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: staff.is_active ? "#ffffff" : "#fbfbfc",
                      opacity: staff.is_active ? 1 : 0.75,
                    }}
                  >
                    {/* Name column */}
                    <td style={{ padding: "1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "50%",
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "1rem",
                            flexShrink: 0,
                          }}
                        >
                          {staff.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "0.95rem" }}>
                            {staff.display_name}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                            ID: {staff.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role dropdown column */}
                    <td style={{ padding: "1rem" }}>
                      <select
                        value={staff.role_code}
                        disabled={isSaving}
                        onChange={(e) => void handleChangeRole(staff, e.target.value)}
                        style={{
                          padding: "0.4rem 0.65rem",
                          borderRadius: "6px",
                          border: `1px solid ${badge.border}`,
                          background: badge.bg,
                          color: badge.color,
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          cursor: isSaving ? "not-allowed" : "pointer",
                        }}
                      >
                        {availableRoles.map((r) => (
                          <option key={r.id} value={r.code}>
                            {ROLE_BADGES[r.code]?.label || r.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Status column */}
                    <td style={{ padding: "1rem" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          padding: "0.25rem 0.65rem",
                          borderRadius: "12px",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          background: staff.is_active ? "#f0fdf4" : "#fef2f2",
                          color: staff.is_active ? "#16a34a" : "#dc2626",
                          border: `1px solid ${staff.is_active ? "#bbf7d0" : "#fecaca"}`,
                        }}
                      >
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: staff.is_active ? "#16a34a" : "#dc2626",
                          }}
                        />
                        {staff.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>

                    {/* Action buttons column */}
                    <td style={{ padding: "1rem", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => {
                            setEditingStaff(staff);
                            setEditName(staff.display_name);
                          }}
                          style={{
                            padding: "0.35rem 0.75rem",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            fontSize: "0.8rem",
                            cursor: isSaving ? "not-allowed" : "pointer",
                            fontWeight: 500,
                          }}
                        >
                          ✏️ Edit Nama
                        </button>

                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => void handleToggleActive(staff)}
                          style={{
                            padding: "0.35rem 0.75rem",
                            borderRadius: "6px",
                            border: `1px solid ${staff.is_active ? "#fed7aa" : "#bbf7d0"}`,
                            background: staff.is_active ? "#fff7ed" : "#f0fdf4",
                            color: staff.is_active ? "#c2410c" : "#15803d",
                            fontSize: "0.8rem",
                            cursor: isSaving ? "not-allowed" : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {staff.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Name Modal */}
      {editingStaff && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>
              Ubah Nama Staf
            </h3>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#475569", marginBottom: "0.4rem" }}>
                Nama Tampilan Staf
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Contoh: Siti Rahma (Kasir)"
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={savingId === editingStaff.id}
                onClick={() => void handleSaveName()}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "6px",
                  border: "none",
                  background: "#15803d",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {savingId === editingStaff.id ? "Menyimpan..." : "Simpan Nama"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Guide Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "1.75rem",
              width: "100%",
              maxWidth: "560px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#0f172a" }}>
                ➕ Panduan Menambah Akun Staf Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: 1.6, margin: "0 0 1rem 0" }}>
              Untuk keamanan operasional restoran pada sistem produksi, akun login staf didaftarkan resmi melalui Supabase Auth agar data transaksi kasir dan audit keuangan terlindungi.
            </p>

            <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "1.25rem" }}>
              <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                Langkah Cepat (1 Menit):
              </div>
              <ol style={{ margin: 0, paddingLeft: "1.25rem", color: "#334155", fontSize: "0.85rem", lineHeight: 1.7 }}>
                <li>Buka <strong>Supabase Dashboard</strong> ➔ menu <strong>Authentication &gt; Users</strong>.</li>
                <li>Klik tombol <strong>"Add user"</strong> ➔ masukkan email resmi staf (contoh: <code>kasir@tepisawah.id</code>).</li>
                <li>Masukkan kata sandi staf &amp; pastikan <strong>"Auto Confirm User" ON</strong>.</li>
                <li>Jalankan skrip yang telah disiapkan di repositori: <code>provision-official-staff.sql</code> di menu <strong>SQL Editor</strong>.</li>
                <li>Staf baru akan langsung muncul di daftar halaman ini dan siap bertugas di portal staf!</li>
              </ol>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  padding: "0.55rem 1.25rem",
                  borderRadius: "6px",
                  border: "none",
                  background: "#15803d",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                }}
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
