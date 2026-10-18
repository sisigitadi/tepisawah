/**
 * @tepisawah/admin — Product Image Uploader component.
 *
 * Implements a modern image management experience:
 * 1. Local file upload (drag & drop / file picker with instant preview)
 * 2. Curated restaurant photo presets (authentic Sundanese/Indonesian dishes)
 * 3. Direct URL input
 * 4. Image preview with remove / replace actions
 */
import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { Button, compressImageToWebP, type CompressionResult } from "@tepisawah/ui";

export interface PresetOption {
  readonly id: string;
  readonly name: string;
  readonly url: string;
}

export const PRESET_DISH_IMAGES: readonly PresetOption[] = [
  {
    id: "nasi-liwet",
    name: "Nasi Liwet Sawah",
    url: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "ayam-bakar",
    name: "Ayam Bakar Madu",
    url: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "pepes-ikan",
    name: "Pepes Ikan Mas",
    url: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "gurame-goreng",
    name: "Gurame Goreng Kipas",
    url: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "sayur-asem",
    name: "Sayur Asem",
    url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "cah-kangkung",
    name: "Cah Kangkung Terasi",
    url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "es-kelapa",
    name: "Es Kelapa Muda",
    url: "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "teh-talas",
    name: "Teh Talas / Es Teh",
    url: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "kopi-sawah",
    name: "Kopi Tubruk Sawah",
    url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "sambal-lalap",
    name: "Sambal Terasi & Lalap",
    url: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "promo-paket-liwet",
    name: "[Promo] Paket Liwet Komplit",
    url: "/gallery/saung-lesehan.webp",
  },
  {
    id: "promo-gurame-bakar",
    name: "[Promo] Paket Gurame Bakar Madu",
    url: "/gallery/gurame-bakar.webp",
  },
  {
    id: "promo-roaster-rempah",
    name: "[Promo] Paket Roaster Rempah",
    url: "/gallery/ayam-roaster.webp",
  },
  {
    id: "promo-kopi-senja",
    name: "[Promo] Paket Ngopi Sunset",
    url: "/gallery/kopi-senja.webp",
  },
  {
    id: "promo-rombongan",
    name: "[Promo] Paket Rombongan Saung",
    url: "/gallery/rombongan-gathering.webp",
  },
];

export interface ImageUploaderProps {
  readonly imageUrl: string;
  readonly disabled?: boolean;
  readonly error?: string;
  readonly onChange: (url: string) => void;
}

export function ImageUploader({
  imageUrl,
  disabled = false,
  error,
  onChange,
}: ImageUploaderProps): ReactNode {
  const [mode, setMode] = useState<"upload" | "presets" | "url">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressionStats, setCompressionStats] = useState<CompressionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void processFile(file);
  };

  const processFile = async (file: File) => {
    setUploadError(null);
    setCompressionStats(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("Harap pilih file gambar (JPG, PNG, atau WebP).");
      return;
    }
    // Limit to 10MB input before compression
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Ukuran file maksimal 10MB.");
      return;
    }

    setCompressing(true);
    try {
      const result = await compressImageToWebP(file, {
        maxDimension: 1000,
        quality: 0.82,
      });
      setCompressionStats(result);
      onChange(result.dataUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Gagal mengompres gambar.");
    } finally {
      setCompressing(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled && !compressing) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || compressing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  return (
    <div className="image-uploader">
      <label className="image-uploader__label">Foto Menu Produk</label>

      {/* Current Image Preview */}
      {imageUrl ? (
        <div className="image-uploader__preview-box">
          <img
            src={imageUrl}
            alt="Pratinjau Foto Produk"
            className="image-uploader__preview-img"
          />
          <div className="image-uploader__preview-overlay">
            <span className="image-uploader__preview-badge">✓ Foto Terpasang</span>
            <div className="image-uploader__preview-actions">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
              >
                Ganti Foto
              </Button>
              <Button
                variant="danger"
                size="sm"
                type="button"
                disabled={disabled}
                onClick={() => onChange("")}
              >
                Hapus
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {compressionStats ? (
        <div
          className="image-uploader__stats-badge"
          style={{
            marginTop: "8px",
            marginBottom: "8px",
            padding: "6px 12px",
            background: "rgba(46, 107, 52, 0.12)",
            border: "1px solid #2e6b34",
            borderRadius: "6px",
            color: "#2e6b34",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>✓</span>
          <span>
            Terkonversi ke WebP: {(compressionStats.originalSize / 1024).toFixed(0)} KB → {(compressionStats.compressedSize / 1024).toFixed(0)} KB (hemat {compressionStats.savedPercent}%)
          </span>
        </div>
      ) : null}

      {/* Mode Switcher Tabs */}
      <div className="image-uploader__mode-bar">
        <button
          type="button"
          className={`image-uploader__mode-btn ${mode === "upload" ? "active" : ""}`}
          onClick={() => setMode("upload")}
        >
          📤 Upload File
        </button>
        <button
          type="button"
          className={`image-uploader__mode-btn ${mode === "presets" ? "active" : ""}`}
          onClick={() => setMode("presets")}
        >
          🖼️ Galeri Pilihan
        </button>
        <button
          type="button"
          className={`image-uploader__mode-btn ${mode === "url" ? "active" : ""}`}
          onClick={() => setMode("url")}
        >
          🔗 Input URL
        </button>
      </div>

      {/* Mode 1: File Upload & Drag-Drop */}
      {mode === "upload" && (
        <div
          className={`image-uploader__dropzone ${isDragging ? "dragging" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            className="image-uploader__file-input"
            disabled={disabled}
            onChange={handleFileChange}
          />
          <div className="image-uploader__dropzone-content">
            <span className="image-uploader__icon">{compressing ? "⏳" : "📁"}</span>
            <strong>
              {compressing ? "Mengompresi ke format WebP..." : "Pilih file foto atau seret ke sini"}
            </strong>
            <p className="image-uploader__sub">
              {compressing
                ? "Memperkecil dimensi dan mengoptimalkan gambar agar hemat storage..."
                : "Format JPG, PNG, atau WebP (otomatis dioptimasi ke WebP < 100 KB)"}
            </p>
            <Button variant="secondary" size="sm" type="button" disabled={disabled || compressing}>
              {compressing ? "Memproses..." : "Pilih dari Komputer"}
            </Button>
          </div>
        </div>
      )}

      {/* Mode 2: Preset Gallery */}
      {mode === "presets" && (
        <div className="image-uploader__presets-grid">
          {PRESET_DISH_IMAGES.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`image-uploader__preset-card ${imageUrl === preset.url ? "selected" : ""}`}
              onClick={() => onChange(preset.url)}
              disabled={disabled}
              title={`Pilih foto ${preset.name}`}
            >
              <img
                src={preset.url}
                alt={preset.name}
                className="image-uploader__preset-img"
                loading="lazy"
              />
              <span className="image-uploader__preset-name">{preset.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Mode 3: Direct URL */}
      {mode === "url" && (
        <div className="image-uploader__url-box">
          <input
            type="url"
            className="ui-input__field"
            placeholder="https://images.unsplash.com/... atau tautan CDN"
            value={imageUrl}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="image-uploader__hint">
            Gunakan URL gambar publik yang aman (HTTPS)
          </span>
        </div>
      )}

      {(uploadError || error) && (
        <p className="ui-input__error" role="alert">
          {uploadError || error}
        </p>
      )}
    </div>
  );
}
