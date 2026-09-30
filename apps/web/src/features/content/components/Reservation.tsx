/**
 * @tepisawah/web — reservation section for groups & events.
 */
import type { ReactNode } from "react";
import { Icon } from "../../../components/icons.js";
import { useReservation } from "../reservation.js";

const OCCASIONS: readonly string[] = [
  "Keluarga Besar",
  "Gathering Kantor",
  "Rombongan Wisata",
  "Arisan & Reuni",
  "Meeting Santai",
  "Perayaan Spesial",
];

export function Reservation(): ReactNode {
  const { openReservation } = useReservation();

  return (
    <section id="reservasi" className="web-shell web-section">
      <div className="web-panel">
        <div className="web-res-grid">
          <div className="web-res-copy">
            <span className="web-eyebrow">Layanan Meja &amp; Acara</span>
            <h2 className="web-section-title web-section-title-lg">
              Mau Datang Bersama Rombongan?
            </h2>
            <p className="web-prose">
              Rencanakan kunjungan santap bersama keluarga besar, komunitas,
              rekan kantor, gathering, atau perayaan ulang tahun di Tepi Sawah
              Ciperna. Kami menyiapkan area saung nyaman dan layanan hangat.
            </p>

            <div className="web-res-tags">
              {OCCASIONS.map((occasion) => (
                <span key={occasion} className="web-res-tag">
                  <Icon name="check" size={14} />
                  <span>{occasion}</span>
                </span>
              ))}
            </div>

            <div className="web-res-actions">
              <button
                type="button"
                className="web-btn web-btn-forest"
                onClick={() => openReservation()}
              >
                <Icon name="calendar-check" size={16} />
                <span>Reservasi Meja Sekarang</span>
              </button>
              <a className="web-btn web-btn-outline" href="#lokasi">
                <Icon name="phone-call" size={16} />
                <span>Hubungi Kami</span>
              </a>
            </div>
          </div>

          <div className="web-res-card">
            <div className="web-res-card-head">
              <span className="web-res-card-ico">
                <Icon name="info" size={20} />
              </span>
              <div>
                <h3 className="web-res-card-title">Informasi Reservasi</h3>
                <span className="web-res-card-sub">
                  Tanpa Pungutan Biaya Booking
                </span>
              </div>
            </div>
            <p className="web-res-card-desc">
              Reservasi meja membantu tim kami mengalokasikan area saung atau
              dek rooftop pilihan terbaik sebelum Anda dan rombongan tiba di
              lokasi.
            </p>
            <div className="web-res-card-facts">
              <div className="web-res-card-fact">
                <span>Waktu Pelayanan:</span>
                <strong>Setiap Hari, 09:00 - 22:00 WIB</strong>
              </div>
              <div className="web-res-card-fact">
                <span>Fasilitas:</span>
                <strong>Parkir Luas Bus &amp; Mobil</strong>
              </div>
            </div>
            <button
              type="button"
              className="web-btn web-btn-gold"
              onClick={() => openReservation()}
            >
              Formulir Reservasi Meja
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
