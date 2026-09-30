/**
 * @tepisawah/ui — table component.
 *
 * Presentational table for read-only lists. It renders nothing when `rows` is
 * empty so callers can show their own empty state instead of an empty `<table>`.
 */

import type { ReactNode } from "react";

export interface TableColumn<Row> {
  key: string;
  header: ReactNode;
  /** Cell renderer; receives the row and its array index. */
  cell: (row: Row, index: number) => ReactNode;
  className?: string;
}

export interface TableProps<Row> {
  columns: ReadonlyArray<TableColumn<Row>>;
  rows: ReadonlyArray<Row>;
  rowKey: (row: Row, index: number) => string;
  caption?: ReactNode;
  className?: string;
}

export function Table<Row>({
  columns,
  rows,
  rowKey,
  caption,
  className,
}: TableProps<Row>): ReactNode {
  if (rows.length === 0) return null;

  return (
    <table className={["ui-table", className ?? ""].filter(Boolean).join(" ")}>
      {caption ? <caption className="ui-table__caption">{caption}</caption> : null}
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col" className={column.className}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={rowKey(row, index)} className="ui-table__row">
            {columns.map((column) => (
              <td key={column.key} className={column.className}>
                {column.cell(row, index)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
