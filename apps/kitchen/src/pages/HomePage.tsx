/**
 * @tepisawah/kitchen — Home page (Kitchen Display System / KDS).
 *
 * Designed in compliance with docs/design/MASTER_DESIGN_SYSTEM.md §16:
 * - Speed, high visibility and readable from working distances
 * - Order ID, Table, Elapsed Time, Items, Quantity, Notes, Direct Action
 * - Transition flow: CONFIRMED -> PREPARING -> READY
 * - Zero financial details displayed
 */
import { useState, type ReactNode } from "react";

interface KitchenItem {
  name: string;
  qty: number;
  notes?: string;
  isCustom?: boolean;
}

interface KitchenTicket {
  id: string;
  orderNumber: string;
  table: string;
  area: string;
  elapsedMinutes: number;
  status: "CONFIRMED" | "PREPARING" | "READY";
  items: KitchenItem[];
  urgent?: boolean;
}

const INITIAL_TICKETS: KitchenTicket[] = [
  {
    id: "k-1",
    orderNumber: "#ORD-001",
    table: "Meja 01",
    area: "Saung A",
    elapsedMinutes: 18,
    status: "PREPARING",
    urgent: true,
    items: [
      { name: "Gurame Bakar Madu", qty: 1, notes: "Pedas sedang, lalap leunca ekstra" },
      { name: "Nasi Liwet Sawah Komplit", qty: 2, notes: "Hangat" },
      { name: "Karedok Leunca Segar", qty: 1, notes: "Tanpa terasi" },
    ],
  },
  {
    id: "k-2",
    orderNumber: "#ORD-002",
    table: "Meja 04",
    area: "Gazebo B",
    elapsedMinutes: 8,
    status: "CONFIRMED",
    items: [
      { name: "Ayam Goreng Lengkuas", qty: 2, notes: "Serundeng melimpah" },
      { name: "Sayur Asem Klaten", qty: 2 },
      { name: "Tahu & Tempe Mendoan", qty: 1, notes: "Goreng garing" },
      { name: "Sambal Terasi Dadak", qty: 2, notes: "Pedas level 3" },
    ],
  },
  {
    id: "k-3",
    orderNumber: "#ORD-003",
    table: "Meja 07",
    area: "Lesehan C",
    elapsedMinutes: 3,
    status: "CONFIRMED",
    items: [
      { name: "Sop Buntut Garang Asam", qty: 1, notes: "Kuah pisah" },
      { name: "Nasi Bakar Teri Wangi", qty: 1 },
      { name: "Es Kelapa Jeruk Segar", qty: 2 },
    ],
  },
  {
    id: "k-4",
    orderNumber: "#ORD-004",
    table: "Meja 02",
    area: "Saung A",
    elapsedMinutes: 24,
    status: "READY",
    items: [
      { name: "Pepes Ikan Mas Duri Lunak", qty: 1, notes: "Kemangi banyak" },
      { name: "Bakwan Jagung Renyah", qty: 1 },
    ],
  },
];

export function HomePage(): ReactNode {
  const [tickets, setTickets] = useState<KitchenTicket[]>(INITIAL_TICKETS);
  const [filter, setFilter] = useState<string>("ALL");

  const handleAdvanceStatus = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        if (t.status === "CONFIRMED") return { ...t, status: "PREPARING" };
        if (t.status === "PREPARING") return { ...t, status: "READY" };
        return t;
      })
    );
  };

  const filteredTickets = filter === "ALL"
    ? tickets
    : tickets.filter((t) => t.status === filter);

  const preparingCount = tickets.filter(t => t.status === "PREPARING").length;
  const confirmedCount = tickets.filter(t => t.status === "CONFIRMED").length;
  const readyCount = tickets.filter(t => t.status === "READY").length;

  return (
    <div className="kds-screen">
      {/* KDS Header Bar */}
      <header className="kds-header">
        <div className="kds-brand">
          <span className="kds-title">KITCHEN DISPLAY SYSTEM</span>
          <span className="kds-station">Stasiun: Hot Kitchen & Bakaran</span>
        </div>
        <div className="kds-stats">
          <button
            type="button"
            className={`kds-stat-btn ${filter === "ALL" ? "active" : ""}`}
            onClick={() => setFilter("ALL")}
          >
            Semua ({tickets.length})
          </button>
          <button
            type="button"
            className={`kds-stat-btn ${filter === "CONFIRMED" ? "active" : ""}`}
            onClick={() => setFilter("CONFIRMED")}
          >
            Antrian Baru ({confirmedCount})
          </button>
          <button
            type="button"
            className={`kds-stat-btn ${filter === "PREPARING" ? "active" : ""}`}
            onClick={() => setFilter("PREPARING")}
          >
            Sedang Dimasak ({preparingCount})
          </button>
          <button
            type="button"
            className={`kds-stat-btn ${filter === "READY" ? "active" : ""}`}
            onClick={() => setFilter("READY")}
          >
            Siap Saji ({readyCount})
          </button>
        </div>
      </header>

      {/* Tickets Queue Grid */}
      <main className="kds-main">
        <div className="kds-tickets-grid">
          {filteredTickets.map((ticket) => {
            const isOverdue = ticket.elapsedMinutes >= 15;
            return (
              <div
                key={ticket.id}
                className={`kds-ticket-card status-${ticket.status.toLowerCase()} ${isOverdue ? "overdue" : ""}`}
              >
                {/* Ticket Card Top */}
                <div className="ticket-header">
                  <div className="ticket-order-ref">
                    <span className="ticket-order-num">{ticket.orderNumber}</span>
                    <span className="ticket-table-name">{ticket.table}</span>
                    <span className="ticket-area-sub">{ticket.area}</span>
                  </div>
                  <div className={`ticket-timer ${isOverdue ? "timer-alert" : ""}`}>
                    ⏱ {ticket.elapsedMinutes}m
                  </div>
                </div>

                {/* Items List */}
                <div className="ticket-items-list">
                  {ticket.items.map((item, idx) => (
                    <div key={idx} className="ticket-item-row">
                      <div className="item-qty-badge">{item.qty}x</div>
                      <div className="item-detail">
                        <div className="item-title">{item.name}</div>
                        {item.notes ? (
                          <div className="item-instruction">Catatan: {item.notes}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Status Button */}
                <div className="ticket-footer">
                  {ticket.status === "CONFIRMED" && (
                    <button
                      type="button"
                      className="kds-btn-action btn-start"
                      onClick={() => handleAdvanceStatus(ticket.id)}
                    >
                      ▶ Mulai Memasak
                    </button>
                  )}
                  {ticket.status === "PREPARING" && (
                    <button
                      type="button"
                      className="kds-btn-action btn-ready"
                      onClick={() => handleAdvanceStatus(ticket.id)}
                    >
                      ✓ Selesai / Siap Diantar
                    </button>
                  )}
                  {ticket.status === "READY" && (
                    <div className="ticket-ready-notice">
                      ✓ Menunggu Waiter Ambil
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
