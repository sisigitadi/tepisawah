/**
 * @tepisawah/staff — PWA Install Prompt & iOS Guide Component.
 *
 * Provides:
 * 1. Bottom floating banner prompting staff to install the app on tablet/mobile/desktop.
 * 2. Step-by-step instruction modal for iOS Safari users.
 */
import { useEffect, useState, type ReactNode } from "react";
import { usePwaInstall } from "../lib/pwa.js";

const DISMISS_KEY = "tepisawah_pwa_install_dismissed_at";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function PwaInstallPrompt(): ReactNode {
  const { canInstall, isInstalled, isIos, showIosGuide, setShowIosGuide, triggerInstall } =
    usePwaInstall();
  const [isDismissed, setIsDismissed] = useState<boolean>(true);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  useEffect(() => {
    // Check if user recently dismissed the bottom banner
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (!dismissedAt) {
      setIsDismissed(false);
      return;
    }

    const elapsed = Date.now() - Number(dismissedAt);
    if (elapsed > DISMISS_DURATION_MS) {
      localStorage.removeItem(DISMISS_KEY);
      setIsDismissed(false);
    } else {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsDismissed(true);
  };

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await triggerInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  // If already running standalone as PWA, do not show banner
  if (isInstalled) return null;

  return (
    <>
      {/* Floating Bottom Install Banner */}
      {canInstall && !isDismissed ? (
        <aside
          className="pwa-install-banner"
          role="region"
          aria-label="Pasang Aplikasi Portal Staf"
        >
          <div className="pwa-install-banner-content">
            <div className="pwa-install-banner-icon" aria-hidden="true">
              <img src="/icons/icon-192.png" alt="Tepi Sawah App Icon" width="48" height="48" />
            </div>
            <div className="pwa-install-banner-text">
              <span className="pwa-install-banner-title">Pasang Aplikasi Portal Staf</span>
              <p className="pwa-install-banner-desc">
                Akses cepat layar penuh di tablet kasir, layar dapur KDS, dan HP pelayan tanpa bilah browser.
              </p>
            </div>
          </div>

          <div className="pwa-install-banner-actions">
            <button
              type="button"
              className="pwa-install-btn pwa-install-btn--primary"
              onClick={() => void handleInstallClick()}
              disabled={isInstalling}
            >
              <span aria-hidden="true">📲</span>
              <span>{isInstalling ? "Memasang…" : "Pasang Aplikasi"}</span>
            </button>
            <button
              type="button"
              className="pwa-install-btn pwa-install-btn--dismiss"
              onClick={handleDismiss}
              aria-label="Tutup pemberitahuan pasang aplikasi"
            >
              Nanti Saja
            </button>
          </div>
        </aside>
      ) : null}

      {/* iOS Safari Installation Guide Modal */}
      {showIosGuide ? (
        <div
          className="pwa-ios-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-modal-title"
          onClick={() => setShowIosGuide(false)}
        >
          <div
            className="pwa-ios-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pwa-ios-modal-header">
              <div className="pwa-ios-modal-header-icon" aria-hidden="true">
                <img src="/icons/icon-192.png" alt="" width="40" height="40" />
              </div>
              <div>
                <h2 id="ios-modal-title" className="pwa-ios-modal-title">
                  Pasang di iPhone / iPad
                </h2>
                <span className="pwa-ios-modal-sub">Panduan Pasang Aplikasi via Safari</span>
              </div>
              <button
                type="button"
                className="pwa-ios-modal-close"
                onClick={() => setShowIosGuide(false)}
                aria-label="Tutup panduan"
              >
                ✕
              </button>
            </div>

            <ol className="pwa-ios-steps">
              <li className="pwa-ios-step">
                <span className="pwa-ios-step-num">1</span>
                <div className="pwa-ios-step-body">
                  <p className="pwa-ios-step-text">
                    Ketuk tombol <strong>Bagikan / Share</strong> di bilah bawah peramban Safari Anda:
                  </p>
                  <div className="pwa-ios-step-visual">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    <span>Ikon Bagikan (Kotak dengan panah ke atas)</span>
                  </div>
                </div>
              </li>

              <li className="pwa-ios-step">
                <span className="pwa-ios-step-num">2</span>
                <div className="pwa-ios-step-body">
                  <p className="pwa-ios-step-text">
                    Gulir menu tindakan ke bawah dan pilih <strong>"Tambah ke Layar Utama" (Add to Home Screen)</strong>:
                  </p>
                  <div className="pwa-ios-step-visual">
                    <span style={{ fontSize: "1.25rem" }}>➕</span>
                    <span>Tambah ke Layar Utama</span>
                  </div>
                </div>
              </li>

              <li className="pwa-ios-step">
                <span className="pwa-ios-step-num">3</span>
                <div className="pwa-ios-step-body">
                  <p className="pwa-ios-step-text">
                    Ketuk tombol <strong>Tambah (Add)</strong> di pojok kanan atas layar Anda.
                  </p>
                  <span className="pwa-ios-step-hint">
                    Ikon aplikasi <strong>Tepi Sawah Staf</strong> akan langsung muncul di beranda HP Anda!
                  </span>
                </div>
              </li>
            </ol>

            <div className="pwa-ios-modal-footer">
              <button
                type="button"
                className="pwa-install-btn pwa-install-btn--primary"
                onClick={() => setShowIosGuide(false)}
                style={{ width: "100%" }}
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
