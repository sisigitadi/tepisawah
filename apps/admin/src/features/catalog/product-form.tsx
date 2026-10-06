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
import { ImageUploader } from "./image-uploader.js";

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
      title="Detail Produk Menu"
      description="Kelola informasi menu, harga, ketersediaan, serta foto produk yang tampil pada QR pelanggan."
      footer={
        <div className="product-form-footer">
          <Button
            variant="primary"
            loading={saving}
            disabled={!editable}
            onClick={onSubmit}
          >
            Simpan Perubahan Produk
          </Button>
        </div>
      }
    >
      <div className="catalog-form">
        <Select
          label="Kategori Menu"
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
          label="Nama Produk"
          name="name"
          placeholder="Contoh: Nasi Liwet Komplit"
          value={form.name}
          disabled={!editable}
          error={errors?.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <div className="catalog-form__full">
          <Input
            label="Deskripsi Menu"
            name="description"
            placeholder="Deskripsi singkat hidangan untuk menggugah selera pelanggan..."
            value={form.description}
            disabled={!editable}
            error={errors?.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </div>

        <Input
          label="Harga Jual (Rp)"
          name="price"
          type="number"
          min={0}
          step={500}
          placeholder="Contoh: 35000"
          value={form.price}
          disabled={!editable}
          error={errors?.price}
          onChange={(event) => onChange({ price: event.target.value })}
        />
        <Input
          label="Urutan Tampil (Sort Order)"
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

        {/* Image Uploader & Preview */}
        <div className="catalog-form__full">
          <ImageUploader
            imageUrl={form.imageUrl}
            disabled={!editable}
            error={errors?.imageUrl}
            onChange={(url) => onChange({ imageUrl: url })}
          />
        </div>

        {/* Status & Availability Toggles */}
        <div className="catalog-form__full catalog-toggles-row">
          <label className={`catalog-toggle-card ${form.isActive ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={form.isActive}
              disabled={!editable}
              onChange={(event) => onChange({ isActive: event.target.checked })}
            />
            <div className="catalog-toggle-info">
              <strong>Produk Aktif</strong>
              <p>Menu tampil di daftar katalog resto. Jika nonaktif, menu diarsipkan.</p>
            </div>
          </label>

          <label className={`catalog-toggle-card ${form.isAvailable ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={form.isAvailable}
              disabled={!editable}
              onChange={(event) => onChange({ isAvailable: event.target.checked })}
            />
            <div className="catalog-toggle-info">
              <strong>Tersedia Hari Ini</strong>
              <p>Jika dimatikan, produk berstatus "Habis" tetapi tetap terlihat pelanggan.</p>
            </div>
          </label>
        </div>
      </div>
    </Card>
  );
}
