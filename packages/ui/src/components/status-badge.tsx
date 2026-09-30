/**
 * @tepisawah/ui — status badge component.
 *
 * Renders a domain state machine value with a deterministic tone. Tones are
 * picked by keyword so new states degrade gracefully to `neutral` rather than
 * breaking the UI.
 */

import type { ReactNode } from "react";
import { Badge } from "./badge.js";
import type { BadgeTone } from "./badge.js";

export interface StatusBadgeProps {
  /** Machine-readable state, e.g. `pending`, `confirmed`, `cancelled`. */
  status: string;
  /** Optional human-friendly override; defaults to the status itself. */
  label?: string;
  className?: string;
}

function toneForStatus(status: string): BadgeTone {
  const value = status.toLowerCase();
  if (["pending", "awaiting", "queued", "draft"].includes(value)) return "warning";
  if (["confirmed", "paid", "served", "completed", "active", "available"].includes(value)) return "success";
  if (["cancelled", "failed", "refunded", "voided", "declined", "error"].includes(value)) return "danger";
  if (["preparing", "cooking", "ready", "processing", "delivered"].includes(value)) return "info";
  return "neutral";
}

export function StatusBadge({ status, label, className }: StatusBadgeProps): ReactNode {
  return (
    <Badge tone={toneForStatus(status)} className={className}>
      {label ?? status}
    </Badge>
  );
}
