/**
 * @tepisawah/ui — menu icon.
 */

import type { ReactNode, SVGProps } from "react";

export function MenuIcon(props: SVGProps<SVGSVGElement>): ReactNode {
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
      <path d="M3 6h14 M3 10h14 M3 14h14" />
    </svg>
  );
}
