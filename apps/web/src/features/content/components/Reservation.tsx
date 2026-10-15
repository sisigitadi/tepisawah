/**
 * @tepisawah/web — Layanan Meja & Acara section.
 *
 * The single, definitive destination for table allocations & event reservations.
 * Visitors arriving via the header's "Reservasi Meja & Acara" button land directly
 * here to explore seating areas and submit instant reservations via WhatsApp.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "../../../components/icons.js";
import { getSupabaseClient } from "../../../lib/supabase.js";
import { useLandingContent } from "../../../hooks/index.js";

const SEATING_AREAS = [
  {
    id: "saung",
    title: "Saung Lesehan Sawah",
    capacity: "4 - 8 Orang per Saung",
    desc: "Suasana santai bersila beralas bambu alami tepat di samping pematang sawah hijau yang sejuk.",
    badge: "Favorit Keluarga",
  },
  {
    id: "rooftop",
    title: "Dek Rooftop 360° Senja",
    capacity: "2 - 20 Orang",
    desc: "Meja santap elevated dengan pemandangan sunset dan semilir angin sawah tanpa batas.",
    badge: "Spot Senja",
  },
  {
    id: "gazebo",
    title: "Gazebo Rombongan & Acara",
    capacity: "15 - 50+ Orang",
    desc: "Meja panjang semi-outdoor untuk gathering kantor, arisan keluarga besar, dan rombongan bus.",
    badge: "Kapasitas Besar",
  },
];

export function Reservation(): ReactNode {
  const { content } = useLandingContent();
  const resConfig = content.reservation;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");
  const [guests, setGuests] = useState("4");
  const [area, setArea] = useState("Saung Lesehan Sawah");
  const [note, setNote] = useState("");
  const [waNumber, setWaNumber] = useState(resConfig.whatsappNumber || "6281234567890");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadPhone() {
      try {
        const client = getSupabaseClient() as any;
        const { data, error } = await client
          .from("restaurant_settings")
          .select("phone")
          .limit(1)
          .maybeSingle();

        const row = data as { phone?: string | null } | null;
        if (!error && row?.phone) {
          const raw = row.phone.replace(/[^0-9]/g, "");
          const clean = raw.startsWith("0") ? `62${raw.slice(1)}` : raw.startsWith("62") ? raw : `62${raw}`;
          setWaNumber(clean);
        }
      } catch {
        // fallback to default
      }
    }
    void loadPhone();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const cleanName = name.trim() || "Tamu Tepi Sawah";
    const cleanPhone = phone.trim() || "-";
    const cleanDate = date || new Date().toISOString().slice(0, 10);
    const cleanGuests = Number.parseInt(guests, 10) || 4;
    const cleanNote = note.trim();

    try {
      const client = getSupabaseClient() as any;
      await client.from("reservations").insert([
        {
          customer_name: cleanName,
          phone: cleanPhone,
          reservation_date: cleanDate,
          reservation_time: time,
          guests_count: cleanGuests,
          seating_area: area,
          notes: cleanNote || null,
          status: "PENDING",
        },
      ]);
      setSubmitted(true);
    } catch (err) {
      console.warn("Could not record reservation in database:", err);
    } finally {
      setSaving(false);
    }

    const message = encodeURIComponent(
      `Halo Tepi Sawah Restaurant & Coffee, saya ingin reservasi meja/acara:\n\n` +
      `• Nama: ${cleanName}\n` +
      `• No. WhatsApp: ${cleanPhone}\n` +
      `• Tanggal: ${cleanDate}\n` +
      `• Waktu Kunjungan: ${time} WIB\n` +
      `• Jumlah Tamu: ${cleanGuests} Orang\n` +
      `• Pilihan Area: ${area}${cleanNote ? `\n• Catatan: ${cleanNote}` : ""}\n\n` +
      `Mohon info ketersediaan meja. Terima kasih!`
    );

    window.open(`https://wa.me/${waNumber}?text=${message}`, "_blank", "noopener,noreferrer");
  }

  return (
    <section id="reservasi" className="web-shell web-section">
      <div className="web-panel web-panel-lg">
        <div className="web-res-layout">
          {/* Left Column: Context & Seating Areas */}
          <div className="web-res-info">
            <span className="web-eyebrow">{resConfig.eyebrow || "Layanan Meja & Acara"}</span>
            <h2 className="web-section-title web-section-title-lg">
              {resConfig.title || "Alokasi Meja Prioritas & Reservasi Rombongan"}
            </h2>
            <p className="web-prose">
              {resConfig.description ||
                "Kunjungi Tepi Sawah bersama keluarga, rekan kerja, maupun komunitas tanpa khawatir kehabisan tempat. Kami siap mengalokasikan area terbaik dengan layanan hangat dan tanpa biaya sewa saung."}
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

              {submitted ? (
                <div style={{ padding: "10px 14px", background: "rgba(46, 107, 52, 0.15)", border: "1px solid #2e6b34", borderRadius: "8px", color: "#183a1d", fontSize: "13px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>✓</span>
                  <span>Data reservasi telah tercatat di sistem resto dan diarahkan ke WhatsApp resmi.</span>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={saving}
                className="web-btn web-btn-gold web-btn-lg web-res-btn-submit"
              >
                <Icon name="phone-call" size={18} />
                <span>{saving ? "Mencatat Reservasi..." : "Kirim Reservasi via WhatsApp"}</span>
              </button>

              <p className="web-res-form-footer">
                <Icon name="clock" size={14} /> Jam Layanan Reservasi: Setiap Hari 09:00 - 22:00 WIB
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
