/**
 * @tepisawah/ui — chevron-down icon.
 */

import type { ReactNode, SVGProps } from "react";

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>): ReactNode {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 8 10 13 15 8" />
    </svg>
  );
}
