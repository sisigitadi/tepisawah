/**
 * Product modifier links editor (Phase 5).
 *
 * Presentational editor for the `product_modifiers` rows of one product. The
 * page owns the draft rows; this component only reports changes upward. Bounds
 * are validated server-side before anything is written
 * (DATABASE_SCHEMA.md §16): required implies min >= 1, max >= min, max >= 1.
 */
import { Button, Card, Input, Select } from "@tepisawah/ui";
import type { ReactNode } from "react";
import type { Modifier } from "@tepisawah/database";

import type { LinkRow } from "./use-catalog.js";

export interface ProductLinksProps {
  rows: LinkRow[];
  modifiers: readonly Modifier[];
  errors: Record<string, string> | null;
  editable: boolean;
  saving: boolean;
  pendingAttach: string;
  onChange: (rows: LinkRow[]) => void;
  onPendingAttach: (modifierId: string) => void;
  onAttach: () => void;
  onSubmit: () => void;
}

export function ProductLinks(props: ProductLinksProps): ReactNode {
  const {
    rows,
    modifiers,
    errors,
    editable,
    saving,
    pendingAttach,
    onChange,
    onPendingAttach,
    onAttach,
    onSubmit,
  } = props;

  const nameOf = (id: string): string =>
    modifiers.find((modifier) => modifier.id === id)?.name ?? id;

  const unlink = (modifierId: string): void => {
    onChange(rows.filter((row) => row.modifierId !== modifierId));
  };

  const patch = (modifierId: string, change: Partial<LinkRow>): void => {
    onChange(
      rows.map((row) =>
        row.modifierId === modifierId ? { ...row, ...change } : row,
      ),
    );
  };

  const attachable = modifiers.filter(
    (modifier) => !rows.some((row) => row.modifierId === modifier.id),
  );

  return (
    <Card
      elevation="low"
      title="Modifier produk"
      description="Batasan pilihan diambil dari produk ini saja."
      footer={
        <Button
          variant="primary"
          loading={saving}
          disabled={!editable || rows.length === 0}
          onClick={onSubmit}
        >
          Simpan modifier
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p className="catalog-empty">Belum ada modifier yang dipasang.</p>
      ) : (
        <div className="links-grid">
          {rows.map((row) => (
            <div key={row.modifierId} className="links-row">
              <span className="links-name">{nameOf(row.modifierId)}</span>
              <label className="catalog-toggle">
                <input
                  type="checkbox"
                  checked={row.isRequired}
                  disabled={!editable}
                  onChange={(event) =>
                    patch(row.modifierId, { isRequired: event.target.checked })
                  }
                />
                <span>Wajib</span>
              </label>
              <Input
                label="Minimal"
                name={`min-${row.modifierId}`}
                type="number"
                min={0}
                value={row.minSelect}
                disabled={!editable}
                error={errors?.[`${row.modifierId}.minSelect`]}
                onChange={(event) =>
                  patch(row.modifierId, { minSelect: event.target.value })
                }
              />
              <Input
                label="Maksimal"
                name={`max-${row.modifierId}`}
                type="number"
                min={1}
                value={row.maxSelect}
                disabled={!editable}
                error={errors?.[`${row.modifierId}.maxSelect`]}
                onChange={(event) =>
                  patch(row.modifierId, { maxSelect: event.target.value })
                }
              />
              <Input
                label="Urutan"
                name={`order-${row.modifierId}`}
                type="number"
                min={0}
                value={String(row.sortOrder)}
                disabled={!editable}
                onChange={(event) =>
                  patch(row.modifierId, {
                    sortOrder: Number.parseInt(event.target.value, 10) || 0,
                  })
                }
              />
              <Button
                variant="danger"
                size="sm"
                disabled={!editable}
                onClick={() => unlink(row.modifierId)}
              >
                Lepas
              </Button>
            </div>
          ))}
        </div>
      )}

      {editable && attachable.length > 0 ? (
        <div className="links-attach">
          <Select
            label="Pasang modifier"
            name="attachModifier"
            value={pendingAttach}
            placeholder="Pilih modifier"
            options={attachable.map((modifier) => ({
              value: modifier.id,
              label: modifier.name,
            }))}
            onChange={(event) => onPendingAttach(event.target.value)}
          />
          <Button
            variant="secondary"
            disabled={pendingAttach === ""}
            onClick={onAttach}
          >
            Tambah
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
