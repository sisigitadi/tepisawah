/**
 * Table form (Phase 6).
 *
 * Presentational editor for one `tables` row: the printed code, the display
 * name, the seat capacity and the operational status. Field errors come from the
 * query layer's pre-network validation; the page owns save state, so this
 * component stays a controlled form.
 */
import { Button, Card, Input, Select } from "@tepisawah/ui";
import type { ReactNode } from "react";

import {
  TABLE_STATUS_OPTIONS,
  type TableForm,
} from "./use-tables.js";

export interface TableFormProps {
  form: TableForm;
  errors: Record<string, string> | null;
  editable: boolean;
  saving: boolean;
  onChange: (patch: Partial<TableForm>) => void;
  onSubmit: () => void;
}

export function TableFormFields(props: TableFormProps): ReactNode {
  const { form, errors, editable, saving, onChange, onSubmit } = props;

  return (
    <Card
      elevation="low"
      title="Detail meja"
      description="Kode meja dicetak pada QR dan digunakan di lantai."
      footer={
        <Button
          variant="primary"
          loading={saving}
          disabled={!editable}
          onClick={onSubmit}
        >
          Simpan meja
        </Button>
      }
    >
      <div className="tables-form">
        <Input
          label="Kode meja"
          name="tableCode"
          value={form.tableCode}
          disabled={!editable}
          error={errors?.tableCode}
          onChange={(event) => onChange({ tableCode: event.target.value })}
        />
        <Input
          label="Nama meja"
          name="name"
          value={form.name}
          disabled={!editable}
          error={errors?.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <Input
          label="Kapasitas (kursi)"
          name="capacity"
          type="number"
          min={0}
          value={form.capacity}
          placeholder="Tidak diketahui"
          disabled={!editable}
          error={errors?.capacity}
          onChange={(event) => onChange({ capacity: event.target.value })}
        />
        <Select
          label="Status meja"
          name="status"
          options={TABLE_STATUS_OPTIONS}
          value={form.status}
          disabled={!editable}
          error={errors?.status}
          onChange={(event) =>
            onChange({ status: event.target.value as TableForm["status"] })
          }
        />
        <label className="tables-toggle">
          <input
            type="checkbox"
            checked={form.isActive}
            disabled={!editable}
            onChange={(event) => onChange({ isActive: event.target.checked })}
          />
          <span>Meja aktif (QR dapat dipindai pelanggan)</span>
        </label>
      </div>
    </Card>
  );
}
