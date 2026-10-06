/**
 * @tepisawah/order — in-browser QR Scanner & Table Picker Modal.
 *
 * Provides two ways for customers or testers to enter a table context:
 * 1. Live camera scanning (HTML5 BarcodeDetector / MediaStream)
 * 2. Instant table selection (for desktop testers, demo, or fallback when camera is unavailable)
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Modal } from "@tepisawah/ui";

export interface DemoTableOption {
  readonly code: string;
  readonly name: string;
  readonly capacity: number;
  readonly token: string;
}

export const DEMO_TABLES: readonly DemoTableOption[] = [
  {
    code: "A1",
    name: "Meja A1 (Saung Utama)",
    capacity: 4,
    token: "dev-qr-a1-000000000000000000000001",
  },
  {
    code: "A2",
    name: "Meja A2 (Saung Kolam)",
    capacity: 4,
    token: "dev-qr-a2-000000000000000000000002",
  },
  {
    code: "A3",
    name: "Meja A3 (Gazebo Besar)",
    capacity: 6,
    token: "dev-qr-a3-000000000000000000000003",
  },
  {
    code: "B1",
    name: "Meja B1 (Teras Sawah)",
    capacity: 2,
    token: "dev-qr-b1-000000000000000000000004",
  },
];

export interface QrScannerModalProps {
  readonly isOpen: boolean;
  readonly initialTab?: "camera" | "picker";
  readonly onClose: () => void;
  readonly onTableSelected: (tableCode: string, token: string) => void;
}

export function QrScannerModal({
  isOpen,
  initialTab = "camera",
  onClose,
  onTableSelected,
}: QrScannerModalProps): ReactNode {
  const [activeTab, setActiveTab] = useState<"camera" | "picker">(initialTab);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Stop camera stream cleanly
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  // Start camera stream and barcode detector
  useEffect(() => {
    if (!isOpen || activeTab !== "camera") {
      stopCamera();
      return;
    }

    let isMounted = true;
    setCameraError(null);

    async function initCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Kamera tidak didukung pada browser ini.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setScanning(true);
        }

        // Native BarcodeDetector if available in browser
        if ("BarcodeDetector" in window) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detector = new (window as any).BarcodeDetector({
            formats: ["qr_code"],
          });

          const interval = setInterval(async () => {
            if (!videoRef.current || !isMounted) {
              clearInterval(interval);
              return;
            }
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue;
                handleScannedUrl(rawValue);
                clearInterval(interval);
              }
            } catch {
              // Frame dropped or detection error, continue loop
            }
          }, 300);

          return () => clearInterval(interval);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const message =
            err instanceof Error ? err.message : "Tidak dapat mengakses kamera.";
          setCameraError(message);
        }
      }
    }

    void initCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen, activeTab]);

  function handleScannedUrl(urlOrText: string) {
    try {
      // Parse URL if full link, or query string
      let url: URL;
      if (urlOrText.startsWith("http://") || urlOrText.startsWith("https://")) {
        url = new URL(urlOrText);
      } else {
        url = new URL(`http://dummy.id/?${urlOrText.replace(/^\?/, "")}`);
      }
      const table = url.searchParams.get("table");
      const token = url.searchParams.get("t");
      if (table && token) {
        stopCamera();
        onTableSelected(table, token);
        onClose();
        return;
      }
    } catch {
      // not a valid URL
    }

    // Fallback: check if matches any demo table code
    const found = DEMO_TABLES.find(
      (t) => t.code.toLowerCase() === urlOrText.trim().toLowerCase(),
    );
    if (found) {
      stopCamera();
      onTableSelected(found.code, found.token);
      onClose();
    }
  }

  function handleSelectDemoTable(option: DemoTableOption) {
    stopCamera();
    onTableSelected(option.code, option.token);
    onClose();
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = DEMO_TABLES.find(
      (t) => t.code.toLowerCase() === manualCode.trim().toLowerCase(),
    );
    if (found) {
      handleSelectDemoTable(found);
    } else if (manualCode.trim()) {
      // Try resolving with a generated fallback token format
      onTableSelected(manualCode.trim().toUpperCase(), `dev-qr-${manualCode.trim().toLowerCase()}`);
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} title="Pindai QR Meja" onClose={onClose}>
      <div className="qr-modal-content">
        <div className="qr-modal-tabs">
          <button
            type="button"
            className={`qr-modal-tab ${activeTab === "camera" ? "qr-modal-tab--active" : ""}`}
            onClick={() => setActiveTab("camera")}
          >
            📷 Kamera Scanner
          </button>
          <button
            type="button"
            className={`qr-modal-tab ${activeTab === "picker" ? "qr-modal-tab--active" : ""}`}
            onClick={() => setActiveTab("picker")}
          >
            🏷️ Pilih Meja (Demo)
          </button>
        </div>

        {activeTab === "camera" && (
          <div className="qr-scanner-camera-view">
            {cameraError ? (
              <div className="qr-camera-error">
                <p>⚠️ {cameraError}</p>
                <p className="qr-camera-error-sub">
                  Kamera tidak aktif atau izin ditolak. Silakan gunakan tab <strong>Pilih Meja</strong> untuk simulasi.
                </p>
                <Button variant="secondary" onClick={() => setActiveTab("picker")}>
                  Pilih Meja Manual
                </Button>
              </div>
            ) : (
              <div className="qr-viewfinder">
                <video
                  ref={videoRef}
                  className="qr-video-feed"
                  playsInline
                  muted
                />
                <div className="qr-target-box" aria-hidden="true" />
                <p className="qr-viewfinder-hint">
                  {scanning
                    ? "Arahkan kamera ke stiker QR meja…"
                    : "Menyalakan kamera…"}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "picker" && (
          <div className="qr-table-picker-view">
            <p className="qr-picker-sub">
              Pilih salah satu meja yang tersedia di Tepi Sawah untuk mulai memesan:
            </p>

            <div className="qr-table-grid">
              {DEMO_TABLES.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  className="qr-table-card-btn"
                  onClick={() => handleSelectDemoTable(t)}
                >
                  <span className="qr-table-code">{t.code}</span>
                  <span className="qr-table-name">{t.name}</span>
                  <span className="qr-table-capacity">Kapasitas {t.capacity} Orang</span>
                </button>
              ))}
            </div>

            <form className="qr-manual-form" onSubmit={handleManualSubmit}>
              <label htmlFor="manual-table-input" className="qr-manual-label">
                Atau ketik kode meja:
              </label>
              <div className="qr-manual-row">
                <input
                  id="manual-table-input"
                  type="text"
                  placeholder="Misal: A1, A2, B1"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="qr-manual-input"
                />
                <Button variant="primary" type="submit" disabled={!manualCode.trim()}>
                  Pilih
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
}
