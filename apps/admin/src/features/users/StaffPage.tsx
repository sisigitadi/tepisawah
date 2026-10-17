/**
 * @tepisawah/admin — Staff & User Management (Kelola Staf Restoran).
 *
 * Manages staff profiles, multi-role task assignments (Owner, Kasir, Waiter,
 * Dapur KDS, Supervisor, Admin), editing staff details, and deleting staff.
 *
 * Enforces RBAC permissions via `@tepisawah/permissions`:
 *   - users.read: view staff list and metrics
 *   - users.update: edit staff profile (name, phone, active status)
 *   - users.roles_manage: assign operational tasks/roles
 *   - users.disable: toggle active/inactive status
 *   - users.create: register new staff account
 */
import { AccessDenied, useAuth } from "@tepisawah/auth";
import { PERMISSIONS } from "@tepisawah/permissions";
import { Skeleton } from "@tepisawah/ui";
import { useEffect, useState, useMemo, useCallback, type FormEvent, type ReactNode } from "react";
import { getSupabaseClient, createEphemeralSupabaseClient } from "../../lib/supabase.js";

export interface StaffRoleItem {
  id: string;
  code: string;
  name: string;
}

export interface StaffItem {
  id: string;
  display_name: string;
  username?: string | null;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  roles: StaffRoleItem[];
  role_codes: string[];
}

export interface AvailableRole {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface TaskDefinition {
  code: string;
  title: string;
  badge: string;
  description: string;
  bg: string;
  color: string;
  border: string;
}

export const TASK_DEFINITIONS: Record<string, TaskDefinition> = {
  cashier: {
    code: "cashier",
    title: "Kasir & Pembayaran",
    badge: "Kasir",
    description: "Meja kasir POS, konfirmasi antrean pesanan QR meja, terima pembayaran QRIS/Tunai, cetak struk tagihan.",
    bg: "var(--c-warmcream)",
    color: "var(--c-coffeebrown)",
    border: "var(--c-golden)",
  },
  waiter: {
    code: "waiter",
    title: "Layanan Meja & Pelayan",
    badge: "Pelayan",
    description: "Catat pesanan manual saung/meja, pantau hidangan siap saji dari dapur, antar pesanan ke saung/meja tamu.",
    bg: "#f0fdfa",
    color: "#0f766e",
    border: "#99f6e4",
  },
  kitchen: {
    code: "kitchen",
    title: "Dapur & KDS",
    badge: "Dapur",
    description: "Layar sentuh dapur KDS, antrean tiket masak, timer durasi memasak, dan tandai hidangan siap antar.",
    bg: "#fff7ed",
    color: "#c2410c",
    border: "#fed7aa",
  },
  supervisor: {
    code: "supervisor",
    title: "Supervisor Operasional",
    badge: "Supervisor",
    description: "Pengawasan operasional lantai resto, pembatalan/koreksi tiket pesanan bermasalah, void transaksi pembayaran.",
    bg: "var(--c-info-bg)",
    color: "var(--c-info)",
    border: "#bae6fd",
  },
  admin: {
    code: "admin",
    title: "Administrator Sistem",
    badge: "Admin",
    description: "Kelola katalog & harga menu, konfigurasi denah meja & QR, pengaturan konten CMS website, dan kelola akun staf.",
    bg: "var(--c-forest-light)",
    color: "var(--c-forest)",
    border: "#bbf7d0",
  },
  owner: {
    code: "owner",
    title: "Owner / Pemilik Resto",
    badge: "Owner",
    description: "Akses bisnis eksekutif penuh, pengawasan omzet keuangan resto, dan wewenang tingkat tertinggi.",
    bg: "var(--c-ricepaper)",
    color: "var(--c-roastedearth)",
    border: "var(--c-border)",
  },
};

const DEFAULT_TASK_DEF: TaskDefinition = {
  code: "cashier",
  title: "Kasir & Pembayaran",
  badge: "Kasir",
  description: "Meja kasir POS, konfirmasi antrean pesanan QR meja, terima pembayaran QRIS/Tunai, cetak struk tagihan.",
  bg: "var(--c-warmcream)",
  color: "var(--c-coffeebrown)",
  border: "var(--c-golden)",
};


export function StaffPage(): ReactNode {
  const { can, user, roles: myRoles } = useAuth();
  const isOwner = myRoles.includes("owner");

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

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<StaffItem | null>(null);

  // Edit staff form state
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);

  // New staff form state (operational staff use username + password; only admin/owner use official email)
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRoles, setNewRoles] = useState<string[]>(["cashier"]);
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

      // 2. Fetch profiles with user_roles join (with graceful fallback if username column is still being migrated)
      let profilesData: any[] | null = null;
      const { data: dataWithUsername, error: errWithUsername } = await client
        .from("profiles")
        .select("id, display_name, username, phone, is_active, created_at, user_roles(role_id, roles(id, code, name))")
        .order("created_at", { ascending: true });

      if (errWithUsername) {
        const { data: dataBase, error: errBase } = await client
          .from("profiles")
          .select("id, display_name, phone, is_active, created_at, user_roles(role_id, roles(id, code, name))")
          .order("created_at", { ascending: true });
        if (errBase) throw errBase;
        profilesData = dataBase;
      } else {
        profilesData = dataWithUsername;
      }

      const items: StaffItem[] = (profilesData || []).map((p: any) => {
        const userRolesList = Array.isArray(p.user_roles) ? p.user_roles : [];
        const assignedRoles: StaffRoleItem[] = userRolesList
          .map((ur: any) => ur.roles)
          .filter((r: any): r is StaffRoleItem => Boolean(r && r.code));

        return {
          id: p.id,
          display_name: p.display_name || "Staf Tanpa Nama",
          username: p.username || null,
          phone: p.phone || "",
          is_active: p.is_active !== false,
          created_at: p.created_at || new Date().toISOString(),
          roles: assignedRoles,
          role_codes: assignedRoles.map((r) => r.code),
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
        if (deletingStaff) setDeletingStaff(null);
        if (showAddModal) setShowAddModal(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingStaff, deletingStaff, showAddModal]);

  if (!canRead) {
    return <AccessDenied />;
  }

  // Toggle Single Role for Checkbox Group
  function toggleRoleSelection(
    currentRoles: string[],
    roleCode: string,
    setFn: (roles: string[]) => void
  ) {
    if (currentRoles.includes(roleCode)) {
      if (currentRoles.length === 1) {
        setFeedback({ message: "Staf wajib memiliki minimal 1 tugas operasional aktif.", type: "error" });
        return;
      }
      setFn(currentRoles.filter((c) => c !== roleCode));
    } else {
      setFn([...currentRoles, roleCode]);
    }
  }

  // Quick Toggle Active Status
  async function handleToggleActive(staff: StaffItem) {
    if (!canDisableUser) {
      setFeedback({ message: "Anda tidak memiliki wewenang untuk menonaktifkan akun staf.", type: "error" });
      return;
    }

    if (staff.id === user?.id) {
      setFeedback({ message: "Pencegahan Self-Lockout: Anda tidak dapat menonaktifkan akun Anda sendiri.", type: "error" });
      return;
    }

    if (staff.role_codes.includes("owner") && !isOwner) {
      setFeedback({ message: "Hanya Owner yang berhak menonaktifkan akun sesama Owner.", type: "error" });
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

  // Open Edit Modal
  function handleOpenEdit(staff: StaffItem) {
    if (!canUpdateUser && !canManageRoles) {
      setFeedback({ message: "Anda tidak memiliki wewenang untuk mengedit data staf.", type: "error" });
      return;
    }

    if (staff.role_codes.includes("owner") && !isOwner) {
      setFeedback({ message: "Hanya Owner yang berhak mengedit data akun Owner.", type: "error" });
      return;
    }

    setEditingStaff(staff);
    setEditName(staff.display_name);
    setEditUsername(staff.username || "");
    setEditPhone(staff.phone || "");
    setEditRoles(staff.role_codes.length > 0 ? staff.role_codes : ["cashier"]);
    setEditIsActive(staff.is_active);
    setFeedback(null);
  }

  // Save Edit Staff
  async function handleSaveEditStaff(e: FormEvent) {
    e.preventDefault();
    if (!editingStaff) return;

    if (!editName.trim()) {
      setFeedback({ message: "Nama tampilan staf tidak boleh kosong.", type: "error" });
      return;
    }

    if (editRoles.length === 0) {
      setFeedback({ message: "Pilih minimal 1 centang tugas operasional untuk staf ini.", type: "error" });
      return;
    }

    // Self-lockout check
    if (editingStaff.id === user?.id && !editIsActive) {
      setFeedback({ message: "Pencegahan Self-Lockout: Anda tidak dapat menonaktifkan akun Anda sendiri.", type: "error" });
      return;
    }

    setSavingId(editingStaff.id);
    setFeedback(null);
    try {
      const client = getSupabaseClient() as any;
      const trimmedName = editName.trim();
      const trimmedUsername = editUsername.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
      const trimmedPhone = editPhone.trim();

      // 1. Update Profile (with resilient handling if username column is still propagating)
      const updatePayload: Record<string, any> = {
        display_name: trimmedName,
        phone: trimmedPhone || null,
        is_active: editIsActive,
        updated_at: new Date().toISOString(),
      };
      if (trimmedUsername) {
        updatePayload.username = trimmedUsername;
      }

      const { error: profileError } = await client
        .from("profiles")
        .update(updatePayload)
        .eq("id", editingStaff.id);

      if (profileError) {
        if (profileError.message?.includes("username")) {
          delete updatePayload.username;
          const { error: retryError } = await client
            .from("profiles")
            .update(updatePayload)
            .eq("id", editingStaff.id);
          if (retryError) throw retryError;
        } else {
          throw profileError;
        }
      }

      // 2. Update Roles if authorized
      if (canManageRoles) {
        // Use RPC admin_update_user_roles (SECURITY DEFINER bypasses RLS and updates roles atomically)
        const { error: rpcError } = await client.rpc("admin_update_user_roles", {
          p_user_id: editingStaff.id,
          p_role_codes: editRoles,
        });

        if (rpcError) {
          console.warn("RPC admin_update_user_roles failed, attempting direct table fallback:", rpcError);
          // Delete previous roles
          const { error: delRolesErr } = await client.from("user_roles").delete().eq("user_id", editingStaff.id);
          if (delRolesErr) {
            console.error("Direct delete user_roles failed:", delRolesErr);
            throw new Error(
              `Gagal memperbarui centang tugas staf: ${rpcError.message || delRolesErr.message}. ` +
              "Silakan jalankan skrip SQL 'fix-staff-roles-and-management.sql' di Supabase SQL Editor."
            );
          }

          // Insert selected roles
          const roleInserts = editRoles
            .map((code) => {
              const roleObj = availableRoles.find((r) => r.code === code);
              return roleObj ? { user_id: editingStaff.id, role_id: roleObj.id } : null;
            })
            .filter(Boolean);

          if (roleInserts.length > 0) {
            const { error: rolesInsertError } = await client.from("user_roles").insert(roleInserts);
            if (rolesInsertError) {
              throw new Error(
                `Gagal menyimpan centang tugas staf: ${rolesInsertError.message}. ` +
                "Silakan jalankan skrip SQL 'fix-staff-roles-and-management.sql' di Supabase SQL Editor."
              );
            }
          }
        }
      }

      setFeedback({
        message: `Data staf "${trimmedName}" dan tugas operasional (${editRoles.join(", ")}) berhasil disimpan ke database.`,
        type: "success",
      });

      setEditingStaff(null);
      await loadData();
    } catch (err: any) {
      console.error("Gagal menyimpan perubahan staf:", err);
      setFeedback({ message: `Gagal memperbarui staf: ${err.message || err}`, type: "error" });
    } finally {
      setSavingId(null);
    }
  }

  // Open Delete Modal
  function handleOpenDelete(staff: StaffItem) {
    if (staff.id === user?.id) {
      setFeedback({ message: "Pencegahan Self-Lockout: Anda tidak dapat menghapus akun Anda sendiri.", type: "error" });
      return;
    }

    if (staff.role_codes.includes("owner") && !isOwner) {
      setFeedback({ message: "Hanya Owner yang berhak menghapus akun Owner.", type: "error" });
      return;
    }

    setDeletingStaff(staff);
    setFeedback(null);
  }

  // Confirm Delete Staff
  async function handleConfirmDeleteStaff() {
    if (!deletingStaff) return;

    setSavingId(deletingStaff.id);
    setFeedback(null);
    try {
      const client = getSupabaseClient() as any;

      // 1. Try RPC admin_delete_staff first (SECURITY DEFINER removes user_roles, profiles, and auth.users)
      const { error: rpcError } = await client.rpc("admin_delete_staff", {
        p_user_id: deletingStaff.id,
      });

      if (rpcError) {
        console.warn("RPC admin_delete_staff failed, falling back to direct delete:", rpcError);

        // Fallback: Delete user_roles
        const { error: roleDelErr } = await client.from("user_roles").delete().eq("user_id", deletingStaff.id);
        if (roleDelErr) {
          console.warn("Direct delete user_roles failed:", roleDelErr);
        }

        // Fallback: Attempt hard delete on profiles; fallback to deactivate
        const { error: delError } = await client
          .from("profiles")
          .delete()
          .eq("id", deletingStaff.id);

        if (delError) {
          // Soft-delete fallback to keep relational transaction history intact
          const { error: deactError } = await client
            .from("profiles")
            .update({
              is_active: false,
              display_name: `[Nonaktif] ${deletingStaff.display_name}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", deletingStaff.id);

          if (deactError) {
            throw new Error(
              `Gagal menghapus staf: ${rpcError.message || delError.message}. ` +
              "Silakan jalankan skrip SQL 'fix-staff-roles-and-management.sql' di Supabase SQL Editor."
            );
          }
        }
      }

      // Remove from active list
      setStaffList((prev) => prev.filter((s) => s.id !== deletingStaff.id));

      setFeedback({
        message: `Akun staf "${deletingStaff.display_name}" berhasil dihapus dari sistem.`,
        type: "success",
      });
      setDeletingStaff(null);
      await loadData();
    } catch (err: any) {
      console.error("Gagal menghapus staf:", err);
      setFeedback({ message: `Gagal menghapus staf: ${err.message || err}`, type: "error" });
    } finally {
      setSavingId(null);
    }
  }

  // Create New Staff (Operational staff use username + password; only admin/owner use official email)
  async function handleCreateStaff(e: FormEvent) {
    e.preventDefault();
    if (!canCreateUser) {
      setFeedback({ message: "Anda tidak memiliki wewenang untuk mendaftarkan akun staf baru.", type: "error" });
      return;
    }

    const cleanName = newName.trim();
    const cleanUsername = newUsername.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    const cleanPassword = newPassword.trim();
    const isPrivileged = newRoles.some((r) => r === "owner" || r === "admin");
    const cleanEmail = newEmail.trim().toLowerCase();

    if (!cleanName || !cleanPassword) {
      setFeedback({ message: "Nama staf dan kata sandi wajib diisi lengkap.", type: "error" });
      return;
    }

    if (!cleanUsername) {
      setFeedback({
        message: "Username staf wajib diisi (gunakan huruf kecil, angka, atau garis bawah).",
        type: "error",
      });
      return;
    }

    if (isPrivileged && (!cleanEmail || !cleanEmail.includes("@"))) {
      setFeedback({
        message: "Akun Administrator atau Owner wajib menyertakan email resmi restoran yang valid (contoh: admin@tepisawah.id).",
        type: "error",
      });
      return;
    }

    if (newRoles.length === 0) {
      setFeedback({ message: "Pilih minimal 1 tugas operasional untuk staf baru.", type: "error" });
      return;
    }

    setCreating(true);
    setFeedback(null);
    try {
      const client = getSupabaseClient() as any;

      // 1. Mendaftar secara murni melalui GoTrue API (ephemeralClient memastikan sesi admin saat ini tidak tertimpa)
      const authEmail = isPrivileged
        ? cleanEmail
        : `${cleanUsername}@staff.tepisawah.id`;

      const ephemeralClient = createEphemeralSupabaseClient();
      const { data: authData, error: authError } = await ephemeralClient.auth.signUp({
        email: authEmail,
        password: cleanPassword,
        options: {
          data: {
            display_name: cleanName,
            username: cleanUsername,
            phone: newPhone.trim() || undefined,
          },
        },
      });

      if (authError) {
        if (
          authError.message?.toLowerCase().includes("rate limit") ||
          (authError as any).code === "over_email_send_rate_limit"
        ) {
          throw new Error(
            "Batas pengiriman email Supabase terlampaui (rate limit). " +
            "Pastikan opsi 'Confirm email' di Supabase Dashboard (Authentication > Providers > Email) telah disetel ke OFF agar pendaftaran staf instan tanpa email konfirmasi."
          );
        }
        throw authError;
      }

      const newUserId = authData.user?.id;
      if (newUserId && newRoles.length > 0) {
        // 2. Hubungkan tugas operasional melalui RPC admin_update_user_roles
        const { error: rpcError } = await client.rpc("admin_update_user_roles", {
          p_user_id: newUserId,
          p_role_codes: newRoles,
        });

        if (rpcError) {
          console.warn("RPC admin_update_user_roles failed on creation, trying direct fallback:", rpcError);
          const roleInserts = newRoles
            .map((code) => {
              const rObj = availableRoles.find((r) => r.code === code);
              return rObj ? { user_id: newUserId, role_id: rObj.id } : null;
            })
            .filter(Boolean);

          if (roleInserts.length > 0) {
            await client.from("user_roles").insert(roleInserts);
          }
        }
      }

      setFeedback({
        message: isPrivileged
          ? `Akun manajemen "${cleanName}" (${cleanEmail}) berhasil didaftarkan. Login dapat menggunakan username "${cleanUsername}" atau email resmi.`
          : `Akun staf "${cleanName}" berhasil didaftarkan. Staf dapat langsung masuk menggunakan username "${cleanUsername}" dan kata sandi tanpa memerlukan email pribadi.`,
        type: "success",
      });

      setShowAddModal(false);
      setNewName("");
      setNewUsername("");
      setNewEmail("");
      setNewPhone("");
      setNewRoles(["cashier"]);
      setNewPassword("TepiSawah2026!");
      await loadData();
    } catch (err: any) {
      console.error("Gagal menambah staf:", err);
      setFeedback({
        message: `Gagal mendaftarkan staf: ${err.message || err}`,
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
    const foh = staffList.filter((s) => s.role_codes.some((c) => c === "cashier" || c === "waiter")).length;
    const kitchen = staffList.filter((s) => s.role_codes.includes("kitchen")).length;
    const mgmt = staffList.filter((s) => s.role_codes.some((c) => c === "owner" || c === "admin" || c === "supervisor")).length;
    return { total, active, foh, kitchen, mgmt };
  }, [staffList]);

  // Filtered staff
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchSearch =
        s.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.username && s.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
        s.role_codes.some((code) => code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.phone && s.phone.includes(searchTerm));

      if (!matchSearch) return false;

      if (roleFilter === "ALL") return true;
      if (roleFilter === "FOH") return s.role_codes.some((c) => c === "cashier" || c === "waiter");
      if (roleFilter === "KITCHEN") return s.role_codes.includes("kitchen");
      if (roleFilter === "MGMT") return s.role_codes.some((c) => c === "owner" || c === "admin" || c === "supervisor");
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
            Atur profil staf, penugasan centang tugas operasional (Kasir, Pelayan, Dapur KDS, Supervisor, Admin, Owner), serta pembaruan dan penghapusan staf.
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
              onClick={() => {
                setNewRoles(["cashier"]);
                setShowAddModal(true);
              }}
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
            placeholder="Cari nama staf, nomor HP, atau peran operasional…"
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
                  <th scope="col">Tugas &amp; Peran Terpilih</th>
                  <th scope="col">Status Akun</th>
                  <th scope="col" style={{ textAlign: "right" }}>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => {
                  const isSaving = savingId === staff.id;
                  const isSelf = staff.id === user?.id;
                  const isStaffOwner = staff.role_codes.includes("owner");
                  const primaryCode = staff.role_codes[0] || "cashier";
                  const primaryDef: TaskDefinition =
                    (primaryCode && TASK_DEFINITIONS[primaryCode])
                      ? TASK_DEFINITIONS[primaryCode]!
                      : DEFAULT_TASK_DEF;

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
                              background: primaryDef.bg,
                              color: primaryDef.color,
                              borderColor: primaryDef.border,
                            }}
                          >
                            {staff.display_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="staff-name">
                              {staff.display_name}
                              {isSelf && (
                                <span
                                  style={{
                                    marginLeft: "0.5rem",
                                    fontSize: "0.6875rem",
                                    padding: "0.15rem 0.45rem",
                                    borderRadius: "4px",
                                    background: "var(--c-forest-light)",
                                    color: "var(--c-forest)",
                                    fontWeight: 700,
                                  }}
                                >
                                  Akun Anda
                                </span>
                              )}
                            </div>
                            <div className="staff-id" style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.2rem" }}>
                              {staff.username ? (
                                <span style={{ fontWeight: 600, color: "var(--c-forest)", fontSize: "0.8125rem" }}>
                                  @{staff.username}
                                </span>
                              ) : null}
                              {staff.phone ? <span>📱 {staff.phone}</span> : null}
                              <span style={{ color: "var(--c-text-muted)", fontSize: "0.75rem" }}>ID: {staff.id.slice(0, 8)}…</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="staff-badge-group">
                          {staff.role_codes.length === 0 ? (
                            <span style={{ fontSize: "0.75rem", color: "var(--c-text-muted)" }}>
                              Belum ada tugas
                            </span>
                          ) : (
                            staff.role_codes.map((code) => {
                              const tDef = TASK_DEFINITIONS[code] || {
                                badge: code,
                                bg: "var(--c-surface)",
                                color: "var(--c-text-main)",
                                border: "var(--c-border)",
                              };
                              return (
                                <span
                                  key={code}
                                  style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                    padding: "0.25rem 0.6rem",
                                    borderRadius: "6px",
                                    background: tDef.bg,
                                    color: tDef.color,
                                    border: `1px solid ${tDef.border}`,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {tDef.badge}
                                </span>
                              );
                            })
                          )}
                        </div>
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
                          {(canUpdateUser || canManageRoles) && (
                            <button
                              type="button"
                              className="staff-action-btn staff-action-btn--edit"
                              disabled={isSaving || (isStaffOwner && !isOwner)}
                              onClick={() => handleOpenEdit(staff)}
                              title={isStaffOwner && !isOwner ? "Hanya Owner yang berhak mengedit akun Owner" : "Edit staf & atur tugas"}
                            >
                              Edit Staf
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
                              disabled={isSaving || isSelf || (isStaffOwner && !isOwner)}
                              onClick={() => void handleToggleActive(staff)}
                              title={
                                isSelf
                                  ? "Anda tidak dapat menonaktifkan akun sendiri"
                                  : isStaffOwner && !isOwner
                                  ? "Hanya Owner yang berhak menonaktifkan Owner"
                                  : staff.is_active
                                  ? "Nonaktifkan akses staf"
                                  : "Aktifkan kembali akses staf"
                              }
                            >
                              {staff.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                          )}

                          <button
                            type="button"
                            className="staff-action-btn staff-action-btn--delete"
                            disabled={isSaving || isSelf || (isStaffOwner && !isOwner)}
                            onClick={() => handleOpenDelete(staff)}
                            title={
                              isSelf
                                ? "Anda tidak dapat menghapus akun sendiri"
                                : isStaffOwner && !isOwner
                                ? "Hanya Owner yang berhak menghapus akun Owner"
                                : "Hapus akun staf dari sistem"
                            }
                          >
                            Hapus
                          </button>
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
              const isSaving = savingId === staff.id;
              const isSelf = staff.id === user?.id;
              const isStaffOwner = staff.role_codes.includes("owner");
              const primaryCode = staff.role_codes[0] || "cashier";
              const primaryDef: TaskDefinition =
                (primaryCode && TASK_DEFINITIONS[primaryCode])
                  ? TASK_DEFINITIONS[primaryCode]!
                  : DEFAULT_TASK_DEF;

              return (
                <div key={staff.id} className="staff-card-item">
                  <div className="staff-card-head">
                    <div className="staff-user-cell">
                      <div
                        className="staff-avatar"
                        style={{
                          background: primaryDef.bg,
                          color: primaryDef.color,
                          borderColor: primaryDef.border,
                        }}
                      >
                        {staff.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="staff-name">
                          {staff.display_name}
                          {isSelf && (
                            <span
                              style={{
                                marginLeft: "0.4rem",
                                fontSize: "0.6875rem",
                                padding: "0.1rem 0.35rem",
                                borderRadius: "4px",
                                background: "var(--c-forest-light)",
                                color: "var(--c-forest)",
                                fontWeight: 700,
                              }}
                            >
                              Akun Anda
                            </span>
                          )}
                        </div>
                        <div className="staff-id" style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.15rem" }}>
                          {staff.username ? (
                            <span style={{ fontWeight: 600, color: "var(--c-forest)", fontSize: "0.8125rem" }}>
                              @{staff.username}
                            </span>
                          ) : null}
                          {staff.phone ? <span>📱 {staff.phone}</span> : null}
                          <span style={{ fontSize: "0.75rem" }}>ID: {staff.id.slice(0, 8)}…</span>
                        </div>
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
                    <div>
                      <div className="staff-form-label" style={{ marginBottom: "0.35rem" }}>
                        Tugas Operasional Diberikan
                      </div>
                      <div className="staff-badge-group">
                        {staff.role_codes.length === 0 ? (
                          <span style={{ fontSize: "0.75rem", color: "var(--c-text-muted)" }}>
                            Belum ada tugas
                          </span>
                        ) : (
                          staff.role_codes.map((code) => {
                            const tDef = TASK_DEFINITIONS[code] || {
                              badge: code,
                              bg: "var(--c-surface)",
                              color: "var(--c-text-main)",
                              border: "var(--c-border)",
                            };
                            return (
                              <span
                                key={code}
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  padding: "0.2rem 0.5rem",
                                  borderRadius: "6px",
                                  background: tDef.bg,
                                  color: tDef.color,
                                  border: `1px solid ${tDef.border}`,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {tDef.badge}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="staff-card-actions">
                      {(canUpdateUser || canManageRoles) && (
                        <button
                          type="button"
                          className="staff-action-btn staff-action-btn--edit"
                          disabled={isSaving || (isStaffOwner && !isOwner)}
                          onClick={() => handleOpenEdit(staff)}
                        >
                          Edit Staf
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
                          disabled={isSaving || isSelf || (isStaffOwner && !isOwner)}
                          onClick={() => void handleToggleActive(staff)}
                        >
                          {staff.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      )}

                      <button
                        type="button"
                        className="staff-action-btn staff-action-btn--delete"
                        disabled={isSaving || isSelf || (isStaffOwner && !isOwner)}
                        onClick={() => handleOpenDelete(staff)}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Edit Staff Modal Dialog with Checkbox Tasks */}
      {editingStaff && (
        <div
          className="staff-modal-backdrop"
          onClick={() => setEditingStaff(null)}
          role="presentation"
        >
          <div
            className="staff-modal-card staff-modal-card--lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-staff-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="staff-modal-header">
              <h2 id="edit-staff-title" className="staff-modal-title">
                Edit Data &amp; Tugas Staf
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

            <form onSubmit={(e) => void handleSaveEditStaff(e)}>
              <div className="staff-form-group">
                <label htmlFor="edit-staff-name" className="staff-form-label">
                  Nama Tampilan Staf
                </label>
                <input
                  id="edit-staff-name"
                  type="text"
                  required
                  className="staff-form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Contoh: Siti Rahma"
                  autoFocus
                />
              </div>

              <div className="staff-form-group">
                <label htmlFor="edit-staff-username" className="staff-form-label">
                  Username Akun Staf
                </label>
                <input
                  id="edit-staff-username"
                  type="text"
                  className="staff-form-input"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                  placeholder="Contoh: kasir1"
                />
                <small style={{ color: "var(--c-text-muted)", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>
                  Digunakan staf untuk login ke portal staf (tanpa memerlukan email).
                </small>
              </div>

              <div className="staff-form-group">
                <label htmlFor="edit-staff-phone" className="staff-form-label">
                  Nomor WhatsApp / Telepon (Opsional)
                </label>
                <input
                  id="edit-staff-phone"
                  type="tel"
                  className="staff-form-input"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                />
              </div>

              <div className="staff-form-group">
                <label className="staff-form-label">
                  Pilihan Centang Tugas Operasional (Bisa Pilih Lebih dari 1)
                </label>
                <small style={{ color: "var(--c-text-muted)", fontSize: "0.75rem", marginBottom: "0.4rem" }}>
                  Centang tugas yang diizinkan untuk dikerjakan oleh staf ini di sistem resto:
                </small>

                <div className="staff-tasks-container">
                  {Object.values(TASK_DEFINITIONS).map((task) => {
                    const isChecked = editRoles.includes(task.code);
                    const isOwnerTask = task.code === "owner";
                    const isSelf = editingStaff.id === user?.id;
                    const disabled = (isOwnerTask && !isOwner) || (isSelf && task.code === "owner");

                    return (
                      <label
                        key={task.code}
                        className={`staff-task-item ${isChecked ? "staff-task-item--checked" : ""} ${
                          disabled ? "staff-task-item--disabled" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="staff-task-checkbox"
                          checked={isChecked}
                          disabled={disabled}
                          onChange={() => toggleRoleSelection(editRoles, task.code, setEditRoles)}
                        />
                        <div className="staff-task-content">
                          <div className="staff-task-header">
                            <span className="staff-task-title">{task.title}</span>
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                fontWeight: 700,
                                padding: "0.15rem 0.45rem",
                                borderRadius: "4px",
                                background: task.bg,
                                color: task.color,
                                border: `1px solid ${task.border}`,
                              }}
                            >
                              {task.badge}
                            </span>
                          </div>
                          <span className="staff-task-desc">
                            {task.description}
                            {disabled && isOwnerTask && " (Khusus Owner)"}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="staff-form-group">
                <label className="staff-form-label">Status Akses Akun</label>
                <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="edit-status"
                      checked={editIsActive}
                      onChange={() => setEditIsActive(true)}
                    />
                    <span>Aktif (Dapat Masuk ke Sistem)</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="edit-status"
                      checked={!editIsActive}
                      disabled={editingStaff.id === user?.id}
                      onChange={() => setEditIsActive(false)}
                    />
                    <span>Nonaktif (Akses Ditutup)</span>
                  </label>
                </div>
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
                  type="submit"
                  className="staff-btn staff-btn-primary"
                  disabled={savingId === editingStaff.id}
                >
                  {savingId === editingStaff.id ? "Menyimpan…" : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      {deletingStaff && (
        <div
          className="staff-modal-backdrop"
          onClick={() => setDeletingStaff(null)}
          role="presentation"
        >
          <div
            className="staff-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-staff-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="staff-modal-header">
              <h2 id="delete-staff-title" className="staff-modal-title" style={{ color: "#991b1b" }}>
                Hapus Akun Staf
              </h2>
              <button
                type="button"
                className="staff-modal-close"
                onClick={() => setDeletingStaff(null)}
                aria-label="Tutup dialog"
              >
                ✕
              </button>
            </div>

            <div className="staff-delete-box">
              <div className="staff-delete-box-title">
                ⚠️ Peringatan Penghapusan Akun
              </div>
              <div className="staff-delete-box-desc">
                Apakah Anda yakin ingin menghapus staf <strong>{deletingStaff.display_name}</strong>?
                Tindakan ini akan mencabut seluruh tugas operasional dan menghapus hak akses staf dari sistem restoran secara permanen.
              </div>
            </div>

            <div style={{ fontSize: "0.8125rem", color: "var(--c-text-muted)", marginBottom: "1rem" }}>
              ID Akun: <code>{deletingStaff.id}</code>
            </div>

            <div className="staff-modal-footer">
              <button
                type="button"
                className="staff-btn staff-btn-secondary"
                onClick={() => setDeletingStaff(null)}
                disabled={savingId === deletingStaff.id}
              >
                Batal
              </button>
              <button
                type="button"
                className="staff-btn"
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  borderColor: "#b91c1c",
                }}
                disabled={savingId === deletingStaff.id}
                onClick={() => void handleConfirmDeleteStaff()}
              >
                {savingId === deletingStaff.id ? "Menghapus…" : "Ya, Hapus Staf"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal Dialog with Checkbox Tasks */}
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
                <label className="staff-form-label">
                  Pilihan Centang Tugas Operasional (Bisa Pilih Lebih dari 1)
                </label>
                <small style={{ color: "var(--c-text-muted)", fontSize: "0.75rem", marginBottom: "0.4rem", display: "block" }}>
                  Centang satu atau beberapa tugas operasional yang akan dijalankan oleh staf baru:
                </small>

                <div className="staff-tasks-container">
                  {Object.values(TASK_DEFINITIONS).map((task) => {
                    const isChecked = newRoles.includes(task.code);
                    const isOwnerTask = task.code === "owner";
                    const disabled = isOwnerTask && !isOwner;

                    return (
                      <label
                        key={task.code}
                        className={`staff-task-item ${isChecked ? "staff-task-item--checked" : ""} ${
                          disabled ? "staff-task-item--disabled" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="staff-task-checkbox"
                          checked={isChecked}
                          disabled={disabled}
                          onChange={() => toggleRoleSelection(newRoles, task.code, setNewRoles)}
                        />
                        <div className="staff-task-content">
                          <div className="staff-task-header">
                            <span className="staff-task-title">{task.title}</span>
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                fontWeight: 700,
                                padding: "0.15rem 0.45rem",
                                borderRadius: "4px",
                                background: task.bg,
                                color: task.color,
                                border: `1px solid ${task.border}`,
                              }}
                            >
                              {task.badge}
                            </span>
                          </div>
                          <span className="staff-task-desc">
                            {task.description}
                            {disabled && isOwnerTask && " (Khusus Owner)"}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="staff-form-group">
                <label htmlFor="new-staff-username" className="staff-form-label">
                  Username Akun Staf
                </label>
                <input
                  id="new-staff-username"
                  type="text"
                  required
                  className="staff-form-input"
                  placeholder="Contoh: kasir1, koki_eko, waiter_siti"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                />
                <small style={{ color: "var(--c-text-muted)", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>
                  {newRoles.some((r) => r === "owner" || r === "admin")
                    ? "Username login cepat staf (huruf kecil, angka, atau garis bawah)."
                    : "Staf operasional cukup menggunakan username dan kata sandi saat masuk ke portal operasional (tanpa perlu email pribadi)."}
                </small>
              </div>

              {newRoles.some((r) => r === "owner" || r === "admin") && (
                <div className="staff-form-group">
                  <label htmlFor="new-staff-email" className="staff-form-label">
                    Email Resmi Admin / Pemilik Resto <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    id="new-staff-email"
                    type="email"
                    required
                    className="staff-form-input"
                    placeholder="Contoh: admin@tepisawah.id atau owner@tepisawah.id"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  <small style={{ color: "var(--c-text-muted)", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>
                    Khusus akun eksekutif (Admin / Owner) wajib menyertakan email resmi untuk pemulihan akses dan notifikasi audit sistem.
                  </small>
                </div>
              )}

              <div className="staff-form-group">
                <label htmlFor="new-staff-phone" className="staff-form-label">
                  Nomor Telepon / WhatsApp (Opsional)
                </label>
                <input
                  id="new-staff-phone"
                  type="tel"
                  className="staff-form-input"
                  placeholder="Contoh: 081234567890"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>

              <div className="staff-form-group">
                <label htmlFor="new-staff-password" className="staff-form-label">
                  Kata Sandi Masuk
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
                <small style={{ color: "var(--c-text-muted)", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>
                  Kata sandi sementara untuk diserahkan ke staf. Staf dapat memperbarui kata sandi setelah berhasil login.
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
