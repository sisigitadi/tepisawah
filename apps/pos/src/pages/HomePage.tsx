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
import {
  orderBoardStatusLabel,
  useOrderBoardChannel,
  getCurrentCashShift,
  type CashShift,
} from "@tepisawah/database";
import { TerminalChrome } from "../features/terminal/TerminalChrome.js";
import { OrderQueue, type QueueFilter } from "../features/terminal/OrderQueue.js";
import { PaymentExecution } from "../features/terminal/PaymentExecution.js";
import { ThermalSlip } from "../features/terminal/ThermalSlip.js";
import { CashDrawerModal } from "../features/shifts/CashDrawerModal.js";
import { VoidOrderModal } from "../features/terminal/VoidOrderModal.js";
import { executePrint } from "../lib/printer.js";
import {
  grandTotalOf,
  formatIDR,
  formatNumber,
  type PaymentMethod,
  type QueueOrder,
} from "../data/terminal.js";
import { loadPayQueue, loadHistoryQueue, settleOrder, voidOrder } from "../lib/orders.js";
import { getSupabaseClient } from "../lib/supabase.js";
import { useTaxSettings } from "../hooks/index.js";
import {
  LockResetIcon,
  ReceiptIcon,
  WalletIcon,
} from "@tepisawah/ui";

export interface HomePageProps {
  readonly onNavigateToConfirm?: () => void;
}

export function HomePage({ onNavigateToConfirm }: HomePageProps = {}): ReactNode {
  const { user, profile, can } = useAuth();
  useTaxSettings();
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [historyOrders, setHistoryOrders] = useState<QueueOrder[]>([]);
  const [currentShift, setCurrentShift] = useState<CashShift | null>(null);
  const [showCashDrawerModal, setShowCashDrawerModal] = useState<boolean>(false);
  const [voidTargetOrder, setVoidTargetOrder] = useState<QueueOrder | null>(null);
  const [showVoidModal, setShowVoidModal] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settling, setSettling] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [filter, setFilter] = useState<QueueFilter>("waiting");
  const [method, setMethod] = useState<PaymentMethod["id"]>("cash");
  const [tendered, setTendered] = useState<string>("");
  const [now, setNow] = useState<string>("27 Sep 2026, 11:32 WIB");
  const [reprintKey, setReprintKey] = useState<number>(0);

  const cashierId = user?.id ?? "cashier-pos";
  const cashierName = profile?.display_name || profile?.username || user?.email || "Kasir Utama";

  const refreshShift = useCallback(async () => {
    try {
      const client = getSupabaseClient();
      const res = await getCurrentCashShift(client);
      if (res.data?.active && res.data.shift) {
        setCurrentShift(res.data.shift);
      } else {
        setCurrentShift(null);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    void refreshShift();
  }, [refreshShift]);

  // Indonesian date formatting for terminal & cash drawer.
  const todayFullDate = useMemo(() => {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(new Date());
  }, []);

  const todayShortDate = useMemo(() => {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(new Date());
  }, []);

  const shiftOpenedFormatted = useMemo(() => {
    if (!currentShift) return "";
    try {
      const d = new Date(currentShift.openedAt);
      const datePart = new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(d);
      const timePart = new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(d);
      return `${datePart}, ${timePart} WIB`;
    } catch {
      return currentShift.openedAt;
    }
  }, [currentShift]);

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

  // Live: any INSERT/UPDATE on `orders` (a waiter serving is what lands an
  // order on this terminal) triggers a debounced refetch; a slow poll remains
  // as the safety net for dropped sockets (useOrderBoardChannel).
  const boardChannel = useOrderBoardChannel(getSupabaseClient(), refresh);

  // Keep a valid selection as the live queue changes underneath.
  useEffect(() => {
    const list = filter === "history" ? historyOrders : orders;
    if (list.length === 0) {
      if (selectedId !== "") setSelectedId("");
      return;
    }
    if (!list.some((order) => order.id === selectedId)) {
      setSelectedId(list[0]!.id);
    }
  }, [filter, historyOrders, orders, selectedId]);

  // Load history queue when switching to history filter
  useEffect(() => {
    if (filter === "history") {
      void loadHistoryQueue().then((res) => {
        if (res.orders) {
          setHistoryOrders(res.orders);
          if (res.orders.length > 0 && !res.orders.some((o) => o.id === selectedId)) {
            setSelectedId(res.orders[0]!.id);
          }
        }
      });
    }
  }, [filter, selectedId]);

  const activeOrders = filter === "history" ? historyOrders : orders;

  const selectedOrder: QueueOrder | undefined = useMemo(
    () => activeOrders.find((order) => order.id === selectedId),
    [activeOrders, selectedId],
  );

  // Auto-switch to platform payment for online delivery orders and auto-sync exact tender amount
  useEffect(() => {
    if (selectedOrder?.channel === "delivery") {
      setMethod("platform");
    } else if (method === "platform") {
      setMethod("cash");
    }
    if (selectedOrder) {
      setTendered(formatNumber(grandTotalOf(selectedOrder)));
    } else {
      setTendered("");
    }
  }, [selectedOrder?.id, selectedOrder?.channel]);

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const source = filter === "history" ? historyOrders : orders;
    return source.filter((order) => {
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
  }, [filter, historyOrders, orders, query]);

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
    if (method === "cash" && !currentShift) {
      setSettleError("Laci kasir belum dibuka. Wajib membuka shift kasir & menginput modal awal sebelum menerima pembayaran tunai.");
      setShowCashDrawerModal(true);
      return;
    }
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
      void refreshShift();
      void loadHistoryQueue().then((res) => {
        if (res.orders) setHistoryOrders(res.orders);
      });
    });
  }, [can, currentShift, method, refresh, refreshShift, selectedOrder, settling]);

  const handleOpenVoid = useCallback((order: QueueOrder) => {
    setVoidTargetOrder(order);
    setShowVoidModal(true);
  }, []);

  const handlePrintReceipt = useCallback((orderToPrint: QueueOrder, isReprint = false): void => {
    if (isReprint) {
      orderToPrint.isReprint = true;
      orderToPrint.reprintTime = `${new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(new Date())} WIB`;
      setReprintKey((prev) => prev + 1);
    }
    // Give browser a tick to paint the receipt DOM node before invoking print driver
    window.setTimeout(() => {
      void executePrint(orderToPrint);
    }, 60);
  }, []);

  const handleConfirmVoid = useCallback(async (reason: string, notes?: string) => {
    if (!voidTargetOrder) return;
    const res = await voidOrder(voidTargetOrder, reason, notes);
    if (res.error) {
      throw new Error(res.error.message);
    }
    void refresh();
    void refreshShift();
    void loadHistoryQueue().then((hRes) => {
      if (hRes.orders) setHistoryOrders(hRes.orders);
    });
  }, [voidTargetOrder, refresh, refreshShift]);

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
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#183a1d",
                    background: "#eef5ef",
                    border: "1px solid #cce3d0",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "6px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                  title="Tanggal Operasional Terminal"
                >
                  📅 {todayFullDate}
                </span>
                <span
                  className="pos-subbar__online"
                  style={
                    !currentShift
                      ? { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", fontWeight: 700 }
                      : { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", fontWeight: 600 }
                  }
                >
                  {currentShift ? `🟢 ${currentShift.shiftName}` : "🔴 Kasir Ditutup"}
                </span>
                <span
                  className={`live-chip live-chip--${boardChannel.status}`}
                  title="Koneksi realtime antrean pembayaran"
                >
                  {orderBoardStatusLabel(boardChannel.status)}
                </span>
                <a
                  className="pos-subbar__queue-link"
                  href="?tab=confirm"
                  onClick={(e) => {
                    if (onNavigateToConfirm) {
                      e.preventDefault();
                      onNavigateToConfirm();
                    } else {
                      try {
                        localStorage.setItem("tepisawah_staff_foh_tab", "confirm");
                      } catch {
                        // ignore
                      }
                      window.dispatchEvent(
                        new CustomEvent("tepisawah:switch-foh-tab", { detail: "confirm" }),
                      );
                    }
                  }}
                  role="button"
                  title="Buka antrean konfirmasi pesanan masuk (QR)"
                >
                  Konfirmasi Pesanan →
                </a>
              </div>
              <p className="pos-subbar__hint">
                {currentShift
                  ? `Petugas: ${currentShift.staffName} • Dibuka: ${shiftOpenedFormatted} • ${todayFullDate}`
                  : `Hari ini: ${todayFullDate} • Laci kasir belum dibuka untuk shift ini.`}
              </p>
            </div>
          </div>

          <div className="pos-subbar__metrics">
            <div
              className="pos-metric"
              title="Kas fisik yang tercatat di laci saat ini"
            >
              <WalletIcon aria-hidden="true" />
              <div className="pos-metric__text">
                <span className="pos-metric__label">Kas di Laci</span>
                <span
                  className="pos-metric__value"
                  style={!currentShift ? { color: "#b45309", fontWeight: 700 } : undefined}
                >
                  {currentShift ? formatIDR(currentShift.expectedCash) : "Belum Buka"}
                </span>
              </div>
            </div>
            <div className="pos-metric">
              <ReceiptIcon aria-hidden="true" />
              <div className="pos-metric__text">
                <span className="pos-metric__label">Antrean Hari Ini</span>
                <span className="pos-metric__value pos-metric__value--go">
                  {loaded ? `${orders.length} Antrean • ${historyOrders.length} Selesai` : "Memuat…"}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="pos-drawer"
              onClick={() => setShowCashDrawerModal(true)}
              style={
                !currentShift
                  ? {
                      background: "#b45309",
                      color: "#ffffff",
                      border: "1px solid #92400e",
                      fontWeight: 700,
                      boxShadow: "0 2px 4px rgba(180, 83, 9, 0.25)",
                    }
                  : undefined
              }
            >
              <LockResetIcon aria-hidden="true" />
              {currentShift ? "Laci Kas" : "⚠️ Buka Kasir"}
            </button>
          </div>
        </div>

        {/* Notifikasi Ringkas: Hanya Tampil Jika Kasir Belum Buka Shift (Mandatory Gate) */}
        {!currentShift && (
          <div
            className="pos-drawer-alert pos-drawer-alert--warning"
            role="alert"
            style={{
              margin: "0.5rem 1.25rem 0",
              padding: "0.55rem 0.95rem",
              borderRadius: "6px",
              background: "#fffbeb",
              border: "1px solid #f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              fontSize: "0.825rem",
            }}
          >
            <span style={{ color: "#92400e", fontWeight: 600 }}>
              ⚠️ <strong>Laci Kasir Belum Dibuka:</strong> Wajib menginput modal awal kasir sebelum melayani transaksi tunai shift ini.
            </span>
            <button
              type="button"
              onClick={() => setShowCashDrawerModal(true)}
              style={{
                padding: "0.3rem 0.85rem",
                background: "#b45309",
                color: "#ffffff",
                border: "none",
                borderRadius: "5px",
                fontWeight: 700,
                fontSize: "0.8rem",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Buka Kasir Sekarang
            </button>
          </div>
        )}

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
                {filter === "history"
                  ? "Pilih satu pesanan riwayat untuk mencetak ulang struk."
                  : loaded && orders.length === 0
                    ? "Tidak ada tagihan menunggu pembayaran. Order yang sudah disajikan muncul di sini."
                    : "Pilih salah satu order dari antrean di sebelah kiri untuk memproses pembayaran."}
              </p>
            </div>
          ) : filter !== "history" ? (
            <PaymentExecution
              order={selectedOrder}
              method={method}
              tendered={tendered}
              onMethodChange={setMethod}
              onTenderedChange={setTendered}
              onSettle={handleSettle}
              onVoid={() => selectedOrder && handleOpenVoid(selectedOrder)}
            />
          ) : (
            <div className="pos-settlement" aria-label="Pratinjau struk riwayat">
              <ThermalSlip
                key={reprintKey}
                order={selectedOrder}
                method="cash"
                tenderedNumber={grandTotalOf(selectedOrder)}
                change={0}
                onPrint={() => handlePrintReceipt(selectedOrder, true)}
              />
            </div>
          )}
        </div>
      </div>

      <CashDrawerModal
        open={showCashDrawerModal}
        onClose={() => setShowCashDrawerModal(false)}
        currentShift={currentShift}
        cashierId={cashierId}
        cashierName={cashierName}
        onShiftUpdated={() => void refreshShift()}
      />

      <VoidOrderModal
        open={showVoidModal}
        order={voidTargetOrder}
        onClose={() => setShowVoidModal(false)}
        onConfirmVoid={handleConfirmVoid}
      />
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
