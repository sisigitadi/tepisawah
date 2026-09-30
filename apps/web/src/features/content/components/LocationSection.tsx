/**
 * @tepisawah/web — location & maps section.
 *
 * Embedded Google Maps iframe beside the full address and operating details;
 * the live open/closed chip is driven by `useOpenStatus`.
 */
import type { ReactNode } from "react";
import { Icon } from "../../../components/icons.js";
import { useOpenStatus } from "../../../hooks/index.js";
import { useReservation } from "../reservation.js";
import { MAPS_URL } from "./SiteHeader.js";

export function LocationSection(): ReactNode {
  const { isOpen } = useOpenStatus();
  const { openReservation } = useReservation();

  return (
    <section id="lokasi" className="web-shell web-section">
      <div className="web-panel web-panel-lg">
        <div className="web-loc-head">
          <div>
            <span className="web-eyebrow">Aksesibilitas Mudah &amp; Cepat</span>
            <h2 className="web-section-title">
              Lokasi Strategis — Dekat Gerbang Tol Ciperna
            </h2>
            <p className="web-prose">
              Hanya berjarak sekitar <strong>3 menit</strong> dari Pintu Keluar
              Gerbang Tol Ciperna (Tol Cipali / Palimanan - Kanci), sangat cocok
              untuk persinggahan kuliner keluarga, pelancong, maupun rombongan
              wisatawan.
            </p>
          </div>
          <a
            className="web-btn web-btn-forest"
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="map" size={16} />
            <span>Buka di Google Maps</span>
          </a>
        </div>

        <div className="web-loc-grid">
          <div className="web-loc-map">
            <div className="web-loc-map-bar">
              <span className="web-loc-map-coords">
                <Icon name="map-pin" size={14} className="web-ico-amber" />
                Koordinat Presisi: -6.771185, 108.512599
              </span>
              <span className="web-loc-map-area">Kec. Talun, Kab. Cirebon</span>
            </div>
            <div className="web-loc-map-frame">
              <iframe
                src="https://maps.google.com/maps?q=-6.771185,108.512599&hl=id&z=17&output=embed"
                title="Peta Lokasi Tepi Sawah Ciperna"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>

          <div className="web-loc-side">
            <div className="web-loc-card">
              <div>
                <span className="web-loc-card-kicker">Alamat Lengkap</span>
                <h3 className="web-loc-card-name">
                  Tepi Sawah Restaurant &amp; Coffee
                </h3>
                <p className="web-loc-card-addr">
                  <strong>Jl. Raya Ciperna</strong>, Kec. Talun, Kab. Cirebon,
                  Jawa Barat 45171.<br />
                  (Tepat di tepi hamparan persawahan asri, 3 menit dari Exit Tol
                  Ciperna).
                </p>
              </div>
              <div className="web-loc-facts">
                <div className="web-loc-fact">
                  <span>Hari Operasional:</span>
                  <strong>Setiap Hari</strong>
                </div>
                <div className="web-loc-fact">
                  <span>Jam Buka:</span>
                  <strong className="web-ico-forest">09:00 – 22:00 WIB</strong>
                </div>
                <div className="web-loc-fact">
                  <span>Status Hari Ini:</span>
                  <strong
                    className={
                      isOpen ? "web-ico-open" : "web-ico-closed"
                    }
                  >
                    <span className="web-loc-dot" />
                    {isOpen ? "Buka Sekarang" : "Tutup • Buka Kembali 09:00"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="web-loc-parking">
              <span className="web-loc-parking-head">
                <Icon name="check-circle" size={16} />
                Fasilitas Parkir &amp; Kenyamanan Kunjungan
              </span>
              <p>
                Area parkir luas yang dapat menampung puluhan mobil keluarga,
                bus pariwisata, serta sepeda motor dengan petugas keamanan siaga
                untuk memastikan kenyamanan kunjungan Anda.
              </p>
            </div>

            <div className="web-loc-actions">
              <a
                className="web-btn web-btn-forest web-btn-flex"
                href={MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="navigation" size={16} />
                <span>Petunjuk Rute</span>
              </a>
              <button
                type="button"
                className="web-btn web-btn-amber web-btn-flex"
                onClick={() => openReservation()}
              >
                <Icon name="calendar" size={16} />
                <span>Reservasi Meja</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
