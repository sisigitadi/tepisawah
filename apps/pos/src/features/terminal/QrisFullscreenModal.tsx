/**
 * Customer-Facing Fullscreen QRIS Modal.
 *
 * Displays a large, high-contrast QRIS code on the POS screen
 * for customers to scan from across the cashier counter.
 */

import type { ReactNode } from "react";
import { Modal, Button } from "@tepisawah/ui";
import type { QueueOrder } from "../../data/terminal.js";
import { formatIDR, grandTotalOf } from "../../data/terminal.js";

export interface QrisFullscreenModalProps {
  open: boolean;
  onClose: () => void;
  order: QueueOrder | null;
  qrisImageUrl?: string;
  qrisPayload?: string;
}

export function QrisFullscreenModal({
  open,
  onClose,
  order,
  qrisImageUrl,
  qrisPayload,
}: QrisFullscreenModalProps): ReactNode {
  if (!order) return null;

  const total = grandTotalOf(order);

  // Jika tidak ada gambar QRIS statis tetapi ada string payload QRIS, buat kode QR dinamis
  const dynamicQrUrl =
    !qrisImageUrl && qrisPayload
      ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrisPayload)}`
      : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div style={{ textAlign: "center", width: "100%", fontSize: "1.1rem" }}>
          TEPI SAWAH RESTO &amp; CAFE
        </div>
      }
      description={
        <div style={{ textAlign: "center", width: "100%", fontSize: "0.85rem" }}>
          Scan QRIS menggunakan BCA Mobile, GoPay, OVO, Dana, ShopeePay, atau Bank Lainnya
        </div>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem 0",
        }}
      >
        {/* QR Code Container */}
        <div
          style={{
            background: "#ffffff",
            padding: "1.25rem",
            borderRadius: "16px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
            border: "2px solid #059669",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            maxWidth: "340px",
            width: "100%",
          }}
        >
          {qrisImageUrl ? (
            <img
              src={qrisImageUrl}
              alt="QRIS Pembayaran Tepi Sawah"
              style={{
                width: "280px",
                height: "280px",
                objectFit: "contain",
                borderRadius: "8px",
              }}
            />
          ) : dynamicQrUrl ? (
            <img
              src={dynamicQrUrl}
              alt="QRIS Pembayaran Tepi Sawah"
              style={{
                width: "280px",
                height: "280px",
                objectFit: "contain",
                borderRadius: "8px",
              }}
            />
          ) : (
            <div
              style={{
                width: "240px",
                height: "240px",
                background: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "8px",
                border: "2px dashed #cbd5e1",
              }}
            >
              <svg
                width="160"
                height="160"
                viewBox="0 0 100 100"
                fill="#183A1D"
                aria-hidden="true"
              >
                <path d="M5,5 h30 v30 h-30 z M10,10 v20 h20 v-20 z M15,15 h10 v10 h-10 z" />
                <path d="M65,5 h30 v30 h-30 z M70,10 v20 h20 v-20 z M75,15 h10 v10 h-10 z" />
                <path d="M5,65 h30 v30 h-30 z M10,70 v20 h20 v-20 z M15,75 h10 v10 h-10 z" />
                <rect x="45" y="10" width="10" height="20" />
                <rect x="10" y="45" width="20" height="10" />
                <rect x="45" y="45" width="10" height="10" />
                <rect x="65" y="45" width="25" height="10" />
                <rect x="45" y="65" width="10" height="25" />
                <rect x="65" y="65" width="10" height="10" />
                <rect x="80" y="80" width="10" height="10" />
              </svg>
              <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "8px" }}>
                Standar QRIS Nasional (NMID: ID1020261947264)
              </span>
            </div>
          )}

          <div
            style={{
              marginTop: "1rem",
              textAlign: "center",
              width: "100%",
              borderTop: "1px solid #e2e8f0",
              paddingTop: "0.75rem",
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>TOTAL TAGIHAN</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#166534" }}>
              {formatIDR(total)}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#334155", marginTop: "4px" }}>
              Tiket: {order.ticket} • {order.table}
            </div>
          </div>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <Button variant="secondary" onClick={onClose}>
            Tutup Layar QRIS (ESC)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
