/**
 * @tepisawah/ui — search icon.
 */

import type { ReactNode, SVGProps } from "react";

export function SearchIcon(props: SVGProps<SVGSVGElement>): ReactNode {
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
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.5 13.5 17 17" />
    </svg>
  );
}
