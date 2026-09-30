/**
 * @tepisawah/order — Home page (Customer QR Ordering & Digital Menu).
 *
 * Implements the mobile-first ordering flow per
 * docs/design/MASTER_DESIGN_SYSTEM.md §18: table context banner, category
 * pills, dish cards with illustrations, persistent cart footer, and
 * call-waiter / request-bill service actions.
 *
 * The catalog is imported from @tepisawah/ui so the items, prices, and
 * illustrations stay identical to the public website, POS, kitchen, and
 * waiter screens.
 */
import { useState, type ReactNode } from "react";
import {
  MENU_ITEMS,
  MENU_CATEGORIES,
  MENU_CATEGORY_LABEL,
  formatPrice,
  type MenuCategory,
  MenuImage,
} from "@tepisawah/ui";

const formatIDR = formatPrice;

export function HomePage(): ReactNode {
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory>("SEMUA");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [serviceNotice, setServiceNotice] = useState<string | null>(null);

  const addToCart = (id: string) => {
    setCart((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const count = prev[id] ?? 0;
      if (count <= 1) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: count - 1 };
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

  const filteredItems =
    selectedCategory === "SEMUA"
      ? MENU_ITEMS
      : MENU_ITEMS.filter((i) => i.category === selectedCategory);

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalPrice = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = MENU_ITEMS.find((m) => m.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  return (
    <div className="order-experience">
      {/* Table Context Banner */}
      <header className="order-table-banner">
        <div className="table-info">
          <span className="table-badge">Meja 04 • Gazebo B</span>
          <h1 className="banner-title">Menu Santap Tepi Sawah</h1>
        </div>
        <div className="table-actions">
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

      {/* Category Pills */}
      <div className="order-categories">
        {MENU_CATEGORIES.map((value) => (
          <button
            key={value}
            type="button"
            className={`cat-pill ${selectedCategory === value ? "active" : ""}`}
            onClick={() => setSelectedCategory(value)}
          >
            {value === "SEMUA"
              ? "Semua Menu"
              : MENU_CATEGORY_LABEL[value]}
          </button>
        ))}
      </div>

      {/* Menu Dishes List */}
      <main className="order-menu-list">
        {filteredItems.map((item) => {
          const qty = cart[item.id] ?? 0;
          return (
            <div key={item.id} className="menu-dish-card">
              <div className="dish-img">
                <MenuImage id={item.id} className="dish-img-art" />
                {item.badge ? (
                  <span className="dish-tag">{item.badge}</span>
                ) : null}
              </div>

              <div className="dish-details">
                <h3 className="dish-name">{item.name}</h3>
                <p className="dish-desc">{item.desc}</p>
                <div className="dish-bottom">
                  <span className="dish-price">{formatIDR(item.price)}</span>

                  {qty === 0 ? (
                    <button
                      type="button"
                      className="btn-add-cart"
                      onClick={() => addToCart(item.id)}
                    >
                      + Tambah
                    </button>
                  ) : (
                    <div className="qty-counter">
                      <button
                        type="button"
                        className="btn-counter minus"
                        onClick={() => removeFromCart(item.id)}
                        aria-label="Kurangi jumlah"
                      >
                        −
                      </button>
                      <span className="counter-val">{qty}</span>
                      <button
                        type="button"
                        className="btn-counter plus"
                        onClick={() => addToCart(item.id)}
                        aria-label="Tambah jumlah"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </main>

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
            onClick={() =>
              setServiceNotice(`Pesanan (${totalItems} menu) berhasil dikirim ke dapur!`)
            }
          >
            Kirim ke Dapur →
          </button>
        </div>
      ) : null}
    </div>
  );
}
