/**
 * @tepisawah/pos — Home page (Cashier Payment Terminal).
 *
 * Ported from the Stitch reference
 * (docs/design/references/stitch/pos_terminal_payment_center): a three-panel
 * enterprise terminal — payment queue, bill inspector, and settlement
 * execution with cash tender / QRIS workspaces and a thermal 80mm slip dock.
 *
 * The queue is LIVE: it lists every SERVED order from the database through the
 * `orders_staff_read` RLS policy (migration 008 part 1) — food is with the
 * guest, money is not — and settles each through the guarded
 * `transition_order()` command (`payments.create`, optimistic version,
 * API_CONTRACT.md §13, §26). The bill panel shows the server's own frozen
 * totals, never a browser re-derivation.
 *
 * Workflow: pilih order dari antrean → periksa rincian tagihan → pilih metode
 * bayar → tender uang / scan QRIS → bayar & cetak struk.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@tepisawah/auth";
import { PERMISSIONS } from "@tepisawah/permissions";
import { TerminalChrome } from "../features/terminal/TerminalChrome.js";
import { OrderQueue, type QueueFilter } from "../features/terminal/OrderQueue.js";
import { BillInspector } from "../features/terminal/BillInspector.js";
import { PaymentExecution } from "../features/terminal/PaymentExecution.js";
import {
  grandTotalOf,
  type PaymentMethod,
  type QueueOrder,
} from "../data/terminal.js";
import { loadPayQueue, settleOrder } from "../lib/orders.js";
import {
  LockResetIcon,
  ReceiptIcon,
  WalletIcon,
} from "@tepisawah/ui";

const POLL_INTERVAL_MS = 15_000;

export function HomePage(): ReactNode {
  const { can } = useAuth();
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settling, setSettling] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [filter, setFilter] = useState<QueueFilter>("waiting");
  const [method, setMethod] = useState<PaymentMethod["id"]>("cash");
  const [tendered, setTendered] = useState<string>("300.000");
  const [now, setNow] = useState<string>("27 Sep 2026, 11:32 WIB");

  // Live WIB clock for the terminal header.
  useEffect(() => {
    const tick = (): void => {
      const formatter = new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      });
      setNow(`${formatter.format(new Date())} WIB`);
    };
    tick();
    const interval = window.setInterval(tick, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const refresh = useCallback(async () => {
    const result = await loadPayQueue();
    setLoaded(true);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    setError(null);
    setOrders(result.orders);
  }, []);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(poll);
  }, [refresh]);

  // Keep a valid selection as the live queue changes underneath.
  useEffect(() => {
    if (orders.length === 0) {
      if (selectedId !== "") setSelectedId("");
      return;
    }
    if (!orders.some((order) => order.id === selectedId)) {
      setSelectedId(orders[0]!.id);
    }
  }, [orders, selectedId]);

  const selectedOrder: QueueOrder | undefined = useMemo(
    () => orders.find((order) => order.id === selectedId),
    [orders, selectedId],
  );

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (filter === "waiting" && order.status !== "waiting") return false;
      if (filter === "process" && order.status !== "process") return false;
      if (!needle) return true;
      return (
        order.id.toLowerCase().includes(needle) ||
        order.table.toLowerCase().includes(needle) ||
        order.ticket.toLowerCase().includes(needle) ||
        order.area.toLowerCase().includes(needle)
      );
    });
  }, [filter, orders, query]);

  const unpaidTotal = useMemo(
    () => orders.reduce((sum, order) => sum + grandTotalOf(order), 0),
    [orders],
  );

  /**
   * One guarded server-side hop: SERVED -> PAID. The command re-checks
   * `payments.create` and the version the terminal rendered (§26); the queue
   * refetches afterwards so the board reflects the database, not a guess.
   */
  const handleSettle = useCallback((): void => {
    const order = selectedOrder;
    if (order === undefined || settling) return;
    if (!can(PERMISSIONS.PAYMENTS_CREATE)) {
      setSettleError("Sesi Anda tidak memiliki izin pembayaran (payments.create).");
      return;
    }
    setSettling(true);
    setSettleError(null);
    void settleOrder(order).then((result) => {
      setSettling(false);
      if (result.error || result.data === null) {
        setSettleError(result.error?.message ?? "Pembayaran gagal diproses.");
        void refresh();
        return;
      }
      void refresh();
    });
  }, [can, refresh, selectedOrder, settling]);

  // Enterprise POS shortcuts: F1 search, F3 settle, ESC cancel tender.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "F1") {
        event.preventDefault();
        document.getElementById("orderSearchInput")?.focus();
      } else if (event.key === "F3") {
        event.preventDefault();
        document.getElementById("btnPayFinal")?.click();
      } else if (event.key === "Escape") {
        setTendered("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <TerminalChrome now={now}>
      <div className="pos-shell">
        <div className="pos-subbar">
          <div className="pos-subbar__identity">
            <div className="pos-subbar__icon" aria-hidden="true">
              <TerminalGlyph />
            </div>
            <div>
              <div className="pos-subbar__title-row">
                <span className="pos-subbar__title">Kasir Utama #01</span>
                <span className="pos-subbar__online">Terminal Online</span>
              </div>
              <p className="pos-subbar__hint">
                Lobi Utama Ciperna • Shift Pagi (07:00 - 15:30) • Sinkronisasi EDC &amp; QRIS Siap
              </p>
            </div>
          </div>

          <div className="pos-subbar__metrics">
            <div className="pos-metric">
              <WalletIcon aria-hidden="true" />
              <div className="pos-metric__text">
                <span className="pos-metric__label">Kas Laci Sekarang</span>
                <span className="pos-metric__value">Rp 2.450.000</span>
              </div>
            </div>
            <div className="pos-metric">
              <ReceiptIcon aria-hidden="true" />
              <div className="pos-metric__text">
                <span className="pos-metric__label">Selesai Hari Ini</span>
                <span className="pos-metric__value pos-metric__value--go">
                  {loaded ? `${orders.length} Tagihan Tertunda` : "Memuat…"}
                </span>
              </div>
            </div>
            <button type="button" className="pos-drawer">
              <LockResetIcon aria-hidden="true" /> Laci Kas
            </button>
          </div>
        </div>

        {error !== null ? (
          <p className="pos-alert" role="alert">
            Antrean tidak dapat dimuat: {error}
            <button type="button" className="pos-alert__retry" onClick={() => void refresh()}>
              Coba lagi
            </button>
          </p>
        ) : null}
        {settleError !== null ? (
          <p className="pos-alert" role="alert">
            {settleError}
          </p>
        ) : null}

        <div className="pos-grid">
          <OrderQueue
            orders={filteredOrders}
            selectedId={selectedId}
            query={query}
            filter={filter}
            unpaidTotal={unpaidTotal}
            onSelect={setSelectedId}
            onQueryChange={setQuery}
            onFilterChange={setFilter}
          />

          {selectedOrder === undefined ? (
            <div className="pos-empty-bill">
              <p>
                {loaded && orders.length === 0
                  ? "Tidak ada tagihan menunggu pembayaran. Order yang sudah disajikan muncul di sini."
                  : "Pilih satu order dari antrean untuk memeriksa tagihan."}
              </p>
            </div>
          ) : (
            <>
              <BillInspector order={selectedOrder} onPrint={() => undefined} />

              <PaymentExecution
                order={selectedOrder}
                method={method}
                tendered={tendered}
                onMethodChange={setMethod}
                onTenderedChange={setTendered}
                onSettle={handleSettle}
              />
            </>
          )}
        </div>
      </div>
    </TerminalChrome>
  );
}

function TerminalGlyph(): ReactNode {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01" />
    </svg>
  );
}
