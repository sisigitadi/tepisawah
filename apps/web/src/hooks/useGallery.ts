import { useEffect, useState } from "react";
import { loadGallery, type GalleryItem } from "../data/gallery.js";

export function useGallery(): GalleryItem[] {
  const [items, setItems] = useState<GalleryItem[]>(() => loadGallery());

  useEffect(() => {
    function handleUpdate() {
      setItems(loadGallery());
    }

    window.addEventListener("tepisawah_gallery_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("tepisawah_gallery_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  return items;
}
