/**
 * Settings page (Phase 4).
 *
 * Owns the admin settings experience: profile tab (DATABASE_SCHEMA.md §11),
 * operating hours tab (§12) and the read/write boundary between them.
 *
 * Permission handling here is UX only (PROJECT_RULES: "frontend permission
 * hanya UX"). The RLS policies in migration 004 remain the security boundary:
 * a session without settings.read receives an empty configuration, and a
 * session without settings.manage receives an RLS error on write — both
 * surface as an error toast, never as a silent success.
 */
import { AccessDenied, useAuth } from "@tepisawah/auth";
import { PERMISSIONS } from "@tepisawah/permissions";
import {
  Button,
  Card,
  Skeleton,
  StatusBadge,
  Tabs,
  ToastViewport,
  type Toast,
} from "@tepisawah/ui";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { OperatingHoursForm } from "./operating-hours-form.js";
import { RestaurantSettingsForm } from "./restaurant-settings-form.js";
import {
  loadSettings,
  saveHours,
  saveSettings,
  type HoursSaveResult,
  type SettingsSaveResult,
} from "./service.js";
import {
  EMPTY_SETTINGS_FORM,
  toHoursInputs,
  toHoursRows,
  toSettingsForm,
  toSettingsInput,
  useSettingsState,
  type HoursRow,
  type LoaderResult,
  type SettingsForm,
} from "./use-settings.js";

const SUPPORTED_TIMEZONES = ["Asia/Makassar", "Asia/Pontianak", "Asia/Jayapura"];

type TabId = "profile" | "hours";

/**
 * Loading placeholder. Deliberately renders no real heading: the page heading
 * is the stable "loaded" anchor tests and assistive tech key off, so a
 * transient skeleton `<h1>` that React swaps out on resolve would churn that
 * anchor. `aria-busy` carries the loading signal instead.
 */
function SettingsSkeleton(): ReactNode {
  return (
    <section className="settings-page" aria-busy="true">
      <Skeleton height="1.5rem" width="14rem" />
      <Skeleton height="12rem" />
    </section>
  );
}

function newToastId(): string {
  return `toast-${Math.random().toString(36).slice(2, 10)}`;
}

export function SettingsPage(): ReactNode {
  const { can, status } = useAuth();
  const canRead = can(PERMISSIONS.SETTINGS_READ);
  const canManage = can(PERMISSIONS.SETTINGS_MANAGE);

  const loader = useCallback(async (): Promise<LoaderResult> => {
    const snapshot = await loadSettings();
    return {
      status: snapshot.error ? "error" : "ready",
      error: snapshot.error,
      settings: snapshot.settings,
      rows: toHoursRows(snapshot.hours),
    };
  }, []);

  const { state, reload, setStatus } = useSettingsState(loader);

  const [settingsForm, setSettingsForm] = useState<SettingsForm>(EMPTY_SETTINGS_FORM);
  const [settingsErrors, setSettingsErrors] = useState<Record<string, string> | null>(null);
  const [rows, setRows] = useState<HoursRow[]>([]);
  const [hoursErrors, setHoursErrors] = useState<Record<string, string> | null>(null);
  const [tab, setTab] = useState<TabId>("profile");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const settingsId = state.settings?.id ?? null;
  const timezone = state.settings?.timezone ?? null;

  // Hydrate the editable copies whenever a fresh server snapshot arrives.
  useEffect(() => {
    setSettingsForm(toSettingsForm(state.settings));
    setSettingsErrors(null);
  }, [state.settings]);

  useEffect(() => {
    setRows(toHoursRows(state.rows));
    setHoursErrors(null);
  }, [state.rows]);

  const dismissToast = useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (tone: Toast["tone"], title: string, description?: string) => {
      const id = newToastId();
      setToasts((previous) => [
        ...previous,
        { id, tone, title, description: description ?? undefined },
      ]);
    },
    [],
  );

  const onSettingsChange = useCallback((patch: Partial<SettingsForm>) => {
    setSettingsForm((previous) => ({ ...previous, ...patch }));
  }, []);

  const onHoursChange = useCallback((patch: Partial<HoursRow>, rowId: string) => {
    setRows((previous) =>
      previous.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
    setHoursErrors((previous) => {
      if (previous === null || previous[rowId] === undefined) return previous;
      const next = { ...previous };
      delete next[rowId];
      return next;
    });
  }, []);

  const handleSettingsSubmit = async () => {
    if (!canManage || settingsId === null) {
      pushToast("danger", "Tidak diizinkan", "Anda tidak punya izin settings.manage.");
      return;
    }
    setSettingsErrors(null);
    setStatus({ saving: true });
    const result = await saveSettings(settingsId, toSettingsInput(settingsForm));
    setStatus({ saving: false });
    if (result.error !== null || result.data === null) {
      if (result.fieldErrors) setSettingsErrors(result.fieldErrors);
      pushToast("danger", "Gagal menyimpan", result.error ?? "Validasi gagal.");
      return;
    }
    const saved: SettingsSaveResult = result.data;
    setSettingsForm(toSettingsForm(saved.settings));
    pushToast(
      "success",
      "Pengaturan tersimpan",
      saved.audit !== null && saved.audit.changedFields.length > 0
        ? `${saved.audit.changedFields.length} perubahan dicatat.`
        : "Tidak ada perubahan.",
    );
  };

  const handleHoursSubmit = async () => {
    if (!canManage) {
      pushToast("danger", "Tidak diizinkan", "Anda tidak punya izin settings.manage.");
      return;
    }
    setHoursErrors(null);
    setStatus({ saving: true });
    const result = await saveHours(toHoursInputs(rows), state.rows);
    setStatus({ saving: false });
    if (result.error !== null || result.data === null) {
      if (result.fieldErrors) setHoursErrors(result.fieldErrors);
      pushToast("danger", "Gagal menyimpan", result.error ?? "Validasi gagal.");
      return;
    }
    const saved: HoursSaveResult = result.data;
    setRows(toHoursRows(saved.hours));
    pushToast(
      "success",
      "Jam operasional tersimpan",
      saved.audit.length > 0 ? `${saved.audit.length} hari berubah dicatat.` : "Tidak ada perubahan.",
    );
  };

  if (status === "loading" || state.status === "loading") {
    return <SettingsSkeleton />;
  }

  if (!canRead) {
    return <AccessDenied />;
  }

  if (state.status === "error") {
    return (
      <section className="settings-page">
        <h1>Pengaturan Restoran</h1>
        <Card
          elevation="low"
          title="Konfigurasi belum bisa dibaca"
          description={state.error ?? "Terjadi kesalahan."}
          actions={
            <Button variant="secondary" onClick={reload}>
              Coba lagi
            </Button>
          }
        />
      </section>
    );
  }

  if (settingsId === null) {
    return (
      <section className="settings-page">
        <h1>Pengaturan Restoran</h1>
        <Card
          elevation="low"
          title="Belum ada konfigurasi"
          description="Baris konfigurasi dibuat oleh admin pertama melalui seeding server-side."
        />
      </section>
    );
  }

  return (
    <section className="settings-page">
      <header className="settings-page__header">
        <div>
          <h1>Pengaturan Restoran</h1>
          <p className="settings-page__hint">
            Status buka dihitung server dari zona waktu <strong>{timezone ?? "—"}</strong>.
          </p>
        </div>
        <StatusBadge
          status={canManage ? "active" : "neutral"}
          label={canManage ? "Bisa mengubah" : "Hanya baca"}
        />
      </header>

      <Tabs
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
        items={[
          {
            id: "profile",
            label: "Profil",
            content: (
              <RestaurantSettingsForm
                form={settingsForm}
                errors={settingsErrors}
                editable={canManage}
                saving={state.saving}
                onChange={onSettingsChange}
                onSubmit={handleSettingsSubmit}
                supportedTimezones={SUPPORTED_TIMEZONES}
              />
            ),
          },
          {
            id: "hours",
            label: "Jam Operasional",
            content: (
              <OperatingHoursForm
                rows={rows}
                errors={hoursErrors}
                editable={canManage}
                saving={state.saving}
                onChange={onHoursChange}
                onSubmit={handleHoursSubmit}
              />
            ),
          },
        ]}
      />

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </section>
  );
}
