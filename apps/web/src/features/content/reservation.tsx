/**
 * @tepisawah/web — reservation UI context.
 *
 * Lifts the reservation modal + toast above the section tree so any CTA
 * (navbar, hero, promo card, footer, mobile bar) can open the form.
 * Business validation lives server-side; this is UX only (§15).
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "../../components/icons.js";

interface ReservationContextValue {
  /** Open the reservation modal, optionally pre-seeding a promo/package note. */
  openReservation: (promoName?: string) => void;
  closeReservation: () => void;
}

const ReservationContext = createContext<ReservationContextValue | null>(null);

export function useReservation(): ReservationContextValue {
  const value = useContext(ReservationContext);
  if (!value) {
    throw new Error("useReservation must be used inside <ReservationProvider>");
  }
  return value;
}

const SEED_NOTE_PREFIX = "Promo/Paket: ";

export function ReservationProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const [seedNote, setSeedNote] = useState("");
  const [toast, setToast] = useState<{ title: string; desc: string } | null>(
    null,
  );

  const openReservation = useCallback((promoName = "") => {
    setSeedNote(promoName ? `${SEED_NOTE_PREFIX}${promoName}` : "");
    setIsOpen(true);
  }, []);

  const closeReservation = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo(
    () => ({ openReservation, closeReservation }),
    [openReservation, closeReservation],
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.namedItem("resName") as HTMLInputElement | null;
    const guests = form.elements.namedItem(
      "resGuests",
    ) as HTMLInputElement | null;
    const date = form.elements.namedItem(
      "resDate",
    ) as HTMLInputElement | null;
    const time = form.elements.namedItem(
      "resTime",
    ) as HTMLSelectElement | null;

    closeReservation();
    setToast({
      title: "Reservasi Meja Diterima!",
      desc: `Terima kasih ${name?.value ?? ""}. Meja untuk ${
        guests?.value ?? ""
      } orang pada ${date?.value ?? ""} (${time?.value ?? ""}) telah dicatat. Tim kami akan mengonfirmasi via WhatsApp.`,
    });
    form.reset();
  }

  return (
    <ReservationContext.Provider value={value}>
      {children}

      {/* Notification toast */}
      <div
        className="web-toast"
        role="status"
        aria-live="polite"
        data-visible={toast !== null}
      >
        <div className="web-toast-card">
          <span className="web-toast-icon">
            <Icon name="check-circle" size={20} />
          </span>
          <div>
            <p className="web-toast-title">Berhasil</p>
            <p className="web-toast-desc">{toast?.desc}</p>
          </div>
        </div>
      </div>

      {/* Reservation modal */}
      {isOpen ? (
        <div
          className="web-modal-backdrop"
          onClick={closeReservation}
          role="dialog"
          aria-modal="true"
          aria-labelledby="resModalTitle"
        >
          <div
            className="web-modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="web-modal-close"
              onClick={closeReservation}
              aria-label="Tutup Formulir"
            >
              <Icon name="x" size={20} />
            </button>

            <div className="web-modal-head">
              <span className="web-eyebrow">Layanan Restoran</span>
              <h3 id="resModalTitle" className="web-modal-title">
                Reservasi Meja Restoran
              </h3>
              <p className="web-modal-sub">
                Amankan alokasi saung atau rooftop terbaik untuk kunjungan Anda
                di Tepi Sawah Ciperna.
              </p>
            </div>

            <form className="web-form" onSubmit={handleSubmit}>
              <label className="web-field">
                <span className="web-label">Nama Pemesan</span>
                <input
                  type="text"
                  name="resName"
                  required
                  placeholder="Contoh: Rian Anggoro"
                />
              </label>

              <div className="web-field-row">
                <label className="web-field">
                  <span className="web-label">Nomor WhatsApp</span>
                  <input
                    type="tel"
                    name="resPhone"
                    required
                    placeholder="0812-xxxx-xxxx"
                  />
                </label>
                <label className="web-field">
                  <span className="web-label">Jumlah Orang</span>
                  <input
                    type="number"
                    name="resGuests"
                    min={1}
                    max={50}
                    defaultValue={4}
                    required
                  />
                </label>
              </div>

              <div className="web-field-row">
                <label className="web-field">
                  <span className="web-label">Tanggal Kunjungan</span>
                  <input type="date" name="resDate" required />
                </label>
                <label className="web-field">
                  <span className="web-label">Sesi Waktu Kunjungan</span>
                  <select name="resTime" defaultValue="16:30 WIB">
                    <option value="11:30 WIB">11:30 WIB (Makan Siang)</option>
                    <option value="13:00 WIB">
                      13:00 WIB (Makan Siang Santai)
                    </option>
                    <option value="16:30 WIB">
                      16:30 WIB (Sunset Sawah &amp; Kopi)
                    </option>
                    <option value="18:30 WIB">18:30 WIB (Makan Malam)</option>
                  </select>
                </label>
              </div>

              <label className="web-field">
                <span className="web-label">Pilihan Tempat Duduk</span>
                <select name="resTableChoice">
                  <option>Saung Lesehan Menghadap Sawah (Favorit)</option>
                  <option>Dek Rooftop 360° Sunset View</option>
                  <option>Area Utama Semi-Indoor</option>
                </select>
              </label>

              <label className="web-field">
                <span className="web-label">Catatan Tambahan (Opsional)</span>
                <input
                  type="text"
                  name="resNotes"
                  placeholder="Contoh: Gathering keluarga, butuh kursi bayi"
                  defaultValue={seedNote}
                />
              </label>

              <button type="submit" className="web-btn web-btn-primary">
                <Icon name="check" size={16} />
                <span>Konfirmasi Reservasi Meja</span>
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </ReservationContext.Provider>
  );
}
