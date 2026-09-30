/**
 * @tepisawah/ui — plus icon.
 */

import type { ReactNode, SVGProps } from "react";

export function PlusIcon(props: SVGProps<SVGSVGElement>): ReactNode {
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
      <path d="M10 4v12 M4 10h12" />
    </svg>
  );
}
