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
 * When kitchen is disabled in settings, this page adapts to support:
 * 1. direct_serve: Auto-serve / mark served directly on confirm
 * 2. manual_cook_serve: Manual cooking & serving control (Mulai Masak -> Selesai & Antar)
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@tepisawah/auth";
import { PERMISSIONS } from "@tepisawah/permissions";
import { orderBoardStatusLabel, useOrderBoardChannel } from "@tepisawah/database";
import { loadOrderFlowSettings, type OrderFlowSettings } from "@tepisawah/config";
import { playOrderIncomingChime } from "@tepisawah/ui";

import {
  confirmOrder,
  confirmAndDirectServe,
  confirmAndStartCooking,
  startCookingOrder,
  markOrderReady,
  markOrderServed,
  loadActiveCookingOrders,
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
  const [flowSettings, setFlowSettings] = useState<OrderFlowSettings>(() => loadOrderFlowSettings());
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [cookingOrders, setCookingOrders] = useState<StaffOrder[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "cooking">("pending");
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");
  const [now, setNow] = useState<number>(() => Date.now());

  // Listen to order-flow settings changes from Admin
  useEffect(() => {
    const handleFlowChange = () => setFlowSettings(loadOrderFlowSettings());
    window.addEventListener("tepisawah_order_flow_updated", handleFlowChange);
    window.addEventListener("storage", handleFlowChange);
    return () => {
      window.removeEventListener("tepisawah_order_flow_updated", handleFlowChange);
      window.removeEventListener("storage", handleFlowChange);
    };
  }, []);

  const refresh = useCallback(async () => {
    const [queueResult, cookingResult] = await Promise.all([
      loadConfirmationQueue(),
      loadActiveCookingOrders(),
    ]);

    if (queueResult.error) {
      setError(queueResult.error.message);
      setPhase("error");
      return;
    }

    setError(null);
    setPhase("ready");
    setOrders(queueResult.data ?? []);
    setCookingOrders(cookingResult.data ?? []);
  }, []);

  // Live: order changes land here instantly
  const boardChannel = useOrderBoardChannel(getSupabaseClient(), refresh);

  // Keep the waiting-time badges honest without refetching.
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(clock);
  }, []);

  // Alert cashier with an audible chime when new customer orders wait for confirmation
  const prevOrdersCountRef = useRef<number>(0);
  useEffect(() => {
    if (phase === "ready" && orders.length > prevOrdersCountRef.current && prevOrdersCountRef.current > 0) {
      playOrderIncomingChime();
    }
    if (phase === "ready") {
      prevOrdersCountRef.current = orders.length;
    }
  }, [phase, orders.length]);

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
  const canServe = can(PERMISSIONS.ORDERS_SERVE) || canConfirm;
  const isKitchenActive = flowSettings.kitchenEnabled;
  const isManualCookMode = !isKitchenActive && flowSettings.kitchenBypassMode === "manual_cook_serve";

  const totalValue = useMemo(
    () => orders.reduce((sum, order) => sum + order.total, 0),
    [orders],
  );

  return (
    <div className="confirm-queue">
      <header className="confirm-queue__head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
            <h1 className="confirm-queue__title" style={{ margin: 0 }}>Konfirmasi Pesanan</h1>
            {!isKitchenActive && (
              <span className="flow-badge-kds-off">
                Mode Dapur: {flowSettings.kitchenBypassMode === "direct_serve" ? "Langsung Antar (Bypass KDS)" : "Kontrol Masak Mandiri (POS)"}
              </span>
            )}
          </div>
          <p className="confirm-queue__hint">
            {isKitchenActive
              ? "Pesanan baru menunggu keputusan kasir sebelum diteruskan ke dapur (KDS)."
              : flowSettings.kitchenBypassMode === "direct_serve"
                ? "Dapur nonaktif: Konfirmasi pesanan langsung menyelesaikan alur dan siap diantar ke tamu."
                : "Dapur nonaktif: Kasir/pramusaji dapat langsung mengontrol mulai masak dan antar hidangan."}
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

      {/* Tabs khusus jika mode masak mandiri aktif (saat dapur KDS nonaktif) */}
      {isManualCookMode && (
        <div className="confirm-queue__tab-nav">
          <button
            type="button"
            className={`confirm-queue__tab ${activeTab === "pending" ? "confirm-queue__tab--active" : ""}`}
            onClick={() => setActiveTab("pending")}
          >
            Menunggu Konfirmasi ({orders.length})
          </button>
          <button
            type="button"
            className={`confirm-queue__tab ${activeTab === "cooking" ? "confirm-queue__tab--active" : ""}`}
            onClick={() => setActiveTab("cooking")}
          >
            🍳 Sedang Dimasak / Antar ({cookingOrders.length})
          </button>
        </div>
      )}

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

      {/* Tab 1: Menunggu Konfirmasi */}
      {activeTab === "pending" && (
        phase === "loading" ? (
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
                        {/* 1. Kitchen Active (Normal KDS Mode) */}
                        {isKitchenActive && (
                          <button
                            type="button"
                            className="confirm-btn confirm-btn--confirm"
                            disabled={anyBusy || !canConfirm}
                            title={canConfirm ? undefined : "Sesi Anda tidak memegang izin orders.confirm"}
                            onClick={() => void runAction(order, confirmOrder)}
                          >
                            {isBusy ? "Memproses…" : "✓ Konfirmasi ke Dapur"}
                          </button>
                        )}

                        {/* 2. Kitchen Disabled & Direct Serve Mode */}
                        {!isKitchenActive && flowSettings.kitchenBypassMode === "direct_serve" && (
                          <>
                            <button
                              type="button"
                              className="confirm-btn confirm-btn--direct"
                              disabled={anyBusy || !canConfirm}
                              title="Konfirmasi dan langsung tandai pesanan siap/disajikan ke tamu"
                              onClick={() => void runAction(order, confirmAndDirectServe)}
                            >
                              {isBusy ? "Memproses…" : "✓ Konfirmasi & Langsung Antar"}
                            </button>
                            <button
                              type="button"
                              className="confirm-btn confirm-btn--outline"
                              disabled={anyBusy || !canConfirm}
                              title="Konfirmasi saja tanpa langsung disajikan"
                              onClick={() => void runAction(order, confirmOrder)}
                            >
                              Konfirmasi Saja
                            </button>
                          </>
                        )}

                        {/* 3. Kitchen Disabled & Manual Cook/Serve Mode */}
                        {!isKitchenActive && flowSettings.kitchenBypassMode === "manual_cook_serve" && (
                          <>
                            <button
                              type="button"
                              className="confirm-btn confirm-btn--cook"
                              disabled={anyBusy || !canConfirm}
                              title="Konfirmasi dan langsung mulai proses memasak"
                              onClick={() => void runAction(order, confirmAndStartCooking)}
                            >
                              {isBusy ? "Memproses…" : "🍳 Konfirmasi & Mulai Masak"}
                            </button>
                            <button
                              type="button"
                              className="confirm-btn confirm-btn--direct"
                              disabled={anyBusy || !canConfirm}
                              title="Konfirmasi dan langsung antar ke tamu"
                              onClick={() => void runAction(order, confirmAndDirectServe)}
                            >
                              ✓ Langsung Antar
                            </button>
                          </>
                        )}

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
        )
      )}

      {/* Tab 2: Proses Masak & Antar Mandiri (Saat Dapur KDS Nonaktif) */}
      {activeTab === "cooking" && isManualCookMode && (
        cookingOrders.length === 0 ? (
          <p className="confirm-queue__empty" aria-live="polite">
            Tidak ada pesanan yang sedang dimasak atau diantar.
          </p>
        ) : (
          <div className="confirm-queue__list">
            {cookingOrders.map((order) => {
              const isBusy = busyId === order.id;
              const anyBusy = busyId !== null;
              return (
                <article key={order.id} className="confirm-card">
                  <div className="confirm-card__head">
                    <div>
                      <span className="confirm-card__number">#{order.orderNumber}</span>
                      <span
                        className="confirm-card__channel"
                        style={{
                          background:
                            order.status === "PREPARING"
                              ? "#fef3c7"
                              : order.status === "READY"
                                ? "#d1fae5"
                                : "rgba(46, 107, 52, 0.12)",
                          color:
                            order.status === "PREPARING"
                              ? "#92400e"
                              : order.status === "READY"
                                ? "#065f46"
                                : "#2e6b34",
                        }}
                      >
                        {order.status === "CONFIRMED"
                          ? "Siap Dimasak"
                          : order.status === "PREPARING"
                            ? "🔥 Sedang Dimasak"
                            : "🍽 Siap Saji"}
                      </span>
                    </div>
                    <div className="confirm-card__meta">
                      <span className="confirm-card__table">{order.tableName}</span>
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
                      </li>
                    ))}
                  </ul>

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

                    <div className="confirm-card__actions">
                      {order.status === "CONFIRMED" && (
                        <>
                          <button
                            type="button"
                            className="confirm-btn confirm-btn--cook"
                            disabled={anyBusy}
                            onClick={() => void runAction(order, startCookingOrder)}
                          >
                            {isBusy ? "Memproses…" : "🍳 Mulai Masak"}
                          </button>
                          <button
                            type="button"
                            className="confirm-btn confirm-btn--direct"
                            disabled={anyBusy || !canServe}
                            onClick={() => void runAction(order, markOrderServed)}
                          >
                            ✓ Langsung Antar ke Tamu
                          </button>
                        </>
                      )}

                      {order.status === "PREPARING" && (
                        <>
                          <button
                            type="button"
                            className="confirm-btn confirm-btn--direct"
                            disabled={anyBusy || !canServe}
                            onClick={() => void runAction(order, markOrderServed)}
                          >
                            {isBusy ? "Memproses…" : "✓ Selesai & Antar ke Tamu"}
                          </button>
                          <button
                            type="button"
                            className="confirm-btn confirm-btn--outline"
                            disabled={anyBusy}
                            onClick={() => void runAction(order, markOrderReady)}
                          >
                            🍽 Tandai Siap Saji
                          </button>
                        </>
                      )}

                      {order.status === "READY" && (
                        <button
                          type="button"
                          className="confirm-btn confirm-btn--direct"
                          disabled={anyBusy || !canServe}
                          onClick={() => void runAction(order, markOrderServed)}
                        >
                          {isBusy ? "Memproses…" : "✓ Tandai Sudah Disajikan ke Tamu"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
