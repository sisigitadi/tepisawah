/**
 * Category form (Phase 5).
 *
 * Presentational editor for one `categories` row. Field errors come from the
 * query layer's pre-network validation; the page owns save state, so this
 * component stays a controlled form.
 */
import { Button, Card, Input } from "@tepisawah/ui";
import type { ReactNode } from "react";

import type { CategoryForm } from "./use-catalog.js";

export interface CategoryFormProps {
  form: CategoryForm;
  errors: Record<string, string> | null;
  editable: boolean;
  saving: boolean;
  onChange: (patch: Partial<CategoryForm>) => void;
  onSubmit: () => void;
}

export function CategoryForm(props: CategoryFormProps): ReactNode {
  const { form, errors, editable, saving, onChange, onSubmit } = props;

  return (
    <Card
      elevation="low"
      title="Detail kategori"
      description="Kategori mengelompokkan produk di menu pelanggan."
      footer={
        <Button
          variant="primary"
          loading={saving}
          disabled={!editable}
          onClick={onSubmit}
        >
          Simpan kategori
        </Button>
      }
    >
      <div className="catalog-form">
        <Input
          label="Nama kategori"
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
          label="Urutan tampil"
          name="sortOrder"
          type="number"
          min={0}
          value={String(form.sortOrder)}
          disabled={!editable}
          error={errors?.sortOrder}
          onChange={(event) =>
            onChange({ sortOrder: Number.parseInt(event.target.value, 10) || 0 })
          }
        />
        <label className="catalog-toggle">
          <input
            type="checkbox"
            checked={form.isActive}
            disabled={!editable}
            onChange={(event) => onChange({ isActive: event.target.checked })}
          />
          <span>Kategori aktif (tampil di menu pelanggan)</span>
        </label>
      </div>
    </Card>
  );
}
