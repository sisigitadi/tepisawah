/**
 * @tepisawah/web — restaurant atmosphere & documentation gallery.
 *
 * Displays real photographs of Tepi Sawah (saung lesehan, rooftop senja,
 * signature dishes, and family gathering spaces).
 * Synchronized live with the Admin Console via `useGallery()`.
 */
import type { ReactNode } from "react";
import { Icon } from "../../../components/icons.js";
import { useGallery } from "../../../hooks/useGallery.js";

export function Gallery(): ReactNode {
  const photos = useGallery();

  return (
    <section id="galeri" className="web-shell web-section">
      <div className="web-menu-head">
        <div>
          <span className="web-eyebrow">Dokumentasi Restoran</span>
          <h2 className="web-section-title">Galeri Suasana Tepi Sawah</h2>
          <p className="web-menu-head-sub">
            Potret sudut asri, panorama persawahan hijau Ciperna, dan hidangan favorit otentik.
          </p>
        </div>
        <span className="web-gallery-where">
          <Icon name="camera" size={16} />
          <span>Ciperna, Cirebon</span>
        </span>
      </div>

      <div className="web-gallery">
        {photos.map((photo) => (
          <figure
            key={photo.id || photo.title}
            className="web-gphoto"
            data-tall={photo.tall ? "true" : "false"}
          >
            <img
              src={photo.imageUrl}
              alt={photo.title}
              className="web-gphoto-img"
              loading="lazy"
            />
            <div className="web-gphoto-veil" />
            <figcaption className="web-gphoto-cap">
              <span className="web-gphoto-kicker">{photo.kicker}</span>
              <strong className="web-gphoto-title">{photo.title}</strong>
              {photo.desc ? (
                <p className="web-gphoto-desc">{photo.desc}</p>
              ) : null}
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
            Dokumentasikan momen santap hangat dan siluet senja sawah bersama kami di Ciperna.
          </p>
        </div>
        <a
          className="web-btn web-btn-forest"
          href="https://instagram.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="camera" size={16} />
          <span>Instagram @tepisawah</span>
        </a>
      </div>
    </section>
  );
}
