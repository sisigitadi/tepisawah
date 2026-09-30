/**
 * @tepisawah/order — Home page (Customer QR Ordering & Digital Menu Experience).
 *
 * Implements mobile-first ordering flow adhering to docs/design/MASTER_DESIGN_SYSTEM.md §18:
 * - Table banner context
 * - Category filter pills
 * - Dish cards with imagery, price, and instant add-to-cart
 * - Floating persistent cart footer with item count and subtotal
 * - Call Waiter & Request Bill actions
 */
import { useState, type ReactNode } from "react";

interface MenuItem {
  id: string;
  name: string;
  category: "makanan" | "minuman" | "paket";
  price: number;
  description: string;
  tag?: string;
  image: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: "m-1",
    name: "Gurame Bakar Madu Pasundan",
    category: "makanan",
    price: 95000,
    description: "Gurame segar kolam alami dibakar dengan olesan madu hutan dan bumbu rempah Sunda.",
    tag: "Favorit",
    image: "🐟",
  },
  {
    id: "m-2",
    name: "Ayam Goreng Lengkuas Parahyangan",
    category: "makanan",
    price: 38000,
    description: "Ayam kampung ungkep empuk ditaburi parutan lengkuas garing harum.",
    image: "🍗",
  },
  {
    id: "m-3",
    name: "Nasi Liwet Kastrol Komplit",
    category: "makanan",
    price: 35000,
    description: "Nasi liwet gurih rempah serai, daun salam, ikan teri medan, dan petai segar.",
    tag: "Khas",
    image: "🍚",
  },
  {
    id: "m-4",
    name: "Karedok Leunca Pasundan",
    category: "makanan",
    price: 25000,
    description: "Sayuran segar mentah dengan bumbu kacang kencur khas Sunda otentik.",
    image: "🥗",
  },
  {
    id: "m-5",
    name: "Es Kelapa Jeruk Murni",
    category: "minuman",
    price: 22000,
    description: "Kelapa muda segar dipadukan perasan jeruk pontianak asli dan gula kelapa alami.",
    tag: "Segar",
    image: "🥥",
  },
  {
    id: "m-6",
    name: "Es Teh Manis Daun Sereh",
    category: "minuman",
    price: 15000,
    description: "Seduhan teh melati wangi dengan aroma batang sereh segar penyejuk dahaga.",
    image: "🍹",
  },
];

const formatIDR = (val: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);

export function HomePage(): ReactNode {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [serviceNotice, setServiceNotice] = useState<string | null>(null);

  const addToCart = (id: string) => {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const count = prev[id] || 0;
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
    setTimeout(() => setServiceNotice(null), 4000);
  };

  const handleRequestBill = () => {
    setServiceNotice("Permintaan tagihan telah diteruskan ke kasir.");
    setTimeout(() => setServiceNotice(null), 4000);
  };

  const filteredItems = selectedCategory === "all"
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
          <button type="button" className="btn-call-service" onClick={handleCallWaiter}>
            🔔 Panggil Pelayan
          </button>
          <button type="button" className="btn-bill-service" onClick={handleRequestBill}>
            🧾 Minta Bill
          </button>
        </div>
      </header>

      {serviceNotice && (
        <div className="service-alert-banner" role="alert">
          ✓ {serviceNotice}
        </div>
      )}

      {/* Category Pills */}
      <div className="order-categories">
        <button
          type="button"
          className={`cat-pill ${selectedCategory === "all" ? "active" : ""}`}
          onClick={() => setSelectedCategory("all")}
        >
          Semua Menu
        </button>
        <button
          type="button"
          className={`cat-pill ${selectedCategory === "makanan" ? "active" : ""}`}
          onClick={() => setSelectedCategory("makanan")}
        >
          🍛 Masakan & Lauk
        </button>
        <button
          type="button"
          className={`cat-pill ${selectedCategory === "minuman" ? "active" : ""}`}
          onClick={() => setSelectedCategory("minuman")}
        >
          🍹 Minuman Segar
        </button>
      </div>

      {/* Menu Dishes List */}
      <main className="order-menu-list">
        {filteredItems.map((item) => {
          const qty = cart[item.id] || 0;
          return (
            <div key={item.id} className="menu-dish-card">
              <div className="dish-img-placeholder">
                <span className="dish-icon">{item.image}</span>
                {item.tag && <span className="dish-tag">{item.tag}</span>}
              </div>

              <div className="dish-details">
                <h3 className="dish-name">{item.name}</h3>
                <p className="dish-desc">{item.description}</p>
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
                      >
                        -
                      </button>
                      <span className="counter-val">{qty}</span>
                      <button
                        type="button"
                        className="btn-counter plus"
                        onClick={() => addToCart(item.id)}
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
      {totalItems > 0 && (
        <div className="order-cart-bar">
          <div className="cart-summary">
            <span className="cart-items-count">{totalItems} Menu Dipilih</span>
            <span className="cart-total-price">{formatIDR(totalPrice)}</span>
          </div>
          <button
            type="button"
            className="btn-checkout"
            onClick={() => alert(`Pesanan (${totalItems} menu) berhasil dikirim ke dapur!`)}
          >
            Kirim ke Dapur ➔
          </button>
        </div>
      )}
    </div>
  );
}
