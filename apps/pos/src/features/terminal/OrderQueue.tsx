/**
 * @tepisawah/pos — payment queue panel.
 *
 * Search (F1), filter tabs (Menunggu / Proses / Semua) and the real-time
 * cashier queue of order cards. Each card exposes ticket id, channel badge,
 * table, area, item count and bill total, mirroring the Stitch POS reference.
 */

import type { ReactNode } from "react";
import { InsightsIcon, KitchenIcon, PhoneIcon, SearchIcon, UserIcon } from "@tepisawah/ui";
import type { QueueOrder } from "../../data/terminal.js";
import { formatIDR } from "../../data/terminal.js";

export type QueueFilter = "waiting" | "process" | "all";

interface OrderQueueProps {
  orders: QueueOrder[];
  selectedId: string;
  query: string;
  filter: QueueFilter;
  unpaidTotal: number;
  onSelect: (id: string) => void;
  onQueryChange: (value: string) => void;
  onFilterChange: (filter: QueueFilter) => void;
}

const FILTER_TABS: { id: QueueFilter; label: string }[] = [
  { id: "waiting", label: "Menunggu" },
  { id: "process", label: "Proses" },
  { id: "all", label: "Semua" },
];

export function OrderQueue({
  orders,
  selectedId,
  query,
  filter,
  unpaidTotal,
  onSelect,
  onQueryChange,
  onFilterChange,
}: OrderQueueProps): ReactNode {
  const counts = {
    waiting: orders.filter((o) => o.status === "waiting").length,
    process: orders.filter((o) => o.status === "process").length,
    all: orders.length,
  };

  return (
    <section className="pos-queue" aria-label="Antrean pembayaran kasir">
      <div className="pos-search">
        <span className="pos-search__icon" aria-hidden="true"><SearchIcon /></span>
        <input
          id="orderSearchInput"
          type="text"
          className="pos-search__input"
          placeholder="F1 Cari order, meja, no bill..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <span className="pos-search__kbd" aria-hidden="true"><kbd>F1</kbd></span>
      </div>

      <div className="pos-queue__filters">
        <div className="pos-tabs" role="tablist" aria-label="Filter antrean">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className={`pos-tab ${filter === tab.id ? "pos-tab--active" : ""}`}
              onClick={() => onFilterChange(tab.id)}
            >
              {tab.label} ({counts[tab.id]})
            </button>
          ))}
        </div>
        <div className="pos-queue__caption">
          <span>Antrean Pembayaran Kasir</span>
          <span className="pos-queue__live">
            <span className="pos-queue__live-dot" aria-hidden="true" />
            Real-time
          </span>
        </div>
      </div>

      <div className="pos-queue__list">
        {orders.length === 0 ? (
          <p className="pos-queue__empty">Tidak ada order pada filter ini.</p>
        ) : (
          orders.map((order) => (
            <QueueCard
              key={order.id}
              order={order}
              selected={order.id === selectedId}
              onSelect={() => onSelect(order.id)}
            />
          ))
        )}
      </div>

      <div className="pos-queue__summary">
        <span className="pos-queue__summary-label">
          <InsightsIcon aria-hidden="true" />
          Total Unpaid:
        </span>
        <span className="pos-queue__summary-value">{formatIDR(unpaidTotal)} ({orders.length})</span>
      </div>
    </section>
  );
}

interface QueueCardProps {
  order: QueueOrder;
  selected: boolean;
  onSelect: () => void;
}

function QueueCard({ order, selected, onSelect }: QueueCardProps): ReactNode {
  const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0);
  const total = order.items.reduce((sum, item) => sum + item.qty * item.price, 0);

  return (
    <article
      className={`pos-queue-card ${selected ? "pos-queue-card--selected" : ""} ${order.status === "hold" ? "pos-queue-card--hold" : ""}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
    >
      {selected && <span className="pos-queue-card__rail" aria-hidden="true" />}

      <div className="pos-queue-card__head">
        <div className="pos-queue-card__id">
          <span className="pos-queue-card__ticket">#{order.id}</span>
          <span className={`pos-chip ${order.channel === "qr" ? "pos-chip--qr" : "pos-chip--waiter"}`}>
            {order.channel === "qr" ? "QR MEJA" : "WAITER POS"}
          </span>
        </div>
        <time className="pos-queue-card__time">{order.time}</time>
      </div>

      <div className="pos-queue-card__body">
        <div>
          <h4 className="pos-queue-card__table">{order.table}</h4>
          <p className="pos-queue-card__area">{order.area} • {order.items.length} menu</p>
        </div>
        <div className="pos-queue-card__amount">
          <span className="pos-queue-card__total">{formatIDR(total)}</span>
          {order.promo && <span className="pos-queue-card__tax-note">INC. TAX &amp; DISC</span>}
        </div>
      </div>

      <div className="pos-queue-card__foot">
        {order.status === "hold" ? (
          <>
            <span className="pos-queue-card__channel pos-queue-card__channel--hold">
              <KitchenIcon aria-hidden="true" /> Billing Hold
            </span>
            <span className="pos-status pos-status--hold">Dapur Hold</span>
          </>
        ) : (
          <>
            <span className="pos-queue-card__channel">
              {order.channel === "qr" ? <PhoneIcon aria-hidden="true" /> : <UserIcon aria-hidden="true" />}
              {order.channel === "qr" ? "Tamu Self-Scan" : `Waiter • ${order.pax} Pax`}
            </span>
            <span className={`pos-status ${order.status === "process" ? "pos-status--process" : "pos-status--waiting"}`}>
              {order.status === "process" ? "Proses" : "Waiting Bill"}
            </span>
          </>
        )}
      </div>
    </article>
  );
}

