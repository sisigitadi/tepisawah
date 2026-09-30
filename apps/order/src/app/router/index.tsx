/**
 * @tepisawah/order — router composition.
 *
 * Guards stay UX-only — security lives in the backend + RLS; the full route
 * table is composed as feature phases land.
 *
 * Phase 8B adds the order status screen (API_CONTRACT.md §10.3). A customer
 * reaches it by re-scanning the table sticker after ordering: the entry page
 * resolves the table, and when this browser already placed an order at that
 * table this visit, its status opens straight away. The catalog/cart phase
 * will add the hop from `CheckoutPage`'s `onSubmitted` into a
 * `saveLastOrderId` + view switch of the same shape; that seam is the only
 * part of this flow still un-routed.
 */
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import type { PublicTableResolve } from "@tepisawah/database";
import { RootLayout } from "../../layouts/RootLayout.js";
import { HomePage } from "../../pages/HomePage.js";
import { OrderStatusPage, readLastOrderId } from "../../features/order-status/index.js";
import { QrEntryPage } from "../../features/qr/index.js";

/**
 * The printed QR points here with `?table=A12&t=...`, so a URL carrying both
 * halves opens the customer table entry instead of the landing page
 * (API_CONTRACT.md §8.1). Route composition is UX-only; resolution and access
 * are decided server-side (AUTH_RBAC_RLS.md §18).
 */
function hasQrParams(): boolean {
  const search = new URLSearchParams(window.location.search);
  return search.has("table") && search.has("t");
}

type View = "entry" | "status";

export function AppRouter(): ReactNode {
  // The resolved table context is the anchor every order read and write
  // resolves against (AUTH_RBAC_RLS.md §18). Holding it here lets the status
  // screen re-validate the same context the checkout will submit to.
  const [table, setTable] = useState<PublicTableResolve | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [view, setView] = useState<View>("entry");

  /**
   * The customer scanned the table's QR. The context is resolved server-side
   * by the entry page; if this browser already placed an order at this table
   * this visit, its status screen opens instead of the landing copy
   * (API_CONTRACT.md §10.3 — the order id alone is not a credential, the
   * table context still is, and the RPC re-validates both).
   */
  const startFromQr = useCallback((resolved: PublicTableResolve) => {
    setTable(resolved);
    const last = readLastOrderId(resolved.tableId);
    setOrderId(last);
    setView(last === null ? "entry" : "status");
  }, []);

  /** Leave the status screen; the remembered id survives a refresh. */
  const backToEntry = useCallback(() => {
    setView("entry");
  }, []);

  if (view === "status" && table !== null && orderId !== null) {
    return (
      <RootLayout>
        <OrderStatusPage
          table={table}
          orderId={orderId}
          onBack={backToEntry}
        />
      </RootLayout>
    );
  }

  return (
    <RootLayout>
      {hasQrParams() ? (
        <QrEntryPage onStart={startFromQr} />
      ) : (
        <HomePage />
      )}
    </RootLayout>
  );
}