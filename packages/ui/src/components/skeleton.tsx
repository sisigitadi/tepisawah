/**
 * @tepisawah/ui — skeleton component.
 *
 * Accessible placeholder for loading content. Uses `aria-hidden` because the
 * loading state is already announced by the surrounding region.
 */

import type { ReactNode } from "react";

export interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: "sm" | "md" | "lg" | "pill";
  className?: string;
}

const roundedClasses = {
  sm: "ui-skeleton--rounded-sm",
  md: "ui-skeleton--rounded-md",
  lg: "ui-skeleton--rounded-lg",
  pill: "ui-skeleton--rounded-pill",
} as const;

export function Skeleton({
  width = "100%",
  height = "1rem",
  rounded = "sm",
  className,
}: SkeletonProps): ReactNode {
  return (
    <div
      className={["ui-skeleton", roundedClasses[rounded], className ?? ""].filter(Boolean).join(" ")}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
