/**
 * @tepisawah/ui — check icon.
 */

import type { ReactNode, SVGProps } from "react";

export function CheckIcon(props: SVGProps<SVGSVGElement>): ReactNode {
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
      <path d="M4 10.5 8 14.5 16 6" />
    </svg>
  );
}
