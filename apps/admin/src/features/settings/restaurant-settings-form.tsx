/**
 * Restaurant settings form (Phase 4).
 *
 * Binds every column of the configuration row (DATABASE_SCHEMA.md §11). No
 * field is invented: tax, service charge, payment providers and promotions
 * are absent until a later phase explicitly configures them
 * (CLINE_IMPLEMENTATION_PLAN.md §10).
 */
import type { RestaurantSettingsInput } from "@tepisawah/database";

import { Button } from "@tepisawah/ui";
import { Card, Input, Select } from "@tepisawah/ui";

import type { SettingsForm } from "./use-settings.js";

const TIMEZONES = [
  { label: "WIB — Asia/Makassar (GMT+8)", value: "Asia/Makassar" },
  { label: "WIB — Asia/Pontianak (GMT+8)", value: "Asia/Pontianak" },
  { label: "WITA — Asia/Jayapura (GMT+9)", value: "Asia/Jayapura" },
];

const CURRENCIES = [{ label: "IDR — Rupiah", value: "IDR" }];

export interface RestaurantSettingsFormProps {
  form: SettingsForm;
  errors: Record<string, string> | null;
  editable: boolean;
  saving: boolean;
  onChange: (patch: Partial<SettingsForm>) => void;
  onSubmit: () => void;
  /** Forbidden in any of the supported values. */
  supportedTimezones: readonly string[];
}

function fieldOf(
  errors: Record<string, string> | null,
  field: string,
): string | undefined {
  return errors === null ? undefined : errors[field];
}

const FIELD_OF: Record<keyof RestaurantSettingsInput, string> = {
  restaurantName: "restaurantName",
  address: "address",
  phone: "phone",
  email: "email",
  timezone: "timezone",
  currency: "currency",
  logoUrl: "logoUrl",
  primaryColor: "primaryColor",
};

export function RestaurantSettingsForm(props: RestaurantSettingsFormProps) {
  const { form, errors, editable, saving, onChange, onSubmit } = props;

  return (
    <Card
      elevation="low"
      title="Identitas Restoran"
      description="Data publik dasar. Perubahan langsung tampil ke pelanggan."
      footer={
        <Button
          variant="primary"
          type="submit"
          loading={saving}
          disabled={!editable}
          fullWidth={false}
          onClick={onSubmit}
        >
          Simpan Pengaturan
        </Button>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="settings-grid">
          <Input
            label="Nama Restoran"
            hint="Wajib. Tampil di header pelanggan."
            error={fieldOf(errors, FIELD_OF.restaurantName)}
            disabled={!editable}
            value={form.restaurantName}
            onChange={(event) => onChange({ restaurantName: event.target.value })}
          />
          <Input
            label="Alamat"
            hint="Wajib."
            error={fieldOf(errors, FIELD_OF.address)}
            disabled={!editable}
            value={form.address}
            onChange={(event) => onChange({ address: event.target.value })}
          />
          <Input
            label="Telepon"
            hint="Opsional."
            error={fieldOf(errors, FIELD_OF.phone)}
            disabled={!editable}
            value={form.phone}
            onChange={(event) => onChange({ phone: event.target.value })}
          />
          <Input
            label="Email"
            hint="Opsional."
            error={fieldOf(errors, FIELD_OF.email)}
            disabled={!editable}
            value={form.email}
            onChange={(event) => onChange({ email: event.target.value })}
          />
          <Select
            label="Zona Waktu"
            hint="Dipakai server untuk status buka/tutup."
            error={fieldOf(errors, FIELD_OF.timezone)}
            disabled={!editable}
            placeholder="Pilih zona waktu"
            options={TIMEZONES.filter((option) =>
              props.supportedTimezones.includes(option.value),
            )}
            value={form.timezone}
            onChange={(event) => onChange({ timezone: event.target.value })}
          />
          <Select
            label="Mata Uang"
            hint="Kode ISO 4217."
            error={fieldOf(errors, FIELD_OF.currency)}
            disabled={!editable}
            placeholder="Pilih mata uang"
            options={CURRENCIES}
            value={form.currency}
            onChange={(event) => onChange({ currency: event.target.value })}
          />
          <Input
            label="URL Logo"
            hint="Opsional. Aman untuk pelanggan."
            error={fieldOf(errors, FIELD_OF.logoUrl)}
            disabled={!editable}
            value={form.logoUrl}
            onChange={(event) => onChange({ logoUrl: event.target.value })}
          />
          <Input
            label="Warna Utama"
            hint="Opsional. Format #RRGGBB."
            error={fieldOf(errors, FIELD_OF.primaryColor)}
            disabled={!editable}
            value={form.primaryColor}
            onChange={(event) => onChange({ primaryColor: event.target.value })}
          />
        </div>
      </form>
    </Card>
  );
}
