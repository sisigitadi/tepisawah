/**
 * Void Order Modal (Pembatalan Pesanan Kasir).
 *
 * Allows cashiers to cancel an active order with a mandatory cancellation
 * reason and audit log tracking.
 */

import { useState, type ReactNode } from "react";
import { Modal, Button } from "@tepisawah/ui";
import type { QueueOrder } from "../../data/terminal.js";
import { formatIDR, grandTotalOf } from "../../data/terminal.js";

export interface VoidOrderModalProps {
  open: boolean;
  order: QueueOrder | null;
  onClose: () => void;
  onConfirmVoid: (reason: string, notes?: string) => Promise<void>;
}

const VOID_REASONS = [
  "Tamu Batal / Pergi (Customer Cancelled)",
  "Salah Input Menu oleh Kasir / Pramusaji (Wrong Entry)",
  "Stok Bahan / Menu Dapur Habis (Out of Stock)",
  "Komplain Kualitas / Masakan Terlambat (Quality Complaint)",
  "Pesanan Terduplikasi / Dobel (Duplicate Order)",
  "Lainnya (Alasan Khusus)",
] as const;

export function VoidOrderModal({
  open,
  order,
  onClose,
  onConfirmVoid,
}: VoidOrderModalProps): ReactNode {
  const [reason, setReason] = useState<string>(VOID_REASONS[0]);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!order) return null;

  const handleVoid = async () => {
    if (!reason) {
      setError("Alasan pembatalan wajib dipilih.");
      return;
    }
    if (reason.includes("Lainnya") && !notes.trim()) {
      setError("Mohon berikan rincian catatan untuk alasan 'Lainnya'.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onConfirmVoid(reason, notes.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membatalkan pesanan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#b91c1c" }}>
          <span>🚫</span>
          <span>Batalkan Pesanan (Void Order)</span>
        </div>
      }
      description={`Tiket: ${order.ticket} • ${order.table} (${order.area})`}
    >
      <div style={{ padding: "0.5rem 0", color: "#1e293b" }}>
        {error && (
          <div
            style={{
              padding: "0.75rem",
              marginBottom: "1rem",
              borderRadius: "6px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            fontSize: "0.85rem",
            color: "#991b1b",
            lineHeight: 1.4,
          }}
        >
          ⚠️ <strong>Perhatian:</strong> Tindakan pembatalan (Void) ini akan membatalkan seluruh menu pada tiket order ini secara permanen. Status pesanan akan dicatat sebagai <strong>VOID</strong> di riwayat transaksi kasir dan audit log dapur.
        </div>

        {/* Detail Tagihan Singkat */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "0.75rem",
            marginBottom: "1.25rem",
            fontSize: "0.85rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>{order.items.length} Menu Dipesan</div>
            <div style={{ color: "#64748b", fontSize: "0.75rem" }}>
              {order.items.map((i) => `${i.name} (${i.qty}x)`).join(", ")}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Total Nilai:</div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#b91c1c" }}>
              {formatIDR(grandTotalOf(order))}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
            Pilih Alasan Pembatalan (Wajib):
          </label>
          <select
            className="admin-form-input"
            style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff" }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {VOID_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
            Catatan Tambahan / Keterangan:
          </label>
          <textarea
            rows={2}
            className="admin-form-input"
            style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "vertical" }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Jelaskan detail alasan pembatalan untuk arsip pembukuan..."
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Kembali
          </Button>
          <Button variant="danger" onClick={handleVoid} loading={loading}>
            Konfirmasi Batal (Void Order)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
