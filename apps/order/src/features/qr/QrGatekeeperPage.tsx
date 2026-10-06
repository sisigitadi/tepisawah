/**
 * @tepisawah/order — QR Gatekeeper Page.
 *
 * Enforces that customer ordering is accessed strictly via a table QR code.
 * If a customer visits order.tepisawah.id directly without a table token in the URL,
 * this gatekeeper screen prompts them to scan the physical QR sticker on their dining table
 * or use the camera scanner, rather than browsing an unassigned menu.
 */
import { useState, type ReactNode } from "react";
import { Button, Card } from "@tepisawah/ui";
import { appOrigin } from "@tepisawah/config";
import { QrScannerModal } from "./QrScannerModal.js";
import type { PublicTableResolve } from "@tepisawah/database";

export interface QrGatekeeperPageProps {
  /** Called when a table context is resolved from QR scan or selection */
  readonly onStart?: (table: PublicTableResolve) => void;
  /** Called with the raw table code & token when selected */
  readonly onSelectTable?: (tableCode: string, token: string) => void;
}

export function QrGatekeeperPage({
  onSelectTable,
}: QrGatekeeperPageProps): ReactNode {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"camera" | "picker">("camera");

  const openCamera = () => {
    setModalTab("camera");
    setScannerOpen(true);
  };

  const openDemoPicker = () => {
    setModalTab("picker");
    setScannerOpen(true);
  };

  return (
    <div className="qr-gatekeeper-container">
      <Card
        elevation="low"
        className="qr-gatekeeper-card"
        title="Silakan Pindai Kode QR di Meja Anda"
        description="Aplikasi Pemesanan Mandiri Santap di Tempat"
      >
        <div className="qr-gatekeeper-visual">
          <div className="qr-gatekeeper-icon-wrapper" aria-hidden="true">
            <span className="qr-pulse-ring"></span>
            <img src="/logo.png" alt="Logo Tepi Sawah" className="qr-gatekeeper-logo" />
          </div>
          <span className="qr-gatekeeper-badge">
            Akses Khusus Pelanggan di Meja
          </span>
        </div>

        <p className="qr-gatekeeper-intro">
          Untuk menjaga ketepatan pengantaran hidangan, pemesanan menu di Tepi Sawah
          hanya dapat dilakukan setelah memindai kode QR yang tertera pada meja
          saung atau gazebo Anda.
        </p>

        <div className="qr-gatekeeper-steps">
          <div className="gatekeeper-step">
            <span className="step-num">1</span>
            <span className="step-text">
              Temukan stiker QR Tepi Sawah yang tertempel di meja Anda.
            </span>
          </div>
          <div className="gatekeeper-step">
            <span className="step-num">2</span>
            <span className="step-text">
              Gunakan kamera HP Anda atau tekan tombol pindai di bawah ini.
            </span>
          </div>
          <div className="gatekeeper-step">
            <span className="step-num">3</span>
            <span className="step-text">
              Pilih menu favorit dan pesanan akan langsung diteruskan ke dapur!
            </span>
          </div>
        </div>

        <div className="qr-gatekeeper-actions">
          <Button
            variant="primary"
            fullWidth
            onClick={openCamera}
            className="btn-open-scanner"
          >
            📷 Buka Kamera & Pindai QR Meja
          </Button>

          <Button
            variant="secondary"
            fullWidth
            onClick={openDemoPicker}
            className="btn-open-demo-picker"
          >
            🎯 Mode Demo / Pilih Nomor Meja
          </Button>

          <div className="gatekeeper-footer-nav">
            <a
              href={appOrigin("web")}
              className="gatekeeper-link-back"
              title="Kembali ke Situs Utama Tepi Sawah"
            >
              ← Kembali ke Website Utama (tepisawah.id)
            </a>
          </div>
        </div>
      </Card>

      <QrScannerModal
        isOpen={scannerOpen}
        initialTab={modalTab}
        onClose={() => setScannerOpen(false)}
        onTableSelected={(tableCode, token) => {
          setScannerOpen(false);
          onSelectTable?.(tableCode, token);
        }}
      />
    </div>
  );
}
