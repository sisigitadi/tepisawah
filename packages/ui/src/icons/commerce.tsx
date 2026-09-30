/**
 * @tepisawah/ui — commerce icon set.
 *
 * Payment, tender and order-flow icons for the POS, Waiter and Order apps.
 * Icons inherit `currentColor` and an `1em` box so they scale with the
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

/** account_balance_wallet — cash drawer amount. */
export function WalletIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.2" />
      <path d="M6 6V4.5A1.5 1.5 0 0 1 7.5 3H18" />
    </>
  ));
}

/** receipt — transaction count. */
export function ReceiptIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M6 3h12v18l-2.5-1.7L13 21l-2.5-1.7L8 21l-2-1.7z" />
      <path d="M9.5 8h5M9.5 12h5" />
    </>
  ));
}

/** payments — cash tendered. */
export function CashIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M6 9.5h.01M18 14.5h.01" />
    </>
  ));
}

/** qr_code_scanner — QRIS payment. */
export function QrIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M3.5 3.5h6v6h-6zM14.5 3.5h6v6h-6zM3.5 14.5h6v6h-6z" />
      <path d="M14.5 14.5h2.2v2.2h-2.2zM18.5 14.5h2v2h-2zM14.5 18.5h2v2h-2zM18.5 18.7h2v1.8h-2z" />
    </>
  ));
}

/** credit_card — EDC card payment. */
export function CardIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19" />
      <path d="M6 14.5h4" />
    </>
  ));
}

/** account_balance — bank transfer. */
export function BankIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M3 10.5L12 4l9 6.5" />
      <path d="M5 10.5V18h14v-7.5" />
      <path d="M9.5 18v-4h5v4" />
    </>
  ));
}

/** local_offer — promo / discount. */
export function TagIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M20.5 12.5l-8 8a2 2 0 0 1-2.8 0L3.5 14V3.5H14l6.5 6.5a2 2 0 0 1 0 2.5z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ));
}

/** timer — countdown. */
export function TimerIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2" />
      <path d="M9 2.5h6" />
    </>
  ));
}

/** schedule — clock. */
export function ClockIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ));
}

/** verified — validated check badge. */
export function VerifiedIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M12 2.8l2.4 2.2 3.2-.3.9 3.1 2.7 1.7-1.4 2.9 1.4 2.9-2.7 1.7-.9 3.1-3.2-.3L12 21.2l-2.4-2.4-3.2.3-.9-3.1L2.8 14l1.4-2.9L2.8 8.2l2.7-1.7.9-3.1 3.2.3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ));
}

/** smartphone — QR self-scan guest. */
export function PhoneIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </>
  ));
}

/** soup_kitchen — kitchen prep. */
export function KitchenIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M4 10h16a8 8 0 0 1-8 8 8 8 0 0 1-8-8z" />
      <path d="M12 4.5V8" />
      <path d="M6 21h12" />
    </>
  ));
}

/** local_fire_department — urgent / firing. */
export function FireIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M12 2.8s5.5 5 5.5 9.6A5.5 5.5 0 0 1 12 18a5.5 5.5 0 0 1-5.5-5.6C6.5 7.8 12 2.8 12 2.8z" />
      <path d="M12 12.6s2.2 1.9 2.2 3.4A2.2 2.2 0 0 1 12 18.2a2.2 2.2 0 0 1-2.2-2.2c0-1.5 2.2-3.4 2.2-3.4z" />
    </>
  ));
}

/** insights — summary metric. */
export function InsightsIcon(props: IconProps): ReactNode {
  return base(props, (
    <>
      <path d="M3 17l5-6 4 3 5-7 4 4" />
      <path d="M3 21h18" />
    </>
  ));
}

/** chevron_forward — next / arrow. */
export function ChevronForwardIcon(props: IconProps): ReactNode {
  return base(props, <path d="M9.5 5l7 7-7 7" />);
}

/** flash — fast / rave urgent. */
export function FlashIcon(props: IconProps): ReactNode {
  return base(props, <path d="M13.5 2.5L5 13.5h5l-1.5 8 8.5-11h-5z" />);
}
