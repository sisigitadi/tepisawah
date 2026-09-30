/**
 * @tepisawah/order — router composition.
 *
 * Guards stay UX-only — security lives in the backend + RLS; the full route
 * table is composed as feature phases land.
 *
 * Phase 8B adds the order status screen (API_CONTRACT.md §10.3). A customer
 * reaches it by re-scanning the table sticker after ordering: the entry page
 * resolves the table, and when this browser already placed an order at that
 * table this visit, its status opens straight away.
 *
 * The checkout seam is now wired end to end: QR entry resolves the table → the
 * catalog/cart page runs with that context → "Kirim ke Dapur" hands the cart
 * to `CheckoutPage` (create_draft_order + submit_order) → the status screen
 * opens on the created order and its id is remembered for refreshes
 * (saveLastOrderId). Every hop re-validates the table context server-side.
 */
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import type { PublicTableResolve } from "@tepisawah/database";
import { RootLayout } from "../../layouts/RootLayout.js";
import { HomePage } from "../../pages/HomePage.js";
import type { OrderCartEntry } from "../../pages/HomePage.js";
import { CheckoutPage } from "../../features/checkout/index.js";
import type { CartLine } from "../../features/checkout/index.js";
import { OrderStatusPage, readLastOrderId, saveLastOrderId } from "../../features/order-status/index.js";
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

type View = "entry" | "table" | "checkout" | "status";

export function AppRouter(): ReactNode {
  // The resolved table context is the anchor every order read and write
  // resolves against (AUTH_RBAC_RLS.md §18). Holding it here lets the status
  // screen re-validate the same context the checkout submitted to.
  const [table, setTable] = useState<PublicTableResolve | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  // The basket lives here, above the menu page: a hop to checkout and back
  // ("Ubah pesanan") must not wipe what the customer built.
  const [cart, setCart] = useState<Record<string, OrderCartEntry>>({});
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [view, setView] = useState<View>("entry");

  /**
   * The customer scanned the table's QR. The context is resolved server-side
   * by the entry page; if this browser already placed an order at this table
   * this visit, its status screen opens instead of the menu
   * (API_CONTRACT.md §10.3 — the order id alone is not a credential, the
   * table context still is, and the RPC re-validates both).
   */
  const startFromQr = useCallback((resolved: PublicTableResolve) => {
    setTable(resolved);
    const last = readLastOrderId(resolved.tableId);
    setOrderId(last);
    setView(last === null ? "table" : "status");
  }, []);

  /**
   * The cart leaves the menu page for the checkout review. The lines (with
   * display names) are built by the menu page from its live catalog.
   */
  const startCheckout = useCallback((items: CartLine[]) => {
    setCartLines(items);
    setView("checkout");
  }, []);

  /**
   * The checkout created and submitted the order. The id is remembered per
   * table so a refresh or re-scan reopens the status screen, then the flow
   * switches to it (API_CONTRACT.md §10.3).
   */
  const finishCheckout = useCallback(
    (createdId: string) => {
      setOrderId(createdId);
      setCart({});
      setCartLines([]);
      if (table !== null) saveLastOrderId(table.tableId, createdId);
      setView("status");
    },
    [table],
  );

  /** Leave the status screen; the remembered id survives a refresh. */
  const backToMenu = useCallback(() => {
    setView(table === null ? "entry" : "table");
  }, [table]);

  if (view === "status" && table !== null && orderId !== null) {
    return (
      <RootLayout>
        <OrderStatusPage
          table={table}
          orderId={orderId}
          onBack={backToMenu}
        />
      </RootLayout>
    );
  }

  if (view === "checkout" && table !== null) {
    return (
      <RootLayout>
        <CheckoutPage
          table={table}
          items={cartLines}
          onSubmitted={(createdId) => finishCheckout(createdId)}
          onBack={() => setView("table")}
        />
      </RootLayout>
    );
  }

  if (view === "table" && table !== null) {
    return (
      <RootLayout>
        <HomePage
          table={table}
          cart={cart}
          onCartChange={setCart}
          onCheckout={startCheckout}
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
