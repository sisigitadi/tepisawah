/**
 * @tepisawah/ui — badge component.
 *
 * A small non-interactive label. Use `StatusBadge` for order/payment state.
 */

import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: "ui-badge--neutral",
  info: "ui-badge--info",
  success: "ui-badge--success",
  warning: "ui-badge--warning",
  danger: "ui-badge--danger",
};

export function Badge({ tone = "neutral", children, className }: BadgeProps): ReactNode {
  return (
    <span className={["ui-badge", toneClasses[tone], className ?? ""].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}
