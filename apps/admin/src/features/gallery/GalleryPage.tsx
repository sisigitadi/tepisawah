/**
 * @tepisawah/admin — Restaurant Gallery & Documentation Management.
 *
 * Allows owners and administrators to manage the documentation photos,
 * titles, categories, and descriptions displayed on the public website.
 * Changes are synchronized instantly via localStorage and broadcast events.
 */
import { useState, type ReactNode } from "react";

export interface AdminGalleryItem {
  id: string;
  imageUrl: string;
  kicker: string;
  title: string;
  desc: string;
  tall?: boolean;
}

const STORAGE_KEY_GALLERY = "tepisawah_restaurant_gallery";

const PRESET_REAL_PHOTOS = [
  {
    name: "Saung Lesehan Sisi Pematang",
    url: "/gallery/saung-lesehan.jpg",
    kicker: "Suasana Luar Ruang",
  },
  {
    name: "Dek Rooftop Senja 360°",
    url: "/gallery/rooftop-senja.jpg",
    kicker: "Panorama 360°",
  },
  {
    name: "Chicken Roaster Rempah",
    url: "/gallery/ayam-roaster.jpg",
    kicker: "Signature Dish",
  },
  {
    name: "Gurame Bakar Madu Pedas Manis",
    url: "/gallery/gurame-bakar.jpg",
    kicker: "Favorit Keluarga",
  },
  {
    name: "Kopi Senja Sawah & Kudapan",
    url: "/gallery/kopi-senja.jpg",
    kicker: "Coffee & Beverage",
  },
  {
    name: "Gazebo Rombongan & Gathering",
    url: "/gallery/rombongan-gathering.jpg",
    kicker: "Ruang Acara & Rombongan",
  },
];

const DEFAULT_ITEMS: AdminGalleryItem[] = [
  {
    id: "gal-1",
    imageUrl: "/gallery/saung-lesehan.jpg",
    kicker: "Suasana Luar Ruang",
    title: "Saung Lesehan Sisi Pematang",
    desc: "Santap santai beratap rumbia alami tepat di sisi hamparan sawah hijau yang asri dan sejuk.",
    tall: true,
  },
  {
    id: "gal-2",
    imageUrl: "/gallery/ayam-roaster.jpg",
    kicker: "Signature Dish",
    title: "Chicken Roaster Rempah",
    desc: "Ayam panggang oven empuk berbumbu rempah rahasia Nusantara, disajikan dengan sambal terasi segar.",
  },
  {
    id: "gal-3",
    imageUrl: "/gallery/gurame-bakar.jpg",
    kicker: "Favorit Keluarga",
    title: "Gurame Bakar Madu Pedas Manis",
    desc: "Gurame segar berlapis kecap madu karamel dengan lalapan segar dan sambal kecap cabai rawit.",
  },
  {
    id: "gal-4",
    imageUrl: "/gallery/kopi-senja.jpg",
    kicker: "Coffee & Beverage",
    title: "Kopi Senja Sawah & Kudapan",
    desc: "Racikan kopi Nusantara hangat berdampingan dengan kudapan singkong goreng bertabur keju.",
  },
  {
    id: "gal-5",
    imageUrl: "/gallery/rombongan-gathering.jpg",
    kicker: "Ruang Acara & Rombongan",
    title: "Gazebo Keluarga & Acara",
    desc: "Area makan luas dan nyaman untuk gathering keluarga besar, reuni, dan rombongan wisata.",
  },
  {
    id: "gal-6",
    imageUrl: "/gallery/rooftop-senja.jpg",
    kicker: "Panorama 360°",
    title: "Dek Rooftop Senja Ciperna",
    desc: "Pemandangan matahari terbenam spektakuler di atas bentangan persawahan hijau Ciperna.",
    tall: true,
  },
];

function loadSavedItems(): AdminGalleryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GALLERY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return DEFAULT_ITEMS;
}

export function GalleryPage(): ReactNode {
  const [items, setItems] = useState<AdminGalleryItem[]>(() => loadSavedItems());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  function handleSave(updated = items) {
    try {
      localStorage.setItem(STORAGE_KEY_GALLERY, JSON.stringify(updated));
      window.dispatchEvent(new Event("tepisawah_gallery_updated"));
      setStatusMessage("✅ Perubahan galeri dokumentasi berhasil disimpan & tersinkron ke Public Website!");
      setTimeout(() => setStatusMessage(null), 4000);
    } catch {
      setStatusMessage("❌ Gagal menyimpan data galeri ke storage browser.");
    }
  }

  function handleReset() {
    if (window.confirm("Kembalikan seluruh foto galeri ke foto dokumentasi bawaan default?")) {
      setItems(DEFAULT_ITEMS);
      handleSave(DEFAULT_ITEMS);
    }
  }

  function handleAddItem() {
    const nextId = `gal-${Date.now()}`;
    const newItem: AdminGalleryItem = {
      id: nextId,
      imageUrl: "/gallery/saung-lesehan.jpg",
      kicker: "Dokumentasi Baru",
      title: "Sudut Favorit Tepi Sawah",
      desc: "Suasana nyaman di hamparan sawah hijau Ciperna.",
      tall: false,
    };
    const updated = [...items, newItem];
    setItems(updated);
    handleSave(updated);
  }

  function handleRemoveItem(id: string) {
    if (items.length <= 1) {
      alert("Minimal harus ada 1 foto dokumentasi di galeri.");
      return;
    }
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
    handleSave(updated);
  }

  function handleFieldChange(id: string, field: keyof AdminGalleryItem, value: any) {
    const updated = items.map((item) => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setItems(updated);
  }

  return (
    <div className="admin-gallery-page">
      <header className="overview-header">
        <div>
          <h1 className="overview-title">Dokumentasi &amp; Galeri Restoran</h1>
          <p className="overview-subtitle">
            Kelola foto suasana, panorama sawah, dan hidangan unggulan yang ditampilkan di Public Website (localhost:5180/#galeri).
          </p>
        </div>
        <div className="overview-actions">
          <button
            type="button"
            className="ui-button ui-button--secondary"
            onClick={handleReset}
          >
            🔄 Reset ke Default
          </button>
          <button
            type="button"
            className="ui-button ui-button--primary"
            onClick={handleAddItem}
          >
            ➕ Tambah Foto
          </button>
          <button
            type="button"
            className="ui-button ui-button--primary"
            style={{ backgroundColor: "#2e6b34" }}
            onClick={() => handleSave()}
          >
            💾 Simpan Perubahan
          </button>
        </div>
      </header>

      {statusMessage ? (
        <div
          role="alert"
          style={{
            padding: "0.85rem 1.25rem",
            marginBottom: "1.25rem",
            background: "#dcfce7",
            border: "1px solid #86efac",
            color: "#166534",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          {statusMessage}
        </div>
      ) : null}

      <div className="admin-gallery-grid">
        {items.map((item, index) => (
          <div key={item.id} className="admin-gallery-card">
            <div className="admin-gallery-thumb-wrap">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="admin-gallery-thumb"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/gallery/saung-lesehan.jpg";
                }}
              />
              <span className="admin-gallery-badge">#{index + 1}</span>
            </div>

            <div className="admin-gallery-form">
              <div className="admin-form-group">
                <label className="admin-form-label">Kategori / Kicker</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={item.kicker}
                  placeholder="Contoh: Suasana Luar Ruang"
                  onChange={(e) => handleFieldChange(item.id, "kicker", e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Judul Foto</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={item.title}
                  placeholder="Contoh: Saung Lesehan Sisi Pematang"
                  onChange={(e) => handleFieldChange(item.id, "title", e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Keterangan / Deskripsi Singkat</label>
                <textarea
                  className="admin-form-input"
                  rows={2}
                  value={item.desc}
                  placeholder="Deskripsi suasana..."
                  onChange={(e) => handleFieldChange(item.id, "desc", e.target.value)}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">URL Foto / Preset Restoran</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={item.imageUrl}
                  placeholder="/gallery/nama-foto.jpg atau URL online"
                  onChange={(e) => handleFieldChange(item.id, "imageUrl", e.target.value)}
                />

                <div className="admin-preset-chips">
                  <span style={{ fontSize: "0.75rem", color: "#666", width: "100%", marginBottom: "2px" }}>
                    Pilih Cepat Foto Resmi:
                  </span>
                  {PRESET_REAL_PHOTOS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      className={`admin-preset-chip ${item.imageUrl === preset.url ? "active" : ""}`}
                      onClick={() => {
                        handleFieldChange(item.id, "imageUrl", preset.url);
                        if (!item.kicker || item.kicker === "Dokumentasi Baru") {
                          handleFieldChange(item.id, "kicker", preset.kicker);
                        }
                      }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="admin-gallery-card-foot">
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(item.tall)}
                    onChange={(e) => handleFieldChange(item.id, "tall", e.target.checked)}
                  />
                  <span>Format Tinggi (Tall Tile)</span>
                </label>

                <button
                  type="button"
                  className="ui-button ui-button--danger ui-button--sm"
                  onClick={() => handleRemoveItem(item.id)}
                >
                  🗑️ Hapus
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
