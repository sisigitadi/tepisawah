/**
 * @tepisawah/web — "Tentang Kami" editorial experience section.
 */
import type { ReactNode } from "react";
import { Icon } from "../../../components/icons.js";
import { useReservation } from "../reservation.js";


const PILLARS: ReadonlyArray<{
  title: string;
  desc: string;
}> = [
  {
    title: "Cita Rasa Otentik Rempah Nusantara",
    desc: "Olahan ayam panggang oven berempah, gurame bakar madu, dan aneka sambal tradisional.",
  },
  {
    title: "Destinasi Ramah Keluarga & Rombongan",
    desc: "Fasilitas saung lesehan luas, area parkir memadai untuk bus pariwisata & mobil pribadi.",
  },
  {
    title: "Dekat Akses Keluar Tol Ciperna",
    desc: "Lokasi persinggahan strategis bagi pemudik, wisatawan, dan warga Cirebon sekitarnya.",
  },
];

export function About(): ReactNode {
  const { openReservation } = useReservation();

  return (
    <section id="tentang-kami" className="web-shell web-section">
      <div className="web-panel">
        <div className="web-about-grid">
          <div className="web-about-visual">
            <div className="web-about-photo">
              <img
                src="/sawah-panorama.png"
                alt="Pemandangan asri tepi sawah Ciperna"
                loading="lazy"
              />
              <div className="web-about-cap">
                <span className="web-about-cap-kicker">
                  Nuansa Pedesaan Modern
                </span>
                <p>
                  Ruang terbuka hijau dengan hembusan angin sawah yang
                  menenangkan pikiran.
                </p>
              </div>
            </div>
            <div className="web-about-highlights">
              <div className="web-about-hl">
                <span className="web-about-hl-title">Saung Lesehan</span>
                <p>Santap lesehan privat beratap rumbia alami tepat di sisi pematang.</p>
              </div>
              <div className="web-about-hl">
                <span className="web-about-hl-title">Dek Rooftop 360°</span>
                <p>Spot senja terbaik menikmati siluet matahari terbenam dengan secangkir kopi.</p>
              </div>
            </div>
          </div>

          <div className="web-about-copy">
            <div>
              <span className="web-eyebrow">Pengalaman Bersantap</span>
              <h2 className="web-section-title web-section-title-lg">
                Lebih dari Sekadar Makan —
                <span className="web-title-italic">Sebuah Ruang Kebersamaan</span>
              </h2>
            </div>

            <p className="web-prose">
              Tepi Sawah menghadirkan pengalaman bersantap dengan suasana
              pedesaan yang nyaman di Ciperna, Cirebon. Nikmati hidangan
              Nusantara beraroma rempah segar, kopi nikmat, udara terbuka, dan
              waktu berkualitas bersama keluarga, rekan, atau teman tersayang.
            </p>

            <div className="web-pillars">
              {PILLARS.map((pillar) => (
                <div key={pillar.title} className="web-pillar">
                  <span className="web-pillar-ico">
                    <Icon name="check" size={16} />
                  </span>
                  <div>
                    <h4 className="web-pillar-title">{pillar.title}</h4>
                    <p className="web-pillar-desc">{pillar.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="web-about-actions">
              <a
                className="web-btn web-btn-forest"
                href="#menu-pilihan"
              >
                <Icon name="book-open" size={16} />
                <span>Lihat Menu Pilihan</span>
              </a>
              <button
                type="button"
                className="web-btn web-btn-outline"
                onClick={() => openReservation()}
              >
                <Icon name="calendar" size={16} />
                <span>Reservasi Acara &amp; Rombongan</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
