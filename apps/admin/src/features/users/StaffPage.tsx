/**
 * @tepisawah/admin — Staff & User Management (Kelola Staf Restoran).
 *
 * Manages staff profiles, assigned operational roles (Owner, Cashier/Waiter,
 * Kitchen, Supervisor, Admin), and account active status connected to Supabase.
 *
 * Enforces RBAC permissions via `@tepisawah/permissions`:
 *   - users.read: view staff list and metrics
 *   - users.update: edit staff display name
 *   - users.roles_manage: assign operational role
 *   - users.disable: toggle active/inactive status
 *   - users.create: register new staff account
 */
import { AccessDenied, useAuth } from "@tepisawah/auth";
import { PERMISSIONS } from "@tepisawah/permissions";
import { Skeleton } from "@tepisawah/ui";
import { useEffect, useState, useMemo, useCallback, type FormEvent, type ReactNode } from "react";
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
  owner: { label: "Owner / Pemilik", bg: "var(--c-ricepaper)", color: "var(--c-roastedearth)", border: "var(--c-border)" },
  admin: { label: "Administrator", bg: "var(--c-forest-light)", color: "var(--c-forest)", border: "#bbf7d0" },
  supervisor: { label: "Supervisor", bg: "var(--c-info-bg)", color: "var(--c-info)", border: "#bae6fd" },
  cashier: { label: "Kasir & Layanan Meja", bg: "var(--c-warmcream)", color: "var(--c-coffeebrown)", border: "var(--c-golden)" },
  waiter: { label: "Pelayan Meja", bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4" },
  kitchen: { label: "Dapur & KDS", bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
};

export function StaffPage(): ReactNode {
  const { can } = useAuth();
  const canRead = can(PERMISSIONS.USERS_READ);
  const canManageRoles = can(PERMISSIONS.USERS_ROLES_MANAGE);
  const canUpdateUser = can(PERMISSIONS.USERS_UPDATE);
  const canDisableUser = can(PERMISSIONS.USERS_DISABLE);
  const canCreateUser = can(PERMISSIONS.USERS_CREATE);

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

  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (canRead) {
      void loadData();
    }
  }, [canRead, loadData]);

  // Handle Escape key to close open dialogs
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (editingStaff) setEditingStaff(null);
        if (showAddModal) setShowAddModal(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingStaff, showAddModal]);

  if (!canRead) {
    return <AccessDenied />;
  }

  async function handleToggleActive(staff: StaffItem) {
    if (!canDisableUser) {
      setFeedback({ message: "Anda tidak memiliki wewenang untuk menonaktifkan akun staf.", type: "error" });
      return;
    }
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
    if (!canManageRoles) {
      setFeedback({ message: "Anda tidak memiliki wewenang untuk mengubah peran staf.", type: "error" });
      return;
    }
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
    if (!canUpdateUser) {
      setFeedback({ message: "Anda tidak memiliki wewenang untuk mengubah nama staf.", type: "error" });
      return;
    }
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

  async function handleCreateStaff(e: FormEvent) {
    e.preventDefault();
    if (!canCreateUser) {
      setFeedback({ message: "Anda tidak memiliki wewenang untuk mendaftarkan akun staf baru.", type: "error" });
      return;
    }
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setFeedback({ message: "Semua isian formulir staf wajib diisi lengkap.", type: "error" });
      return;
    }

    setCreating(true);
    setFeedback(null);
    try {
      const client = getSupabaseClient() as any;

      // 1. Sign up user through Supabase Auth
      const { data: authData, error: authError } = await client.auth.signUp({
        email: newEmail.trim(),
        password: newPassword,
        options: {
          data: {
            display_name: newName.trim(),
          },
        },
      });

      if (authError) throw authError;

      const newUserId = authData.user?.id;
      const selectedRole = availableRoles.find((r) => r.code === newRole);

      if (newUserId && selectedRole) {
        // 2. Assign initial role in user_roles
        const { error: roleError } = await client.from("user_roles").insert({
          user_id: newUserId,
          role_id: selectedRole.id,
        });
        if (roleError) {
          console.warn("User dibuat, namun penugasan peran memerlukan sinkronisasi:", roleError);
        }
      }

      setFeedback({
        message: `Akun staf ${newName.trim()} (${newEmail.trim()}) berhasil didaftarkan dengan peran ${selectedRole?.name || newRole}.`,
        type: "success",
      });

      setShowAddModal(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("TepiSawah2026!");
      await loadData();
    } catch (err: any) {
      console.error("Gagal menambah staf:", err);
      setFeedback({
        message: `Gagal mendaftarkan staf: ${err.message || err}. Pastikan email unik dan format sesuai.`,
        type: "error",
      });
    } finally {
      setCreating(false);
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
      if (roleFilter === "MGMT") return s.role_code === "owner" || s.role_code === "admin" || s.role_code === "supervisor";
      if (roleFilter === "ACTIVE") return s.is_active;
      if (roleFilter === "INACTIVE") return !s.is_active;
      return true;
    });
  }, [staffList, searchTerm, roleFilter]);

  return (
    <div className="staff-page-container">
      {/* Header */}
      <div className="staff-header-row">
        <div className="staff-header-titles">
          <h1>Kelola Staf Restoran</h1>
          <p className="staff-header-sub">
            Atur profil staf operasional, penugasan peran (Owner, Kasir, Waiter, Dapur KDS, Supervisor, Admin), serta status hak akses akun sistem.
          </p>
        </div>

        <div className="staff-header-actions">
          <button
            type="button"
            className="staff-btn staff-btn-secondary"
            onClick={() => void loadData()}
            disabled={loading}
          >
            {loading ? "Memuat…" : "Segarkan"}
          </button>

          {canCreateUser && (
            <button
              type="button"
              className="staff-btn staff-btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              Tambah Staf Baru
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="alert"
          className={`staff-alert ${feedback.type === "success" ? "staff-alert--success" : "staff-alert--error"}`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            className="staff-alert-close"
            onClick={() => setFeedback(null)}
            aria-label="Tutup notifikasi"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="staff-metrics-grid">
        <div className="staff-metric-card">
          <div className="staff-metric-label">Total Staf Terdaftar</div>
          <div className="staff-metric-value">{stats.total}</div>
        </div>

        <div className="staff-metric-card staff-metric-card--active">
          <div className="staff-metric-label">Staf Aktif</div>
          <div className="staff-metric-value">{stats.active}</div>
        </div>

        <div className="staff-metric-card staff-metric-card--foh">
          <div className="staff-metric-label">Kasir &amp; Pelayan (FOH)</div>
          <div className="staff-metric-value">{stats.foh}</div>
        </div>

        <div className="staff-metric-card staff-metric-card--kitchen">
          <div className="staff-metric-label">Dapur &amp; KDS</div>
          <div className="staff-metric-value">{stats.kitchen}</div>
        </div>

        <div className="staff-metric-card staff-metric-card--mgmt">
          <div className="staff-metric-label">Owner &amp; Manajemen</div>
          <div className="staff-metric-value">{stats.mgmt}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="staff-toolbar">
        <div className="staff-filter-tabs">
          {[
            { key: "ALL", label: "Semua Staf" },
            { key: "FOH", label: "Kasir & Pelayan" },
            { key: "KITCHEN", label: "Dapur KDS" },
            { key: "MGMT", label: "Manajemen" },
            { key: "ACTIVE", label: "Aktif" },
            { key: "INACTIVE", label: "Nonaktif" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`staff-filter-btn ${roleFilter === tab.key ? "staff-filter-btn--active" : ""}`}
              onClick={() => setRoleFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="staff-search-wrap">
          <input
            type="text"
            className="staff-search-input"
            placeholder="Cari nama staf atau peran operasional…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Staff Content */}
      {loading ? (
        <div className="staff-table-wrap" style={{ padding: "1.5rem" }} aria-busy="true">
          <Skeleton height="3.5rem" width="100%" />
          <div style={{ marginTop: "0.75rem" }}>
            <Skeleton height="3rem" width="100%" />
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <Skeleton height="3rem" width="100%" />
          </div>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div
          style={{
            padding: "3rem 1.5rem",
            textAlign: "center",
            background: "var(--c-surface)",
            borderRadius: "10px",
            border: "1px dashed var(--c-border)",
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--c-deepmoss)", fontSize: "1.1rem" }}>
            Tidak ada staf yang sesuai filter
          </div>
          <div style={{ fontSize: "0.875rem", color: "var(--c-text-muted)", marginTop: "0.35rem" }}>
            Ubah kata kunci pencarian atau bersihkan filter di atas.
          </div>
        </div>
      ) : (
        <>
          {/* Desktop & Tablet Table View */}
          <div className="staff-table-wrap">
            <table className="staff-table">
              <thead>
                <tr>
                  <th scope="col">Profil Staf</th>
                  <th scope="col">Peran Operasional</th>
                  <th scope="col">Status Akun</th>
                  <th scope="col" style={{ textAlign: "right" }}>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => {
                  const badge = ROLE_BADGES[staff.role_code] || {
                    label: staff.role_name,
                    bg: "var(--c-surface)",
                    color: "var(--c-text-main)",
                    border: "var(--c-border)",
                  };
                  const isSaving = savingId === staff.id;

                  return (
                    <tr
                      key={staff.id}
                      className={staff.is_active ? undefined : "staff-table tr--inactive"}
                    >
                      <td>
                        <div className="staff-user-cell">
                          <div
                            className="staff-avatar"
                            style={{
                              background: badge.bg,
                              color: badge.color,
                              borderColor: badge.border,
                            }}
                          >
                            {staff.display_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="staff-name">{staff.display_name}</div>
                            <div className="staff-id">ID: {staff.id.slice(0, 8)}…</div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <select
                          className="staff-role-select"
                          value={staff.role_code}
                          disabled={isSaving || !canManageRoles}
                          onChange={(e) => void handleChangeRole(staff, e.target.value)}
                          style={{
                            background: badge.bg,
                            color: badge.color,
                            borderColor: badge.border,
                          }}
                        >
                          {availableRoles.map((r) => (
                            <option key={r.id} value={r.code}>
                              {ROLE_BADGES[r.code]?.label || r.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <span
                          className={`staff-status-chip ${
                            staff.is_active ? "staff-status-chip--active" : "staff-status-chip--inactive"
                          }`}
                        >
                          <span className="staff-status-dot" />
                          {staff.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div className="staff-action-group">
                          {canUpdateUser && (
                            <button
                              type="button"
                              className="staff-action-btn staff-action-btn--edit"
                              disabled={isSaving}
                              onClick={() => {
                                setEditingStaff(staff);
                                setEditName(staff.display_name);
                              }}
                            >
                              Edit Nama
                            </button>
                          )}

                          {canDisableUser && (
                            <button
                              type="button"
                              className={`staff-action-btn ${
                                staff.is_active
                                  ? "staff-action-btn--toggle-off"
                                  : "staff-action-btn--toggle-on"
                              }`}
                              disabled={isSaving}
                              onClick={() => void handleToggleActive(staff)}
                            >
                              {staff.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards View (< 48rem) */}
          <div className="staff-cards-view">
            {filteredStaff.map((staff) => {
              const badge = ROLE_BADGES[staff.role_code] || {
                label: staff.role_name,
                bg: "var(--c-surface)",
                color: "var(--c-text-main)",
                border: "var(--c-border)",
              };
              const isSaving = savingId === staff.id;

              return (
                <div key={staff.id} className="staff-card-item">
                  <div className="staff-card-head">
                    <div className="staff-user-cell">
                      <div
                        className="staff-avatar"
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          borderColor: badge.border,
                        }}
                      >
                        {staff.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="staff-name">{staff.display_name}</div>
                        <div className="staff-id">ID: {staff.id.slice(0, 8)}…</div>
                      </div>
                    </div>

                    <span
                      className={`staff-status-chip ${
                        staff.is_active ? "staff-status-chip--active" : "staff-status-chip--inactive"
                      }`}
                    >
                      <span className="staff-status-dot" />
                      {staff.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>

                  <div className="staff-card-details">
                    <div className="staff-form-group" style={{ marginBottom: 0 }}>
                      <label className="staff-form-label">Peran Operasional</label>
                      <select
                        className="staff-role-select"
                        value={staff.role_code}
                        disabled={isSaving || !canManageRoles}
                        onChange={(e) => void handleChangeRole(staff, e.target.value)}
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          borderColor: badge.border,
                        }}
                      >
                        {availableRoles.map((r) => (
                          <option key={r.id} value={r.code}>
                            {ROLE_BADGES[r.code]?.label || r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="staff-card-actions">
                      {canUpdateUser && (
                        <button
                          type="button"
                          className="staff-action-btn staff-action-btn--edit"
                          disabled={isSaving}
                          onClick={() => {
                            setEditingStaff(staff);
                            setEditName(staff.display_name);
                          }}
                        >
                          Edit Nama
                        </button>
                      )}

                      {canDisableUser && (
                        <button
                          type="button"
                          className={`staff-action-btn ${
                            staff.is_active
                              ? "staff-action-btn--toggle-off"
                              : "staff-action-btn--toggle-on"
                          }`}
                          disabled={isSaving}
                          onClick={() => void handleToggleActive(staff)}
                        >
                          {staff.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Edit Name Modal Dialog */}
      {editingStaff && (
        <div
          className="staff-modal-backdrop"
          onClick={() => setEditingStaff(null)}
          role="presentation"
        >
          <div
            className="staff-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-name-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="staff-modal-header">
              <h2 id="edit-name-title" className="staff-modal-title">
                Ubah Nama Staf
              </h2>
              <button
                type="button"
                className="staff-modal-close"
                onClick={() => setEditingStaff(null)}
                aria-label="Tutup dialog"
              >
                ✕
              </button>
            </div>

            <div className="staff-form-group">
              <label htmlFor="staff-display-name" className="staff-form-label">
                Nama Tampilan Staf
              </label>
              <input
                id="staff-display-name"
                type="text"
                className="staff-form-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Contoh: Siti Rahma (Kasir)"
                autoFocus
              />
            </div>

            <div className="staff-modal-footer">
              <button
                type="button"
                className="staff-btn staff-btn-secondary"
                onClick={() => setEditingStaff(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="staff-btn staff-btn-primary"
                disabled={savingId === editingStaff.id || !editName.trim()}
                onClick={() => void handleSaveName()}
              >
                {savingId === editingStaff.id ? "Menyimpan…" : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal Dialog */}
      {showAddModal && (
        <div
          className="staff-modal-backdrop"
          onClick={() => setShowAddModal(false)}
          role="presentation"
        >
          <div
            className="staff-modal-card staff-modal-card--lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-staff-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="staff-modal-header">
              <h2 id="add-staff-title" className="staff-modal-title">
                Pendaftaran Akun Staf Baru
              </h2>
              <button
                type="button"
                className="staff-modal-close"
                onClick={() => setShowAddModal(false)}
                aria-label="Tutup dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateStaff(e)}>
              <div className="staff-form-group">
                <label htmlFor="new-staff-name" className="staff-form-label">
                  Nama Lengkap Staf
                </label>
                <input
                  id="new-staff-name"
                  type="text"
                  required
                  className="staff-form-input"
                  placeholder="Contoh: Siti Rahma"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="staff-form-group">
                <label htmlFor="new-staff-email" className="staff-form-label">
                  Email Akun Staf
                </label>
                <input
                  id="new-staff-email"
                  type="email"
                  required
                  className="staff-form-input"
                  placeholder="Contoh: sitirahma@tepisawah.id"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div className="staff-form-group">
                <label htmlFor="new-staff-role" className="staff-form-label">
                  Peran Operasional Awal
                </label>
                <select
                  id="new-staff-role"
                  className="staff-form-select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.code}>
                      {ROLE_BADGES[r.code]?.label || r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="staff-form-group">
                <label htmlFor="new-staff-password" className="staff-form-label">
                  Password Sementara
                </label>
                <input
                  id="new-staff-password"
                  type="text"
                  required
                  minLength={8}
                  className="staff-form-input"
                  placeholder="Minimal 8 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <small style={{ color: "var(--c-text-muted)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                  Staf dapat memperbarui kata sandi setelah berhasil login ke portal staf.
                </small>
              </div>

              <div className="staff-modal-footer">
                <button
                  type="button"
                  className="staff-btn staff-btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="staff-btn staff-btn-primary"
                  disabled={creating}
                >
                  {creating ? "Mendaftarkan…" : "Daftarkan Staf"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
