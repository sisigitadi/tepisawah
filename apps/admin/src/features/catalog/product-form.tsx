/**
 * Product form (Phase 5).
 *
 * Presentational editor for one `products` row, including the category select,
 * the price field and the active/available toggles.
 *
 * The price field is staff-only by construction: this form is only reachable by
 * a session the router has already gated on catalog.update, and the value is
 * re-validated server-side before it is ever stored (API_CONTRACT.md §27 — the
 * client is never the source of a customer price; `resolve_order_item()` is).
 */
import { Button, Card, Input, Select } from "@tepisawah/ui";
import type { ReactNode } from "react";
import type { Category } from "@tepisawah/database";

import type { ProductForm } from "./use-catalog.js";

export interface ProductFormProps {
  form: ProductForm;
  categories: readonly Category[];
  errors: Record<string, string> | null;
  editable: boolean;
  saving: boolean;
  onChange: (patch: Partial<ProductForm>) => void;
  onSubmit: () => void;
}

export function ProductForm(props: ProductFormProps): ReactNode {
  const { form, categories, errors, editable, saving, onChange, onSubmit } = props;

  return (
    <Card
      elevation="low"
      title="Detail produk"
      description="Harga disimpan ke katalog dan di-snapshot saat pelanggan memesan."
      footer={
        <Button
          variant="primary"
          loading={saving}
          disabled={!editable}
          onClick={onSubmit}
        >
          Simpan produk
        </Button>
      }
    >
      <div className="catalog-form">
        <Select
          label="Kategori"
          name="categoryId"
          value={form.categoryId}
          disabled={!editable}
          error={errors?.categoryId}
          placeholder="Pilih kategori"
          options={categories.map((category) => ({
            value: category.id,
            label: category.name,
          }))}
          onChange={(event) => onChange({ categoryId: event.target.value })}
        />
        <Input
          label="Nama produk"
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
          label="URL gambar"
          name="imageUrl"
          value={form.imageUrl}
          disabled={!editable}
          error={errors?.imageUrl}
          hint="Disimpan sebagai referensi; Storage bucket diatur terpisah."
          onChange={(event) => onChange({ imageUrl: event.target.value })}
        />
        <Input
          label="Harga (rupiah)"
          name="price"
          type="number"
          min={0}
          value={form.price}
          disabled={!editable}
          error={errors?.price}
          onChange={(event) => onChange({ price: event.target.value })}
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
          <span>Produk aktif (tampil di menu pelanggan)</span>
        </label>
        <label className="catalog-toggle">
          <input
            type="checkbox"
            checked={form.isAvailable}
            disabled={!editable}
            onChange={(event) => onChange({ isAvailable: event.target.checked })}
          />
          <span>Tersedia hari ini (nonaktif = habis, tetap tampil)</span>
        </label>
      </div>
    </Card>
  );
}
