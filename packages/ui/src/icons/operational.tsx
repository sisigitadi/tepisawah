/**
 * @tepisawah/ui — operational icon set.
 *
 * Navigation and chrome icons shared by the POS, Kitchen, Waiter and Admin
 * apps. Icons inherit `currentColor` and an `1em` box so they scale with the
 * surrounding text size.
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

/** point_of_sale — POS terminal / payment terminal. */
export function TerminalIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01" />
    </>
  ));
}

/** receipt_long — order pipeline / receipt. */
export function ReceiptLongIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ));
}

/** table_restaurant — table management. */
export function TableIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M3 9h18" />
      <path d="M5 9v11M19 9v11" />
      <path d="M4 5h16l1 4H3z" />
    </>
  ));
}

/** analytics — dashboard. */
export function ChartIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ));
}

/** history — transaction history. */
export function HistoryIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 8v4l3 2" />
    </>
  ));
}

/** summarize — daily reports. */
export function ReportIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
      <path d="M9 12h7M9 16h7" />
    </>
  ));
}

/** badge — shift & cash management. */
export function BadgeIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </>
  ));
}

/** notifications — alert bell. */
export function BellIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
      <path d="M10.5 20a2 2 0 0 0 3 0" />
    </>
  ));
}

/** person — user / account. */
export function UserIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ));
}

/** lock_reset — cash drawer / access control. */
export function LockResetIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M12 3a9 9 0 1 0 8 5" />
      <path d="M20 3v5h-5" />
      <rect x="8" y="11" width="8" height="6" rx="1.5" />
      <path d="M10 11V9.5a2 2 0 0 1 4 0V11" />
    </>
  ));
}

/** settings — system settings. */
export function SettingsIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5l1.6 3.2 3.5-.5 1.9 3-1.6 3.1 1.6 3.1-1.9 3-3.5-.5L12 21.5l-3.6-2.1-3.5.5-1.9-3 1.6-3.1L3.4 9.7l1.9-3 3.5.5z" />
    </>
  ));
}

/** shield — security audit trail. */
export function ShieldIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M12 9v4M12 16.5h.01" />
    </>
  ));
}

/** group — user management. */
export function GroupIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M17.5 20a6.5 6.5 0 0 0-2-4.7" />
    </>
  ));
}

/** book — menu / product catalog. */
export function BookIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M4 4.5A2 2 0 0 1 6 3h13v18H6a2 2 0 0 0-2 2z" />
      <path d="M8 7.5h7M8 11.5h7" />
    </>
  ));
}
