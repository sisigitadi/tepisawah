/**
 * Operating hours form (Phase 4).
 *
 * Renders one row per day of week (DATABASE_SCHEMA.md §12). The server is
 * authoritative for whether the restaurant is open — this form only stores the
 * schedule, it never computes isOpen for the customer UI
 * (DATABASE_MIGRATION_PLAN.md §13).
 */
import { Button, Card, Input } from "@tepisawah/ui";

import { DAY_OF_WEEK_LABELS } from "./use-settings.js";
import type { HoursRow } from "./use-settings.js";

export interface OperatingHoursFormProps {
  rows: HoursRow[];
  errors: Record<string, string> | null;
  editable: boolean;
  saving: boolean;
  onChange: (patch: Partial<HoursRow>, rowId: string) => void;
  onSubmit: () => void;
}

function errorOf(errors: Record<string, string> | null, rowId: string): string | undefined {
  return errors === null ? undefined : errors[rowId];
}

export function OperatingHoursForm(props: OperatingHoursFormProps) {
  const { rows, errors, editable, saving, onChange, onSubmit } = props;

  return (
    <Card
      elevation="low"
      title="Jam Operasional"
      description="Hari tutup tidak boleh menyimpan jam buka. Status buka dihitung server."
      footer={
        <Button
          variant="primary"
          type="submit"
          loading={saving}
          disabled={!editable}
          onClick={onSubmit}
        >
          Simpan Jam Operasional
        </Button>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="hours-grid">
          {rows.map((row) => (
            <div key={row.id} className="hours-row">
              <div className="hours-row__label">{DAY_OF_WEEK_LABELS[row.dayOfWeek]}</div>
              <label className="hours-toggle">
                <input
                  type="checkbox"
                  checked={!row.isClosed}
                  disabled={!editable}
                  onChange={(event) =>
                    onChange({ isClosed: !event.target.checked }, row.id)
                  }
                />
                <span>Buka</span>
              </label>
              <Input
                label="Buka"
                type="time"
                disabled={!editable || row.isClosed}
                error={errorOf(errors, row.id)}
                value={row.openTime}
                onChange={(event) => onChange({ openTime: event.target.value }, row.id)}
              />
              <Input
                label="Tutup"
                type="time"
                disabled={!editable || row.isClosed}
                error={errorOf(errors, row.id)}
                value={row.closeTime}
                onChange={(event) => onChange({ closeTime: event.target.value }, row.id)}
              />
            </div>
          ))}
        </div>
      </form>
    </Card>
  );
}
