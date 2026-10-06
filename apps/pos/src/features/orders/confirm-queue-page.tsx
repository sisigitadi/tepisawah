/**
 * @tepisawah/pos — confirmation queue page.
 *
 * What the cashier acts on between "customer sent it" and "kitchen sees it":
 * every PENDING_CONFIRMATION order, reviewed and either confirmed into the
 * kitchen pipeline or rejected with a stated reason. Both commands are the
 * guarded `transition_order()` call — the permission (`orders.confirm` /
 * `orders.reject`) is re-checked server-side, so these buttons are UX, not
 * security (AUTH_RBAC_RLS.md §2.2).
 *
 * Opened with the `?confirm` search param (no router library yet — the same
 * pattern the waiter app uses for manual order entry).
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@tepisawah/auth";
import { PERMISSIONS } from "@tepisawah/permissions";
import { orderBoardStatusLabel, useOrderBoardChannel } from "@tepisawah/database";

import {
  confirmOrder,
  loadConfirmationQueue,
  rejectOrder,
  type StaffOrder,
} from "./service.js";
import { getSupabaseClient } from "../../lib/supabase.js";

type Phase = "loading" | "ready" | "error";

/** Minutes since the order started waiting for a decision. */
function waitingMinutes(iso: string | null, now: number): number {
  if (iso === null) return 0;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((now - then) / 60_000));
}

function timeLabel(iso: string | null): string {
  if (iso === null) return "—";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "—";
  return `${new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(then))} WIB`;
}

const CHANNEL_LABELS: Record<StaffOrder["source"], string> = {
  CUSTOMER_QR: "QR Meja",
  WAITER: "Pelayan",
  POS: "Kasir",
};

export function ConfirmQueuePage(): ReactNode {
  const { can } = useAuth();
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");
  const [now, setNow] = useState<number>(() => Date.now());

  const refresh = useCallback(async () => {
    const result = await loadConfirmationQueue();
    if (result.error) {
      setError(result.error.message);
      setPhase("error");
      return;
    }
    setError(null);
    setPhase("ready");
    setOrders(result.data ?? []);
  }, []);

  // Live: a customer or waiter submitting lands here instantly (INSERT on
  // `orders`); a slow poll remains as the safety net (useOrderBoardChannel).
  const boardChannel = useOrderBoardChannel(getSupabaseClient(), refresh);

  // Keep the waiting-time badges honest without refetching.
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(clock);
  }, []);

  /** One guarded server-side hop; the queue refetches to match the database. */
  const runAction = useCallback(
    async (
      order: StaffOrder,
      action: (target: StaffOrder) => Promise<{ error: { message: string } | null }>,
    ) => {
      if (busyId !== null) return;
      setBusyId(order.id);
      setActionError(null);
      const result = await action(order);
      setBusyId(null);
      if (result.error) {
        setActionError(result.error.message);
        void refresh();
        return;
      }
      void refresh();
    },
    [busyId, refresh],
  );

  const canConfirm = can(PERMISSIONS.ORDERS_CONFIRM);
  const canReject = can(PERMISSIONS.ORDERS_REJECT);
  const totalValue = useMemo(
    () => orders.reduce((sum, order) => sum + order.total, 0),
    [orders],
  );

  return (
    <div className="confirm-queue">
      <header className="confirm-queue__head">
        <div>
          <h1 className="confirm-queue__title">Konfirmasi Pesanan</h1>
          <p className="confirm-queue__hint">
            Pesanan baru menunggu keputusan kasir sebelum masuk dapur.
          </p>
        </div>
        <div className="confirm-queue__summary">
          <span className="confirm-queue__count">
            {orders.length} menunggu konfirmasi
          </span>
          <span className="confirm-queue__value">
            {new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: "IDR",
              maximumFractionDigits: 0,
            }).format(totalValue)}
          </span>
          <span
            className={`live-chip live-chip--${boardChannel.status}`}
            title="Koneksi realtime antrean konfirmasi"
          >
            {orderBoardStatusLabel(boardChannel.status)}
          </span>
        </div>
      </header>

      {error !== null ? (
        <div className="confirm-queue__alert" role="alert">
          <span>Antrean tidak dapat dimuat: {error}</span>
          <button type="button" className="confirm-queue__retry" onClick={() => void refresh()}>
            Coba lagi
          </button>
        </div>
      ) : null}
      {actionError !== null ? (
        <div className="confirm-queue__alert" role="alert">
          {actionError}
        </div>
      ) : null}

      {phase === "loading" ? (
        <p aria-live="polite">Memuat antrean…</p>
      ) : phase === "ready" && orders.length === 0 ? (
        <p className="confirm-queue__empty" aria-live="polite">
          Tidak ada pesanan yang menunggu konfirmasi. Pesanan baru muncul
          otomatis begitu tamu atau waiter mengirimkannya.
        </p>
      ) : (
        <div className="confirm-queue__list">
          {orders.map((order) => {
            const waiting = waitingMinutes(order.createdAt, now);
            const isBusy = busyId === order.id;
            const isRejecting = rejectingId === order.id;
            const anyBusy = busyId !== null;
            return (
              <article
                key={order.id}
                className={`confirm-card ${waiting >= 5 ? "confirm-card--stale" : ""}`}
              >
                <div className="confirm-card__head">
                  <div>
                    <span className="confirm-card__number">#{order.orderNumber}</span>
                    <span className="confirm-card__channel">
                      {CHANNEL_LABELS[order.source] ?? order.source}
                    </span>
                  </div>
                  <div className="confirm-card__meta">
                    <span className="confirm-card__table">{order.tableName}</span>
                    <time className={`confirm-card__waiting ${waiting >= 5 ? "is-stale" : ""}`}>
                      ⏱ {waiting}m menunggu
                    </time>
                    <span className="confirm-card__time">{timeLabel(order.createdAt)}</span>
                  </div>
                </div>

                <ul className="confirm-card__items">
                  {order.items.map((item) => (
                    <li key={item.id} className="confirm-card__item">
                      <span className="confirm-card__qty">{item.quantity}×</span>
                      <span className="confirm-card__name">{item.name}</span>
                      {item.notes ? (
                        <span className="confirm-card__note">Catatan: {item.notes}</span>
                      ) : null}
                      <span className="confirm-card__line">
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        }).format(item.lineTotal)}
                      </span>
                    </li>
                  ))}
                </ul>

                {order.notes ? (
                  <p className="confirm-card__customer-note">
                    Catatan tamu: {order.notes}
                  </p>
                ) : null}

                <div className="confirm-card__foot">
                  <span className="confirm-card__total">
                    Total:{" "}
                    <strong>
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      }).format(order.total)}
                    </strong>
                  </span>

                  {isRejecting ? (
                    <div className="confirm-card__reject-box">
                      <input
                        type="text"
                        className="confirm-card__reason"
                        placeholder="Alasan penolakan (mis. stok habis)"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        maxLength={200}
                      />
                      <button
                        type="button"
                        className="confirm-btn confirm-btn--reject"
                        disabled={anyBusy || reason.trim().length === 0}
                        onClick={() => {
                          const target = orders.find((o) => o.id === order.id);
                          if (target === undefined) return;
                          void runAction(target, (o) => rejectOrder(o, reason.trim())).then(
                            () => {
                              setRejectingId(null);
                              setReason("");
                            },
                          );
                        }}
                      >
                        {isBusy ? "Memproses…" : "Tolak pesanan"}
                      </button>
                      <button
                        type="button"
                        className="confirm-btn confirm-btn--ghost"
                        disabled={anyBusy}
                        onClick={() => {
                          setRejectingId(null);
                          setReason("");
                        }}
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <div className="confirm-card__actions">
                      <button
                        type="button"
                        className="confirm-btn confirm-btn--confirm"
                        disabled={anyBusy || !canConfirm}
                        title={
                          canConfirm
                            ? undefined
                            : "Sesi Anda tidak memegang izin orders.confirm"
                        }
                        onClick={() => void runAction(order, confirmOrder)}
                      >
                        {isBusy ? "Memproses…" : "✓ Konfirmasi"}
                      </button>
                      <button
                        type="button"
                        className="confirm-btn confirm-btn--reject-soft"
                        disabled={anyBusy || !canReject}
                        title={
                          canReject
                            ? undefined
                            : "Sesi Anda tidak memegang izin orders.reject"
                        }
                        onClick={() => {
                          setReason("");
                          setRejectingId(order.id);
                        }}
                      >
                        ✕ Tolak
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
