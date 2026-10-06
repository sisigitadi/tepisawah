/**
 * @tepisawah/web — restaurant gallery & documentation dataset.
 *
 * Persisted in browser localStorage (`tepisawah_restaurant_gallery`)
 * so changes made from the Admin Console immediately sync to the Public Website.
 */

export interface GalleryItem {
  id: string;
  imageUrl: string;
  kicker: string;
  title: string;
  desc: string;
  tall?: boolean;
}

export const STORAGE_KEY_GALLERY = "tepisawah_restaurant_gallery";

export const DEFAULT_GALLERY_ITEMS: GalleryItem[] = [
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

export function loadGallery(): GalleryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GALLERY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback to default
  }
  return DEFAULT_GALLERY_ITEMS;
}

export function saveGallery(items: GalleryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_GALLERY, JSON.stringify(items));
    window.dispatchEvent(new Event("tepisawah_gallery_updated"));
  } catch (err) {
    console.error("Failed to save gallery items:", err);
  }
}
