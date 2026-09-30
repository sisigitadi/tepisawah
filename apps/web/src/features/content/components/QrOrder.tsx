/**
 * @tepisawah/web — QR ordering experience section.
 *
 * 4-step interactive flow + smartphone order mockup. Illustrates the same
 * real pipeline used by the /order app (scan → pilih → kirim → sajian).
 */
import type { ReactNode } from "react";
import { Icon } from "../../../components/icons.js";

const STEPS: ReadonlyArray<{
  n: string;
  title: string;
  sub: string;
}> = [
  { n: "1", title: "Scan QR", sub: "Di meja Anda" },
  { n: "2", title: "Pilih Menu", sub: "Ilustrasi & harga jelas" },
  { n: "3", title: "Kirim Order", sub: "Langsung ke dapur" },
  { n: "4", title: "Sajian Tiba", sub: "Diantar ke meja" },
];

const MOCK_ITEMS: ReadonlyArray<{ qty: string; name: string; price: string }> =
  [
    { qty: "1x", name: "Chicken Roaster Rempah", price: "Rp 85.000" },
    { qty: "2x", name: "Es Kelapa Jeruk Segar", price: "Rp 36.000" },
  ];

export function QrOrder(): ReactNode {
  return (
    <section id="qr-order" className="web-shell web-section">
      <div className="web-qr">
        <div className="web-qr-glow" aria-hidden="true" />
        <div className="web-qr-grid">
          <div className="web-qr-copy">
            <span className="web-promo-pill web-promo-pill-amber">
              <Icon name="smartphone" size={14} /> Digital Dining Experience
            </span>
            <h2 className="web-section-title web-section-title-cream web-section-title-lg">
              Pesan Langsung dari Meja Anda
            </h2>
            <p className="web-prose web-prose-cream">
              Pemesanan online tidak tersedia. Saat berkunjung, cukup scan kode
              QR yang tertera di meja Anda, pilih hidangan Nusantara dan
              minuman favorit, lalu kirim pesanan langsung dari smartphone —
              atau pesan langsung di kasir / melalui pramusaji kami.
            </p>

            <div className="web-qr-steps">
              {STEPS.map((step) => (
                <div key={step.n} className="web-qr-step">
                  <span className="web-qr-step-n">{step.n}</span>
                  <span className="web-qr-step-title">{step.title}</span>
                  <span className="web-qr-step-sub">{step.sub}</span>
                </div>
              ))}
            </div>

            <div className="web-qr-actions">
              <span className="web-qr-note">
                <Icon name="info" size={14} /> Tersedia saat Anda berkunjung —
                tanpa aplikasi, tanpa instal, tanpa antre
              </span>
            </div>
          </div>

          <div className="web-qr-phone-wrap">
            <div className="web-qr-phone">
              <div className="web-qr-phone-screen">
                <div className="web-qr-phone-head">
                  <div className="web-qr-phone-brand">
                    <span className="web-qr-phone-logo">
                      <Icon name="utensils" size={16} />
                    </span>
                    <span>
                      <span className="web-qr-phone-name">Tepi Sawah Order</span>
                      <span className="web-qr-phone-table">
                        Meja 01 — Saung Sawah
                      </span>
                    </span>
                  </div>
                  <span className="web-qr-phone-live">Terhubung</span>
                </div>

                <div className="web-qr-phone-list">
                  {MOCK_ITEMS.map((item) => (
                    <div key={item.name} className="web-qr-phone-item">
                      <span className="web-qr-phone-item-name">
                        {item.qty} {item.name}
                      </span>
                      <span className="web-qr-phone-item-price">
                        {item.price}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="web-qr-phone-total">
                  <span>Total Tagihan:</span>
                  <span className="web-qr-phone-total-value">Rp 121.000</span>
                </div>

                <span className="web-qr-phone-cta">
                  <Icon name="check-circle" size={14} />
                  Order terkirim ke dapur
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
