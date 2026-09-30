/**
 * Checkout page (Phase 8A).
 *
 * What the customer reviews before sending the cart to the kitchen. The page
 * deliberately shows no money until the server returns the DRAFT order: the
 * order number, subtotal and total below are read back from `create_draft_order()`,
 * never computed from the cart, so a customer cannot see — let alone send — a
 * price of their own (API_CONTRACT.md §2.2, §10.1).
 *
 * The submit is guarded by the resolved table context. If the session was
 * closed after the customer scanned, the RPC refuses and the page surfaces that
 * refusal instead of silently retrying into a void.
 */
import { Button, Card } from "@tepisawah/ui";
import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { PublicTableResolve } from "@tepisawah/database";
import {
  checkoutIdempotencyKey,
  checkoutSubmitIdempotencyKey,
  submitDraftOrder,
  submitDraftOrderForConfirmation,
} from "./service.js";
import type { CartLine, CheckoutError } from "./service.js";

export interface CheckoutPageProps {
  /** The table context the QR resolved; the order joins its active session. */
  table: PublicTableResolve;
  /** The cart the customer built. */
  items: CartLine[];
  /** Called with the created DRAFT order so the app can route to its status. */
  onSubmitted?: (orderId: string, orderNumber: string) => void;
  /** Called when the customer wants to change the cart. */
  onBack?: () => void;
}

type Phase = "idle" | "submitting" | "error";

const formatIDR = (value: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

function newAttemptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CheckoutPage(props: CheckoutPageProps): ReactNode {
  const { table, items, onSubmitted, onBack } = props;
  const [phase, setPhase] = useState<Phase>("idle");
  const [failure, setFailure] = useState<CheckoutError | null>(null);

  // One attempt per checkout: generated on first submit and held for every
  // retry of the same basket. Paired with a fingerprint of the cart in the
  // idempotency key, a retry collapses to the first order while a basket the
  // customer changed in between does not (API_CONTRACT.md §2.3).
  const attemptRef = useRef<string | null>(null);
  const [created, setCreated] = useState<{
    id: string;
    orderNumber: string;
    total: number;
  } | null>(null);

  const submit = useCallback(async () => {
    setPhase("submitting");
    setFailure(null);

    if (attemptRef.current === null) attemptRef.current = newAttemptId();

    // Step 1 of 2: create the DRAFT with its content-scoped key. A retry of the
    // same basket collapses to the first draft here, so the submit below is
    // handed the same order id both times (API_CONTRACT.md §2.3).
    const created = await submitDraftOrder({
      tableId: table.tableId,
      tableSessionId: table.session?.id ?? "",
      items,
      idempotencyKey: checkoutIdempotencyKey(attemptRef.current, items),
    });

    if (created.error || !created.data) {
      setFailure(created.error ?? { message: "Pesanan gagal dibuat." });
      setPhase("error");
      return;
    }

    // Step 2 of 2: send it to the kitchen. Stopping at step 1 would leave the
    // order invisible to the cashier queue, which filters on
    // PENDING_CONFIRMATION (API_CONTRACT.md §10.2, §12.1). The server
    // re-validates the table context and re-derives the total from the live
    // catalog, refusing a stale price rather than charging one.
    const submitted = await submitDraftOrderForConfirmation({
      orderId: created.data.order.id,
      tableId: table.tableId,
      tableSessionId: table.session?.id ?? "",
      idempotencyKey: checkoutSubmitIdempotencyKey(attemptRef.current, created.data.order.id),
    });

    if (submitted.error || !submitted.data) {
      setFailure(submitted.error ?? { message: "Pesanan gagal dikirim." });
      setPhase("error");
      return;
    }

    const order = submitted.data.order;
    setCreated({ id: order.id, orderNumber: order.orderNumber, total: order.total });
    setPhase("idle");
    onSubmitted?.(order.id, order.orderNumber);
  }, [table, items, onSubmitted]);

  if (created !== null) {
    return (
      <Card elevation="low" title="Pesanan dibuat">
        <p>
          Nomor order <strong>{created.orderNumber}</strong>
        </p>
        <p className="checkout__total">Total {formatIDR(created.total)}</p>
        <p className="checkout__hint">
          Pesanan Anda sudah masuk antrian konfirmasi kasir. Staf akan
          mengonfirmasinya sebentar lagi.
        </p>
      </Card>
    );
  }

  const sessionClosed = table.session === null || table.session.status !== "OPEN";

  return (
    <div className="checkout">
      <Card
        elevation="low"
        title={`Checkout — Meja ${table.tableCode}`}
        description={table.restaurantName ?? undefined}
      >
        <ul className="checkout__items">
          {items.map((item) => (
            <li key={item.productId} className="checkout__item">
              <span className="checkout__qty">{item.quantity}×</span>
              <span className="checkout__name">{item.productId}</span>
              {item.notes ? (
                <span className="checkout__note">{item.notes}</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="checkout__price-hint">
          Harga dihitung oleh sistem saat pesanan dibuat.
        </p>
        {sessionClosed ? (
          <p className="checkout__session-closed" role="alert">
            Sesi meja belum dibuka atau sudah ditutup. Tunggu staf membuka sesi
            sebelum memesan.
          </p>
        ) : null}
      </Card>
      <div className="checkout__actions">
        <Button variant="secondary" onClick={onBack} disabled={phase === "submitting"}>
          Ubah pesanan
        </Button>
        <Button
          variant="primary"
          fullWidth
          disabled={phase === "submitting" || sessionClosed || items.length === 0}
          aria-busy={phase === "submitting"}
          onClick={submit}
        >
          {phase === "submitting" ? "Mengirim pesanan…" : "Kirim pesanan"}
        </Button>
      </div>
      {phase === "error" ? (
        <p className="checkout__error" role="alert">
          {failure?.message ?? "Pesanan gagal dikirim."}
        </p>
      ) : null}
    </div>
  );
}
