/**
 * Modifier form (Phase 5).
 *
 * Presentational editor for one `modifiers` row. A modifier is a reusable
 * customization with a signed price delta; the selection bounds
 * (min/max/required) are set per product on the link, so they are edited from
 * the product editor, not here (DATABASE_SCHEMA.md §15-§16).
 *
 * The price delta is staff-only by construction: this form is only reachable by
 * a session the router has already gated on `modifiers.manage`, and the value
 * is re-validated server-side before it is stored (API_CONTRACT.md §27 — the
 * client is never the source of a customer price).
 */
import { Button, Card, Input } from "@tepisawah/ui";
import type { ReactNode } from "react";

import type { ModifierForm } from "./use-catalog.js";

export interface ModifierFormProps {
  form: ModifierForm;
  errors: Record<string, string> | null;
  editable: boolean;
  saving: boolean;
  onChange: (patch: Partial<ModifierForm>) => void;
  onSubmit: () => void;
}

export function ModifierForm(props: ModifierFormProps): ReactNode {
  const { form, errors, editable, saving, onChange, onSubmit } = props;

  return (
    <Card
      elevation="low"
      title="Detail modifier"
      description="Modifier dapat dipasang ke banyak produk dengan batasan pilihannya masing-masing."
      footer={
        <Button
          variant="primary"
          loading={saving}
          disabled={!editable}
          onClick={onSubmit}
        >
          Simpan modifier
        </Button>
      }
    >
      <div className="catalog-form">
        <Input
          label="Nama modifier"
          name="name"
          value={form.name}
          disabled={!editable}
          error={errors?.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <Input
          label="Deskripsi"
          name="description"
          value={form.description}
          disabled={!editable}
          error={errors?.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
        <Input
          label="Selisih harga (rupiah)"
          name="priceDelta"
          type="number"
          value={form.priceDelta}
          disabled={!editable}
          error={errors?.priceDelta}
          hint="Boleh negatif (turun ukuran) atau 0."
          onChange={(event) => onChange({ priceDelta: event.target.value })}
        />
        <label className="catalog-toggle">
          <input
            type="checkbox"
            checked={form.isActive}
            disabled={!editable}
            onChange={(event) => onChange({ isActive: event.target.checked })}
          />
          <span>Modifier aktif</span>
        </label>
      </div>
    </Card>
  );
}
