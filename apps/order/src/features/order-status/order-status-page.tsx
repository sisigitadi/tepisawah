/**
 * Order status page (Phase 8B — API_CONTRACT.md §10.3).
 *
 * What a customer sees when they check on the order they placed. The page holds
 * no authorization and no price logic: it resolves the order through
 * `get_customer_order()`, which re-validates the table + OPEN session context
 * against the order's own, and every number below is the server's frozen
 * snapshot value — the receipt of record, never recomputed in the browser
 * (DATABASE_SCHEMA.md §21-§22, API_CONTRACT.md §27).
 *
 * A failure here is surfaced as "not found" without distinguishing the reasons,
 * because the server deliberately does not distinguish them either: an unknown
 * order, another table's order, a closed session and an archived table all
 * resolve to the same nothing, so the customer learns nothing about orders that
 * are not theirs (AUTH_RBAC_RLS.md §30).
 */
import { Button, Card } from "@tepisawah/ui";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

import type { CustomerOrder, CustomerOrderItem, OrderStatus, PublicTableResolve } from "@tepisawah/database";
import {
  fetchCustomerOrder,
  isOrderInProgress,
  isOrderSettled,
  labelForOrderStatus,
} from "./service.js";
import type { OrderStatusError } from "./service.js";

export interface OrderStatusPageProps {
  /** The table context the QR resolved; it authorizes the read server-side. */
  table: PublicTableResolve;
  /** The order to show, as handed over by checkout or restored from storage. */
  orderId: string;
  /** Called when the customer wants to leave the status screen. */
  onBack?: () => void;
}

type Phase = "loading" | "ready" | "error";

const formatIDR = (value: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

function modifiersFor(order: CustomerOrder, item: CustomerOrderItem): string {
  const names = order.modifiers
    .filter((modifier) => modifier.orderItemId === item.id)
    .map((modifier) => modifier.modifierNameSnapshot);
  return names.join(", ");
}

function statusClassName(status: OrderStatus): string {
  if (isOrderInProgress(status)) return "order-status__state--progress";
  if (isOrderSettled(status)) return "order-status__state--settled";
  return "order-status__state--idle";
}

export function OrderStatusPage(props: OrderStatusPageProps): ReactNode {
  const { table, orderId, onBack } = props;
  const [phase, setPhase] = useState<Phase>("loading");
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [failure, setFailure] = useState<OrderStatusError | null>(null);

  const load = useCallback(async () => {
    setPhase("loading");
    setFailure(null);

    // The table context travels with the order id — it is the credential for
    // an anonymous read, so the request is never made without it
    // (AUTH_RBAC_RLS.md §18, §30).
    const result = await fetchCustomerOrder({
      orderId,
      tableId: table.tableId,
      tableSessionId: table.session?.id ?? "",
    });

    setOrder(result.data);
    setFailure(result.error);
    setPhase(result.error === null ? "ready" : "error");
  }, [orderId, table]);

  useEffect(() => {
    void load();
  }, [load]);

  if (phase === "loading") {
    return <p aria-live="polite">Memuat pesanan…</p>;
  }

  if (phase === "error" || order === null) {
    return (
      <Card elevation="low" title="Pesanan tidak ditemukan">
        <p role="alert">
          {failure?.message ??
            "Pesanan tidak dapat ditemukan untuk meja ini."}
        </p>
        <p className="order-status__hint">
          Pastikan Anda memindai QR meja tempat Anda memesan. Jika masalah
          berlanjut, minta staf memeriksa pesanan Anda.
        </p>
        {onBack ? (
          <Button variant="secondary" onClick={onBack}>
            Kembali
          </Button>
        ) : null}
      </Card>
    );
  }

  return (
    <div className="order-status">
      <Card
        elevation="low"
        title={`Pesanan ${order.orderNumber}`}
        description={table.restaurantName ?? undefined}
      >
        <p className={`order-status__state ${statusClassName(order.status)}`}>
          <strong>{labelForOrderStatus(order.status)}</strong>
        </p>
        {isOrderInProgress(order.status) ? (
          <p className="order-status__progress-hint">
            Pesanan Anda sedang diproses. Staf akan mengonfirmasinya sebentar
            lagi.
          </p>
        ) : null}
        {order.notes ? (
          <p className="order-status__note">Catatan: {order.notes}</p>
        ) : null}
        <ul className="order-status__items">
          {order.items.map((item) => (
            <li key={item.id} className="order-status__item">
              <span className="order-status__qty">{item.quantity}×</span>
              <span className="order-status__name">
                {item.productNameSnapshot}
              </span>
              {modifiersFor(order, item) ? (
                <span className="order-status__modifiers">
                  {modifiersFor(order, item)}
                </span>
              ) : null}
              {item.notes ? (
                <span className="order-status__item-note">{item.notes}</span>
              ) : null}
              <span className="order-status__line-total">
                {formatIDR(item.lineTotal)}
              </span>
            </li>
          ))}
        </ul>
        <p className="order-status__total">
          Total <strong>{formatIDR(order.total)}</strong>
        </p>
      </Card>
      <div className="order-status__actions">
        <Button variant="secondary" onClick={load}>
          Periksa status
        </Button>
        {onBack ? (
          <Button variant="secondary" onClick={onBack}>
            Kembali ke meja
          </Button>
        ) : null}
      </div>
    </div>
  );
}
