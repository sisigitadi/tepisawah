/**
 * @tepisawah/order — cart drawer.
 *
 * The basket review (MASTER_DESIGN_SYSTEM.md §18): a bottom sheet the floating
 * cart bar opens, listing every line with its chosen modifiers, a quantity
 * stepper, a delete, a per-item note, the order-level note, and the total.
 * From here the customer either goes back to the menu or hands the basket to
 * checkout.
 *
 * Every money figure shown is display-only, derived from the live public
 * catalog by `resolveCartLines` — the label says "estimasi" because the number
 * the customer pays is computed by the server at order creation
 * (API_CONTRACT.md §2.2, §27). What leaves this drawer is references and intent
 * only: product id, quantity, modifier ids and notes
 * (`toCheckoutLines`, @tepisawah/orders `CartLine`).
 *
 * Notes are capped at the domain limit (@tepisawah/orders
 * `MAX_CART_LINE_NOTES_LENGTH` / `MAX_CUSTOMER_NOTE_LENGTH`) so the customer
 * learns the limit here, not from an RPC refusal at checkout.
 */
import { useCallback, useEffect, useRef, type ReactNode } from "react";

import {
  MAX_CART_LINE_NOTES_LENGTH,
  MAX_CUSTOMER_NOTE_LENGTH,
  normalizeCartNote,
  type CartLineView,
} from "@tepisawah/orders";

import { cartTotalPrice } from "./selectors.js";

export interface CartDrawerProps {
  /** Whether the sheet is mounted and visible. */
  open: boolean;
  /** Display lines, already resolved against the live catalog. */
  lines: ReadonlyArray<CartLineView>;
  /** The order-level note, held above the drawer so it survives open/close. */
  customerNote: string;
  /** Close the sheet (backdrop, ✕ or Escape). */
  onClose: () => void;
  /** Increment a line's quantity by one. */
  onIncrement: (productId: string) => void;
  /** Decrement a line's quantity; the last tap removes the line. */
  onDecrement: (productId: string) => void;
  /** Remove the line outright. */
  onRemove: (productId: string) => void;
  /** Replace a line's note. */
  onItemNoteChange: (productId: string, notes: string) => void;
  /** Replace the order-level note. */
  onCustomerNoteChange: (notes: string) => void;
  /** Hand the basket to checkout. */
  onCheckout: () => void;
}

const formatIDR = (value: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export function CartDrawer(props: CartDrawerProps): ReactNode {
  const {
    open,
    lines,
    customerNote,
    onClose,
    onIncrement,
    onDecrement,
    onRemove,
    onItemNoteChange,
    onCustomerNoteChange,
    onCheckout,
  } = props;

  const panelRef = useRef<HTMLDivElement | null>(null);

  // Focus the panel on open and return focus on close, mirroring the ui Modal
  // behaviour, so a keyboard customer lands on the sheet and escapes it.
  useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const documentElement = document.documentElement;
    const previousOverflow = documentElement.style.overflow;
    documentElement.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      documentElement.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousActive?.focus();
    };
  }, [open, onClose]);

  const handleCustomerNoteChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value.slice(0, MAX_CUSTOMER_NOTE_LENGTH);
      onCustomerNoteChange(next);
    },
    [onCustomerNoteChange],
  );

  const handleItemNoteChange = useCallback(
    (productId: string, event: React.ChangeEvent<HTMLInputElement>) => {
      onItemNoteChange(productId, event.target.value);
    },
    [onItemNoteChange],
  );

  const total = cartTotalPrice(lines);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  if (!open) return null;

  return (
    <div className="cart-drawer" role="presentation">
      <button
        type="button"
        className="cart-drawer__backdrop"
        aria-label="Tutup keranjang"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keranjang belanja"
        tabIndex={-1}
        className="cart-drawer__panel"
      >
        <header className="cart-drawer__head">
          <div>
            <h2 className="cart-drawer__title">Keranjang</h2>
            <p className="cart-drawer__count">
              {count > 0 ? `${count} menu` : "Belum ada menu"}
            </p>
          </div>
          <button
            type="button"
            className="cart-drawer__close"
            aria-label="Tutup keranjang"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="cart-drawer__empty">
            <p>Keranjang Anda masih kosong.</p>
            <p className="cart-drawer__empty-hint">
              Pilih menu dari daftar untuk mulai memesan.
            </p>
          </div>
        ) : (
          <>
            <div className="cart-drawer__items">
              {lines.map((line) => (
                <div key={line.productId} className="cart-drawer__item">
                  <div className="cart-drawer__item-head">
                    <div className="cart-drawer__item-name">{line.name}</div>
                    <div className="cart-drawer__item-total">
                      {formatIDR(line.lineTotal)}
                    </div>
                  </div>

                  {line.modifierNames.length > 0 ? (
                    <div className="cart-drawer__modifiers">
                      {line.modifierNames.join(", ")}
                    </div>
                  ) : null}

                  <div className="cart-drawer__item-actions">
                    <div className="cart-drawer__stepper">
                      <button
                        type="button"
                        className="cart-drawer__step"
                        aria-label={`Kurangi ${line.name}`}
                        onClick={() => onDecrement(line.productId)}
                      >
                        −
                      </button>
                      <span className="cart-drawer__qty" aria-live="polite">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        className="cart-drawer__step"
                        aria-label={`Tambah ${line.name}`}
                        onClick={() => onIncrement(line.productId)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="cart-drawer__remove"
                      aria-label={`Hapus ${line.name} dari keranjang`}
                      onClick={() => onRemove(line.productId)}
                    >
                      Hapus
                    </button>
                  </div>

                  <label className="cart-drawer__note-label">
                    <span className="cart-drawer__note-text">Catatan untuk menu ini</span>
                    <input
                      type="text"
                      className="cart-drawer__note-input"
                      placeholder="Mis. tanpa bawang, pedas sedang"
                      value={line.notes ?? ""}
                      maxLength={MAX_CART_LINE_NOTES_LENGTH}
                      onChange={(event) =>
                        handleItemNoteChange(line.productId, event)
                      }
                    />
                  </label>
                </div>
              ))}
            </div>

            <label className="cart-drawer__note-label cart-drawer__note-label--order">
              <span className="cart-drawer__note-text">Catatan untuk pesanan</span>
              <textarea
                className="cart-drawer__note-input cart-drawer__note-input--order"
                rows={2}
                placeholder="Catatan yang berlaku untuk seluruh pesanan"
                value={customerNote}
                maxLength={MAX_CUSTOMER_NOTE_LENGTH}
                onChange={handleCustomerNoteChange}
              />
            </label>

            <div className="cart-drawer__foot">
              <div className="cart-drawer__total">
                <span className="cart-drawer__total-label">Estimasi total</span>
                <span className="cart-drawer__total-value">{formatIDR(total)}</span>
              </div>
              <p className="cart-drawer__price-hint">
                Harga final dihitung oleh sistem saat pesanan dibuat.
              </p>
              <button
                type="button"
                className="cart-drawer__checkout"
                onClick={onCheckout}
              >
                Lanjut ke Pembayaran →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Normalize a customer note for the checkout payload (trim, drop empty). */
export function prepareCustomerNote(value: string): string | null {
  return normalizeCartNote(value);
}
