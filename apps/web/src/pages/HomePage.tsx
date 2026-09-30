/**
 * @tepisawah/web — Public Website Home Page.
 *
 * Implements the editorial, natural brand character from Master Design System v1.0
 * (forest green, warm cream, natural Sundanese atmosphere, and clear menu/QR actions).
 */
import type { ReactNode } from "react";

export function HomePage(): ReactNode {
  return (
    <div className="web-container">
      {/* Top Brand Navigation */}
      <nav className="web-navbar">
        <div className="web-brand">
          <span className="brand-logo-text">Tepi Sawah</span>
          <span className="brand-tagline">Resto & Cafe</span>
        </div>
        <div className="web-nav-links">
          <a href="#tentang" className="nav-item">Tentang</a>
          <a href="#menu" className="nav-item">Menu Favorit</a>
          <a href="#suasana" className="nav-item">Suasana</a>
          <a href="#lokasi" className="nav-item">Lokasi</a>
          <a href="/order/" className="nav-btn-order">Pesan di Meja (QR)</a>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="web-hero">
        <div className="hero-content">
          <span className="hero-badge">Cita Rasa Otentik & Nuansa Alami</span>
          <h1 className="hero-title">Santap Hangat di Tepian Sawah Pasundan</h1>
          <p className="hero-description">
            Nikmati kelezatan masakan khas Sunda dengan panorama hamparan sawah hijau dan gemericik air alami yang menyejukkan jiwa keluarga Anda.
          </p>
          <div className="hero-actions">
            <a href="/order/" className="btn-primary">Pesan Menu Sekarang</a>
            <a href="#menu" className="btn-secondary">Lihat Menu Lengkap</a>
          </div>
        </div>
      </header>

      {/* Highlights / Features */}
      <section id="tentang" className="web-features">
        <div className="feature-item">
          <div className="feature-icon">🌿</div>
          <h3>Suasana Alami Asri</h3>
          <p>Gazebo dan saung lesehan langsung menghadap pemandangan sawah alami.</p>
        </div>
        <div className="feature-item">
          <div className="feature-icon">🐟</div>
          <h3>Bahan Segar Berkualitas</h3>
          <p>Gurame hidup, sayuran kebun lokal, dan sambal ulek segar setiap hari.</p>
        </div>
        <div className="feature-item">
          <div className="feature-icon">📱</div>
          <h3>Pemesanan Digital Cepat</h3>
          <p>Scan QR code di meja untuk memesan dan memantau status masakan secara realtime.</p>
        </div>
      </section>

      {/* Menu Showcase */}
      <section id="menu" className="web-menu-section">
        <div className="section-header">
          <span className="section-subtitle">Pilihan Istimewa</span>
          <h2 className="section-heading">Menu Andalan Tepi Sawah</h2>
        </div>
        <div className="menu-cards-grid">
          <div className="menu-card">
            <div className="menu-tag">Terfavorit</div>
            <h3>Gurame Bakar Madu Pasundan</h3>
            <p>Ikan gurame bakar bumbu rempah madu alami, disajikan dengan lalapan segar dan sambal terasi dadak.</p>
            <div className="menu-price">Rp 85.000</div>
          </div>

          <div className="menu-card">
            <div className="menu-tag">Spesial Keluarga</div>
            <h3>Nasi Liwet Kastrol Komplit</h3>
            <p>Nasi liwet wangi daun salam, serai, teri medan, disajikan dengan ayam goreng lengkuas dan tahu tempe bacem.</p>
            <div className="menu-price">Rp 65.000</div>
          </div>

          <div className="menu-card">
            <div className="menu-tag">Tradisional</div>
            <h3>Ayam Bakar Bumbu Rujak</h3>
            <p>Ayam pejantan empuk dengan marinasi rempah kelapa pedas manis gurih khas Jawa Barat.</p>
            <div className="menu-price">Rp 42.000</div>
          </div>

          <div className="menu-card">
            <div className="menu-tag">Minuman Segar</div>
            <h3>Es Kelapa Muda Jeruk Kasturi</h3>
            <p>Kelapa muda murni dengan perasan jeruk kasturi segar dan gula aren organik.</p>
            <div className="menu-price">Rp 22.000</div>
          </div>
        </div>
      </section>

      {/* Location & Info */}
      <footer id="lokasi" className="web-footer">
        <div className="footer-content">
          <div className="footer-col">
            <h3>Tepi Sawah Resto & Cafe</h3>
            <p>Kawasan Wisata Alam & Kuliner Sunda Tradisional.</p>
            <p>Buka Setiap Hari: 10.00 – 21.00 WIB</p>
          </div>
          <div className="footer-col">
            <h4>Layanan Digital</h4>
            <p>• Pemesanan Meja QR</p>
            <p>• POS Kasir Terintegrasi</p>
            <p>• Pembayaran QRIS & Tunai</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 Tepi Sawah Resto & Cafe. Hak Cipta Dilindungi.</p>
        </div>
      </footer>
    </div>
  );
}
