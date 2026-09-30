/**
 * @tepisawah/ui — action icon set.
 *
 * Buttons, feedback states and thermal printing icons shared by the
 * operational apps. Icons inherit `currentColor` and an `1em` box so they
 * scale with the surrounding text size.
 */

import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps, children: ReactNode): ReactNode {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** edit_note — add note. */
export function NoteIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M4 20h4L20 8l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
      <path d="M4 20h16" />
    </>
  ));
}

/** chat — special request note. */
export function ChatIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M20 12a7.5 7.5 0 1 1-3-6l3-.6-.6 3a7.4 7.4 0 0 1 .6 3.6z" />
      <path d="M8 11h8M8 14.5h5" />
    </>
  ));
}

/** print — thermal print. */
export function PrintIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M7 9V3.5h10V9" />
      <rect x="3.5" y="9" width="17" height="7" rx="2" />
      <path d="M7 16h10v5H7z" />
    </>
  ));
}

/** cancel — void. */
export function XCircleIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ));
}

/** backspace — clear nominal. */
export function BackspaceIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9L3.5 12z" />
      <path d="M12 9.5l4.5 4.5M16.5 9.5L12 14" />
    </>
  ));
}

/** visibility — preview. */
export function EyeIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ));
}

/** delete_forever — void/remove. */
export function TrashIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.5h5V7" />
      <path d="M6.5 7l1 13h9l1-13" />
      <path d="M10.5 11v5.5M13.5 11v5.5" />
    </>
  ));
}

/** refresh — sync / processing. */
export function RefreshIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </>
  ));
}

/** check_circle — success. */
export function CheckCircleIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M8.2 12.2l2.6 2.6 5-5.2" />
    </>
  ));
}

/** local_dining — fork & knife. */
export function DiningIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10" />
      <path d="M16 3c-1.5 1.5-2 3.2-2 5s.5 3 2 3.5V21" />
    </>
  ));
}

/** local_cafe — coffee cup. */
export function CoffeeIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M16 9h2.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M5 21h11" />
    </>
  ));
}

/** place — location pin. */
export function PlaceIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ));
}

/** stop_circle — hold / paused. */
export function PauseCircleIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M10 9v6M14 9v6" />
    </>
  ));
}

/** play_circle — start / resume. */
export function PlayCircleIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M10.2 8.8l5 3.2-5 3.2z" />
    </>
  ));
}

/** logout — end shift / sign out. */
export function LogoutIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </>
  ));
}
