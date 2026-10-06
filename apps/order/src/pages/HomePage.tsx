/**
 * @tepisawah/order — Home page (Customer QR Ordering & Digital Menu).
 *
 * Implements the mobile-first ordering flow per
 * docs/design/MASTER_DESIGN_SYSTEM.md §18: table context banner, category
 * pills, dish cards with photos, persistent cart footer, and call-waiter /
 * request-bill service actions.
 *
 * The catalog is LIVE: it rides the anonymous `public_catalog()` projection
 * (migration 005 part 5) through `@tepisawah/database`, so a menu change saved
 * in the admin console reaches this page on the next load — archived or
 * out-of-stock items never reach a customer. The read fails closed with a
 * retry; there is no second source of truth.
 *
 * The cart is LIVE too: with a resolved table context (the QR entry), the
 * basket opens in the cart drawer, where the customer tunes quantities and
 * notes, then hands it to the checkout feature — references and intent only,
 * never a price (API_CONTRACT.md §10.1, §10.2). Without a table context (the
 * demo landing), the button stays a notice.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { formatPrice } from "@tepisawah/ui";
import {
  fetchPublicCatalog,
  groupCatalogByCategory,
  type PublicCatalogProduct,
  type PublicTableResolve,
} from "@tepisawah/database";

import {
  CartDrawer,
  cartItemCount,
  cartTotalPrice,
  decrementEntry,
  incrementEntry,
  removeEntry,
  resolveCartEntries,
  resolveCartLines,
  setEntryModifiers,
  setEntryNote,
  type CartEntry,
  type CartMap,
  type CartLineView,
} from "../features/cart/index.js";
import type { CartLine } from "../features/checkout/service.js";
import { QrScannerModal } from "../features/qr/index.js";
import { getSupabaseClient } from "../lib/supabase.js";

const formatIDR = formatPrice;

interface CategoryPill {
  id: string;
  name: string;
}

/**
 * One basket line's mutable state, in the order domain's vocabulary: quantity,
 * chosen modifier ids, and the note attached to the line.
 */
export type OrderCartEntry = CartEntry;

export interface HomePageProps {
  /** The table context the QR resolved; null on the demo landing view. */
  table?: PublicTableResolve | null;
  /**
   * Controlled basket, held by the router so it survives the checkout
   * round trip ("Ubah pesanan" must not wipe it). Unset on the demo landing.
   */
  cart?: CartMap;
  /** Receives every basket change when controlled (an updater, like setState). */
  onCartChange?: (update: (prev: CartMap) => CartMap) => void;
  /** The order-level note, held above the drawer so it survives open/close. */
  customerNote?: string;
  /** Receives every order-level note change when controlled. */
  onCustomerNoteChange?: (note: string) => void;
  /** Called with the basket when the customer sends it to the kitchen. */
  onCheckout?: (items: CartLine[]) => void;
  /** Called when the customer scans or selects a table via QR scanner modal. */
  onSelectTable?: (tableCode: string, token: string) => void;
}

export function HomePage(props: HomePageProps): ReactNode {
  const {
    table = null,
    cart: controlledCart,
    onCartChange,
    customerNote,
    onCustomerNoteChange,
    onCheckout,
    onSelectTable,
  } = props;
  const [products, setProducts] = useState<PublicCatalogProduct[] | null>(null);
  const [categories, setCategories] = useState<CategoryPill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("SEMUA");
  const [internalCart, setInternalCart] = useState<CartMap>({});
  const cart = controlledCart ?? internalCart;
  const [internalNote, setInternalNote] = useState<string>("");
  const customerNoteValue = customerNote ?? internalNote;
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const [serviceNotice, setServiceNotice] = useState<string | null>(null);

  /**
   * Basket writes flow to the router when controlled (basket survives the
   * checkout round trip), otherwise to local state (demo landing). Both paths
   * take a functional updater so rapid taps never race a stale snapshot of
   * the basket — every update applies to the newest cart, whatever it was.
   */
  const applyCart = useCallback(
    (updater: (prev: CartMap) => CartMap) => {
      if (onCartChange) onCartChange(updater);
      else setInternalCart(updater);
    },
    [onCartChange],
  );

  const applyCustomerNote = useCallback(
    (note: string) => {
      if (onCustomerNoteChange) onCustomerNoteChange(note);
      else setInternalNote(note);
    },
    [onCustomerNoteChange],
  );

  const load = useCallback(async () => {
    setError(null);
    const result = await fetchPublicCatalog(getSupabaseClient());
    if (result.error) {
      setProducts(null);
      setError(result.error.message);
      return;
    }
    const rows = result.data ?? [];
    const grouped = groupCatalogByCategory(rows);
    setProducts(rows);
    setCategories(grouped.map((group) => ({ id: group.id, name: group.name })));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addToCart = (id: string) => {
    applyCart((prev) => incrementEntry(prev, id));
  };

  const removeFromCart = (id: string) => {
    applyCart((prev) => decrementEntry(prev, id));
  };

  /**
   * Toggle a required-modifier choice on a product's card. The server refuses
   * any draft missing a required modifier (resolve_order_item), so the card
   * gates "+ Tambah" on every required row being chosen first.
   */
  const toggleModifier = (productId: string, modifierId: string) => {
    applyCart((prev) => {
      const entry = prev[productId];
      const modifierIds = entry?.modifierIds.includes(modifierId)
        ? entry.modifierIds.filter((id) => id !== modifierId)
        : [...(entry?.modifierIds ?? []), modifierId];
      return setEntryModifiers(prev, productId, modifierIds);
    });
  };

  const handleCallWaiter = () => {
    setServiceNotice("Pramusaji sedang menuju ke meja Anda.");
    window.setTimeout(() => setServiceNotice(null), 4000);
  };

  const handleRequestBill = () => {
    setServiceNotice("Permintaan tagihan telah diteruskan ke kasir.");
    window.setTimeout(() => setServiceNotice(null), 4000);
  };

  /** Display lines for the drawer: catalog order, money for display only. */
  const drawerLines: CartLineView[] =
    products === null ? [] : resolveCartLines(cart, products);

  const totalItems = cartItemCount(cart);
  const totalPrice = cartTotalPrice(drawerLines);

  const handleOpenCart = () => {
    setDrawerOpen(true);
  };

  const handleCloseCart = () => {
    setDrawerOpen(false);
  };

  /**
   * Hand the basket to checkout. With a table context the basket becomes
   * CartLine references — productId, quantity, modifier ids, notes, no money —
   * for the checkout feature to turn into a DRAFT order server-side. Without
   * one (demo landing), the drawer keeps its notice behaviour.
   */
  const handleCheckout = () => {
    setDrawerOpen(false);
    if (table === null) {
      setScannerOpen(true);
      setServiceNotice("Silakan pilih atau pindai meja Anda terlebih dahulu.");
      return;
    }
    if (!onCheckout) {
      setServiceNotice(`Pesanan (${totalItems} menu) berhasil dikirim ke dapur!`);
      return;
    }
    const lines = products === null ? [] : resolveCartEntries(cart, products);
    if (lines.length === 0) return;
    onCheckout(lines);
  };

  const filteredItems =
    products === null
      ? []
      : selectedCategory === "SEMUA"
        ? products
        : products.filter((item) => item.categoryId === selectedCategory);

  return (
    <div className="order-experience">
      {/* Unassigned Table Notice if directly opened without QR */}
      {table === null ? (
        <div className="table-unassigned-notice">
          <div className="table-unassigned-content">
            <span className="notice-icon" aria-hidden="true">📱</span>
            <div>
              <strong className="notice-title">Belum Terhubung ke Meja</strong>
              <p className="notice-sub">
                Pindai stiker QR di meja Anda atau pilih nomor meja untuk memesan langsung ke dapur.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-scan-qr-cta"
            onClick={() => setScannerOpen(true)}
          >
            📷 Pindai QR / Pilih Meja
          </button>
        </div>
      ) : null}

      {/* Table Context Banner */}
      <header className="order-table-banner">
        <div className="table-banner-brand">
          <img src="/logo.png" alt="Logo Tepi Sawah" className="order-header-logo" />
          <div className="table-info">
            <div className="table-badge-row">
              <span
                className={`table-badge ${table === null ? "table-badge--unassigned" : ""}`}
                onClick={() => setScannerOpen(true)}
                role="button"
                tabIndex={0}
                title="Klik untuk memilih meja"
              >
                {table !== null
                  ? `${table.tableName} • ${table.tableCode}`
                  : "⚠️ Belum Ada Meja (Klik untuk scan)"}
              </span>
              {table !== null ? (
                <button
                  type="button"
                  className="btn-change-table"
                  onClick={() => setScannerOpen(true)}
                  title="Ganti Meja"
                >
                  🔄 Ganti
                </button>
              ) : null}
            </div>
            <h1 className="banner-title">Menu Santap Tepi Sawah</h1>
          </div>
        </div>
        <div className="table-actions">
          <button
            type="button"
            className="btn-scan-qr-header"
            onClick={() => setScannerOpen(true)}
            title="Buka Kamera Scanner QR"
          >
            📷 Scan QR
          </button>
          <button
            type="button"
            className="btn-call-service"
            onClick={handleCallWaiter}
          >
            Panggil Pelayan
          </button>
          <button
            type="button"
            className="btn-bill-service"
            onClick={handleRequestBill}
          >
            Minta Bill
          </button>
        </div>
      </header>

      {serviceNotice ? (
        <div className="service-alert-banner" role="alert">
          {serviceNotice}
        </div>
      ) : null}

      {/* Catalog states */}
      {error !== null ? (
        <div className="order-menu-list">
          <div className="menu-dish-card" role="alert">
            <div className="dish-details">
              <h3 className="dish-name">Tidak dapat memuat menu</h3>
              <p className="dish-desc">{error}</p>
              <div className="dish-bottom">
                <button type="button" className="btn-add-cart" onClick={() => void load()}>
                  Coba lagi
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : products === null ? (
        <p aria-live="polite">Memuat menu…</p>
      ) : (
        <>
          {/* Category Pills — live categories, in server order */}
          <div className="order-categories">
            <button
              type="button"
              className={`cat-pill ${selectedCategory === "SEMUA" ? "active" : ""}`}
              onClick={() => setSelectedCategory("SEMUA")}
            >
              Semua Menu
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`cat-pill ${selectedCategory === category.id ? "active" : ""}`}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Menu Dishes List */}
          <main className="order-menu-list">
            {filteredItems.map((item) => {
              const entry = cart[item.productId];
              const qty = entry?.quantity ?? 0;
              const requiredModifiers = item.modifiers.filter((m) => m.isRequired);
              const missingRequired = requiredModifiers.filter(
                (m) => !entry?.modifierIds.includes(m.modifierId),
              );
              return (
                <div key={item.productId} className="menu-dish-card">
                  <div className="dish-img">
                    {item.imageUrl ? (
                      <img
                        className="dish-img-art"
                        src={item.imageUrl}
                        alt={`Foto ${item.name}`}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="dish-img-art dish-img-art--fallback" aria-hidden="true" />
                    )}
                    {item.isAvailable ? null : (
                      <span className="dish-tag">Habis</span>
                    )}
                  </div>

                  <div className="dish-details">
                    <h3 className="dish-name">{item.name}</h3>
                    <p className="dish-desc">{item.description}</p>
                    {requiredModifiers.length > 0 ? (
                      <div className="dish-modifiers">
                        {requiredModifiers.map((modifier) => (
                          <label key={modifier.modifierId} className="dish-modifier">
                            <input
                              type="checkbox"
                              checked={entry?.modifierIds.includes(modifier.modifierId) ?? false}
                              onChange={() =>
                                toggleModifier(item.productId, modifier.modifierId)
                              }
                            />
                            <span>
                              {modifier.name}
                              {modifier.priceDelta > 0
                                ? ` (+${formatIDR(modifier.priceDelta)})`
                                : ""}{' '}
                              (wajib)
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                    <div className="dish-bottom">
                      <span className="dish-price">{formatIDR(item.price)}</span>

                      {item.isAvailable ? (
                        qty === 0 ? (
                          <button
                            type="button"
                            className="btn-add-cart"
                            disabled={missingRequired.length > 0}
                            title={
                              missingRequired.length > 0
                                ? `Pilih ${missingRequired.map((m) => m.name).join(", ")} dulu`
                                : undefined
                            }
                            onClick={() => addToCart(item.productId)}
                          >
                            + Tambah
                          </button>
                        ) : (
                          <div className="qty-counter">
                            <button
                              type="button"
                              className="btn-counter minus"
                              onClick={() => removeFromCart(item.productId)}
                              aria-label="Kurangi jumlah"
                            >
                              −
                            </button>
                            <span className="counter-val">{qty}</span>
                            <button
                              type="button"
                              className="btn-counter plus"
                              disabled={missingRequired.length > 0}
                              title={
                                missingRequired.length > 0
                                  ? `Pilih ${missingRequired.map((m) => m.name).join(", ")} dulu`
                                  : undefined
                              }
                              onClick={() => addToCart(item.productId)}
                              aria-label="Tambah jumlah"
                            >
                              +
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="dish-price" aria-disabled="true">
                          Stok habis
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </main>
        </>
      )}

      {/* Persistent Floating Cart Footer */}
      {totalItems > 0 ? (
        <div className="order-cart-bar">
          <div className="cart-summary">
            <span className="cart-items-count">
              {totalItems} Menu Dipilih
            </span>
            <span className="cart-total-price">{formatIDR(totalPrice)}</span>
          </div>
          <button
            type="button"
            className="btn-checkout"
            onClick={handleOpenCart}
          >
            Lihat Keranjang →
          </button>
        </div>
      ) : null}

      <CartDrawer
        open={drawerOpen}
        lines={drawerLines}
        customerNote={customerNoteValue}
        onClose={handleCloseCart}
        onIncrement={(productId) => applyCart((prev) => incrementEntry(prev, productId))}
        onDecrement={(productId) => applyCart((prev) => decrementEntry(prev, productId))}
        onRemove={(productId) => applyCart((prev) => removeEntry(prev, productId))}
        onItemNoteChange={(productId, notes) =>
          applyCart((prev) => setEntryNote(prev, productId, notes))
        }
        onCustomerNoteChange={applyCustomerNote}
        onCheckout={handleCheckout}
      />

      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onTableSelected={(tableCode, token) => {
          setScannerOpen(false);
          onSelectTable?.(tableCode, token);
        }}
      />
    </div>
  );
}
