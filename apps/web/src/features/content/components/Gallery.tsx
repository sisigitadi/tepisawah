/**
 * @tepisawah/web — atmosphere gallery.
 *
 * Reference photos are CDN-blocked offline, so the grid uses illustrated
 * gradient tiles themed per subject; copy mirrors the reference exactly.
 */
import type { ReactNode } from "react";
import { Icon, type IconName } from "../../../components/icons.js";

const PHOTOS: ReadonlyArray<{
  icon: IconName;
  kicker: string;
  title: string;
  hue: string;
  tall?: boolean;
}> = [
  {
    icon: "cloud-sun",
    kicker: "Suasana Luar Ruang",
    title: "Panorama Sawah Hijau Ciperna",
    hue: "linear-gradient(150deg,#2E6B34,#183A1D)",
    tall: true,
  },
  {
    icon: "utensils",
    kicker: "Hidangan Utama",
    title: "Chicken Roaster Rempah",
    hue: "linear-gradient(150deg,#8C5A2B,#3D1F10)",
  },
  {
    icon: "fish",
    kicker: "Kuliner Nusantara",
    title: "Gurame Bakar Madu Pedas Manis",
    hue: "linear-gradient(150deg,#B4531F,#7A2E12)",
  },
  {
    icon: "leaf",
    kicker: "Sajian Khas",
    title: "Nasi Liwet Tradisional Santan",
    hue: "linear-gradient(150deg,#C9A227,#2E6B34)",
  },
  {
    icon: "coffee",
    kicker: "Coffee Destination",
    title: "Kopi Senja Sawah Gula Aren",
    hue: "linear-gradient(150deg,#8B5E3C,#3D1F10)",
  },
  {
    icon: "sun",
    kicker: "Minuman Segar",
    title: "Es Kelapa Jeruk Asli",
    hue: "linear-gradient(150deg,#5DADE2,#1B6E8C)",
    tall: true,
  },
];

export function Gallery(): ReactNode {
  return (
    <section id="galeri" className="web-shell web-section">
      <div className="web-menu-head">
        <div>
          <span className="web-eyebrow">Dokumentasi Restoran</span>
          <h2 className="web-section-title">Galeri Suasana Tepi Sawah</h2>
          <p className="web-menu-head-sub">
            Potret sudut asri, panorama persawahan hijau, dan hidangan favorit.
          </p>
        </div>
        <span className="web-gallery-where">
          <Icon name="camera" size={16} />
          <span>Ciperna, Cirebon</span>
        </span>
      </div>

      <div className="web-gallery">
        {PHOTOS.map((photo) => (
          <figure
            key={photo.title}
            className="web-gphoto"
            data-tall={photo.tall ? "true" : "false"}
            style={{ backgroundImage: photo.hue }}
          >
            <div className="web-gphoto-veil" />
            <Icon
              name={photo.icon}
              size={64}
              strokeWidth={1.2}
              className="web-gphoto-glyph"
            />
            <figcaption className="web-gphoto-cap">
              <span className="web-gphoto-kicker">{photo.kicker}</span>
              <span className="web-gphoto-title">{photo.title}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="web-social">
        <div className="web-social-copy">
          <h3 className="web-social-title">
            Bagikan Pengalaman Anda di Tepi Sawah
          </h3>
          <p className="web-social-sub">
            Tag kami dalam foto kebersamaan Anda saat menikmati suasana sawah di
            Ciperna.
          </p>
        </div>
        <a
          className="web-btn web-btn-forest"
          href="https://instagram.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="instagram" size={16} />
          <span>Ikuti di Instagram</span>
        </a>
      </div>
    </section>
  );
}
