/**
 * @tepisawah/ui — close icon.
 */

import type { ReactNode, SVGProps } from "react";

export function CloseIcon(props: SVGProps<SVGSVGElement>): ReactNode {
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
      <path d="M5 5 15 15 M15 5 5 15" />
    </svg>
  );
}
