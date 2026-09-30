/**
 * @tepisawah/pos — Home page (Cashier Payment Terminal).
 *
 * Ported from the Stitch reference
 * (docs/design/references/stitch/pos_terminal_payment_center): a three-panel
 * enterprise terminal — payment queue, bill inspector, and settlement
 * execution with cash tender / QRIS workspaces and a thermal 80mm slip dock.
 *
 * Workflow: pilih order dari antrean → periksa rincian tagihan → pilih metode
 * bayar → tender uang / scan QRIS → bayar & cetak struk.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TerminalChrome } from "../features/terminal/TerminalChrome.js";
import { OrderQueue, type QueueFilter } from "../features/terminal/OrderQueue.js";
import { BillInspector } from "../features/terminal/BillInspector.js";
import { PaymentExecution } from "../features/terminal/PaymentExecution.js";
import {
  QUEUE_ORDERS,
  grandTotalOf,
  type PaymentMethod,
  type QueueOrder,
} from "../data/terminal.js";
import {
  LockResetIcon,
  ReceiptIcon,
  WalletIcon,
} from "@tepisawah/ui";

export function HomePage(): ReactNode {
  const [selectedId, setSelectedId] = useState<string>(QUEUE_ORDERS[0]!.id);
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

  const selectedOrder: QueueOrder = useMemo(
    () => QUEUE_ORDERS.find((order) => order.id === selectedId) ?? QUEUE_ORDERS[0]!,
    [selectedId],
  );

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return QUEUE_ORDERS.filter((order) => {
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
  }, [filter, query]);

  const unpaidTotal = useMemo(
    () => QUEUE_ORDERS.reduce((sum, order) => sum + grandTotalOf(order), 0),
    [],
  );

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
                <span className="pos-metric__value pos-metric__value--go">48 Transaksi</span>
              </div>
            </div>
            <button type="button" className="pos-drawer">
              <LockResetIcon aria-hidden="true" /> Laci Kas
            </button>
          </div>
        </div>

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

          <BillInspector order={selectedOrder} onPrint={() => undefined} />

          <PaymentExecution
            order={selectedOrder}
            method={method}
            tendered={tendered}
            onMethodChange={setMethod}
            onTenderedChange={setTendered}
            onSettle={() => undefined}
          />
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
