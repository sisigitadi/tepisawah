/**
 * @tepisawah/web — Layanan Meja & Acara section.
 *
 * The single, definitive destination for table allocations & event reservations.
 * Visitors arriving via the header's "Reservasi Meja & Acara" button land directly
 * here to explore seating areas and submit instant reservations via WhatsApp.
 */
import { useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "../../../components/icons.js";

const SEATING_AREAS = [
  {
    id: "saung",
    title: "Saung Lesehan Sawah",
    capacity: "4 – 8 Orang per Saung",
    desc: "Suasana santai bersila beralas bambu alami tepat di samping pematang sawah hijau yang sejuk.",
    badge: "Favorit Keluarga",
  },
  {
    id: "rooftop",
    title: "Dek Rooftop 360° Senja",
    capacity: "2 – 20 Orang",
    desc: "Meja santap elevated dengan pemandangan sunset dan semilir angin sawah tanpa batas.",
    badge: "Spot Senja",
  },
  {
    id: "gazebo",
    title: "Gazebo Rombongan & Acara",
    capacity: "15 – 50+ Orang",
    desc: "Meja panjang semi-outdoor untuk gathering kantor, arisan keluarga besar, dan rombongan bus.",
    badge: "Kapasitas Besar",
  },
];

const RESTAURANT_WA = "6281234567890";

export function Reservation(): ReactNode {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");
  const [guests, setGuests] = useState("4");
  const [area, setArea] = useState("Saung Lesehan Sawah");
  const [note, setNote] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanName = name.trim() || "Tamu Tepi Sawah";
    const cleanPhone = phone.trim() || "-";
    const cleanDate = date || "Hari Ini / Segera";
    const cleanGuests = guests || "4";
    const cleanNote = note.trim() ? `\n• Catatan: ${note.trim()}` : "";

    const message = encodeURIComponent(
      `Halo Tepi Sawah Restaurant & Coffee, saya ingin reservasi meja/acara:\n\n` +
      `• Nama: ${cleanName}\n` +
      `• No. WhatsApp: ${cleanPhone}\n` +
      `• Tanggal: ${cleanDate}\n` +
      `• Waktu Kunjungan: ${time} WIB\n` +
      `• Jumlah Tamu: ${cleanGuests} Orang\n` +
      `• Pilihan Area: ${area}${cleanNote}\n\n` +
      `Mohon info ketersediaan meja. Terima kasih!`
    );

    window.open(`https://wa.me/${RESTAURANT_WA}?text=${message}`, "_blank", "noopener,noreferrer");
  }

  return (
    <section id="reservasi" className="web-shell web-section">
      <div className="web-panel web-panel-lg">
        <div className="web-res-layout">
          {/* Left Column: Context & Seating Areas */}
          <div className="web-res-info">
            <span className="web-eyebrow">Layanan Meja &amp; Acara</span>
            <h2 className="web-section-title web-section-title-lg">
              Alokasi Meja Prioritas &amp; Reservasi Rombongan
            </h2>
            <p className="web-prose">
              Kunjungi Tepi Sawah bersama keluarga, rekan kerja, maupun komunitas
              tanpa khawatir kehabisan tempat. Kami siap mengalokasikan area
              terbaik dengan layanan hangat dan tanpa biaya sewa saung.
            </p>

            <div className="web-res-area-list">
              {SEATING_AREAS.map((item) => (
                <div key={item.id} className="web-res-area-card">
                  <div className="web-res-area-head">
                    <strong className="web-res-area-title">{item.title}</strong>
                    <span className="web-res-area-badge">{item.badge}</span>
                  </div>
                  <span className="web-res-area-cap">
                    <Icon name="users" size={14} /> Kapasitas: {item.capacity}
                  </span>
                  <p className="web-res-area-desc">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="web-res-perks">
              <div className="web-res-perk">
                <Icon name="check-circle" size={16} className="web-ico-forest" />
                <span>Tanpa Biaya Booking (Gratis Alokasi Tempat)</span>
              </div>
              <div className="web-res-perk">
                <Icon name="check-circle" size={16} className="web-ico-forest" />
                <span>Area Parkir Luas untuk Bus Wisata &amp; Puluhan Mobil</span>
              </div>
              <div className="web-res-perk">
                <Icon name="check-circle" size={16} className="web-ico-forest" />
                <span>Konfirmasi Cepat via WhatsApp Resmi Restoran</span>
              </div>
            </div>
          </div>

          {/* Right Column: Direct Instant Reservation Form */}
          <div className="web-res-form-card">
            <div className="web-res-form-head">
              <span className="web-res-form-badge">Reservasi Langsung</span>
              <h3 className="web-res-form-title">Formulir Kunjungan</h3>
              <p className="web-res-form-sub">
                Isi data kunjungan Anda untuk terhubung langsung dengan tim pramusaji Tepi Sawah.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="web-res-form">
              <div className="web-res-field">
                <label htmlFor="res-name">Nama Pemesan / Instansi</label>
                <input
                  id="res-name"
                  type="text"
                  required
                  placeholder="Contoh: Bpk. Budi / Keluarga Santoso"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="web-res-field-row">
                <div className="web-res-field">
                  <label htmlFor="res-phone">No. WhatsApp</label>
                  <input
                    id="res-phone"
                    type="tel"
                    required
                    placeholder="08xxxxxxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="web-res-field">
                  <label htmlFor="res-guests">Jumlah Tamu</label>
                  <input
                    id="res-guests"
                    type="number"
                    min="1"
                    max="200"
                    required
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                  />
                </div>
              </div>

              <div className="web-res-field-row">
                <div className="web-res-field">
                  <label htmlFor="res-date">Rencana Tanggal</label>
                  <input
                    id="res-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="web-res-field">
                  <label htmlFor="res-time">Perkiraan Jam</label>
                  <input
                    id="res-time"
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="web-res-field">
                <label htmlFor="res-area">Pilihan Area Meja</label>
                <select
                  id="res-area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                >
                  <option value="Saung Lesehan Sawah">Saung Lesehan Sawah (4 - 8 Orang)</option>
                  <option value="Dek Rooftop 360° Senja">Dek Rooftop 360° Senja (2 - 20 Orang)</option>
                  <option value="Gazebo Rombongan & Acara">Gazebo Rombongan &amp; Acara (15 - 50+ Orang)</option>
                  <option value="Area Bebas / Rekomendasi Resto">Bebas / Rekomendasi Restoran</option>
                </select>
              </div>

              <div className="web-res-field">
                <label htmlFor="res-note">Catatan Acara (Opsional)</label>
                <input
                  id="res-note"
                  type="text"
                  placeholder="Contoh: Arisan keluarga, butuh colokan listrik, dll."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="web-btn web-btn-gold web-btn-lg web-res-btn-submit"
              >
                <Icon name="phone-call" size={18} />
                <span>Kirim Reservasi via WhatsApp</span>
              </button>

              <p className="web-res-form-footer">
                <Icon name="clock" size={14} /> Jam Layanan Reservasi: Setiap Hari 09:00 – 22:00 WIB
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
