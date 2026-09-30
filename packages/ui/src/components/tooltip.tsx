/**
 * @tepisawah/ui — tooltip component.
 *
 * Wrapper that surfaces a hint on hover and focus. Relies on CSS to toggle
 * visibility via the data attribute, so no portal or layout effect is needed.
 */

import { useId } from "react";
import type { ReactNode } from "react";

export interface TooltipProps {
  text: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({ text, children, side = "top", className }: TooltipProps): ReactNode {
  const describedBy = useId();
  return (
    <span
      className={["ui-tooltip", className ?? ""].filter(Boolean).join(" ")}
      data-side={side}
    >
      <span aria-describedby={describedBy}>{children}</span>
      <span role="tooltip" id={describedBy} className="ui-tooltip__text">
        {text}
      </span>
    </span>
  );
}
