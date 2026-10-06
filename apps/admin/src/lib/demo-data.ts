/**
 * @tepisawah/admin — in-memory demo dataset.
 *
 * Preview builds have no reachable backend, so the admin services fall back to
 * this seed. It mirrors the real schema shapes (`@tepisawah/database` admin
 * records) and stays in sync with the shared menu catalog in `@tepisawah/ui`, so
 * the names, prices and photographs an admin edits here are exactly what the
 * public site and the QR order app show.
 *
 * Writes mutate the exported arrays in place and are reflected on the next read,
 * which keeps the CRUD workflows honest in a preview (create a category, edit a
 * product, archive a table) without a database.
 */
import type {
  Category,
  Modifier,
  Product,
  ProductModifier,
} from "@tepisawah/database";
import type { RestaurantTable, TableQr } from "@tepisawah/database";
import type { RestaurantSettings, OperatingHours } from "@tepisawah/database";
import type { TableSession } from "@tepisawah/database";

const NOW = "2025-06-01T09:00:00Z";

export const demoCategories: Category[] = [
  {
    id: "cat-makanan",
    name: "Makanan Utama",
    description: "Menu utama khas Tepi Sawah",
    sortOrder: 1,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "cat-sayur",
    name: "Sayur & Sup",
    description: "Sayuran segar kebun sekitar sawah",
    sortOrder: 2,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "cat-minuman",
    name: "Minuman & Kopi",
    description: "Minuman segar dan kopi robusta lokal",
    sortOrder: 3,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

type SeedProduct = Omit<Product, "createdAt" | "updatedAt">;

const PRODUCT_SEED: SeedProduct[] = [
  {
    id: "chicken-roaster",
    categoryId: "cat-makanan",
    name: "Chicken Roaster Rempah",
    description:
      "Ayam panggang oven rempah spesial Tepi Sawah, empuk juicy beraroma rosemary, disajikan sambal terasi pedesaan.",
    imageUrl:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
    price: 85000,
    isActive: true,
    isAvailable: true,
    sortOrder: 1,
  },
  {
    id: "gurame-bakar",
    categoryId: "cat-makanan",
    name: "Gurame Bakar Madu",
    description:
      "Ikan gurame segar kolam air tawar dibakar dengan polesan madu hutan alami dan kecap rempah pedas manis.",
    imageUrl:
      "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&w=800&q=80",
    price: 95000,
    isActive: true,
    isAvailable: true,
    sortOrder: 2,
  },
  {
    id: "nasi-liwet",
    categoryId: "cat-makanan",
    name: "Nasi Liwet Sawah Komplit",
    description:
      "Nasi gurih santan rempah dilengkapi teri medan renyah, petai bakar, telur asin, ayam bumbu kuning, dan sambal terasi.",
    imageUrl:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80",
    price: 45000,
    isActive: true,
    isAvailable: true,
    sortOrder: 3,
  },
  {
    id: "ayam-goreng-lengkuas",
    categoryId: "cat-makanan",
    name: "Ayam Goreng Lengkuas",
    description:
      "Ayam kampung ungkep empuk ditaburi parutan lengkuas garing harum khas Parahyangan, disajikan hangat.",
    imageUrl:
      "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=80",
    price: 38000,
    isActive: true,
    isAvailable: false,
    sortOrder: 4,
  },
  {
    id: "sayur-asem",
    categoryId: "cat-sayur",
    name: "Sayur Asem Klaten",
    description:
      "Kuah asam jawa segar kaya cita rasa dengan labu siam, kacang panjang melinjo, jagung manis, dan kacang tanah gurih.",
    imageUrl:
      "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80",
    price: 25000,
    isActive: true,
    isAvailable: true,
    sortOrder: 5,
  },
  {
    id: "karedok-leunca",
    categoryId: "cat-sayur",
    name: "Karedok Leunca Segar",
    description:
      "Sayuran mentah segar dengan bumbu kacang kencur khas Sunda otentik, leunca pilihan, dan kerupuk kanji.",
    imageUrl:
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80",
    price: 25000,
    isActive: true,
    isAvailable: true,
    sortOrder: 6,
  },
  {
    id: "es-kelapa",
    categoryId: "cat-minuman",
    name: "Es Kelapa Jeruk Segar",
    description:
      "Kelapa muda keruk murni dipadu perasan jeruk manis alami berbulir, disajikan dingin penyejuk dahaga.",
    imageUrl:
      "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80",
    price: 18000,
    isActive: true,
    isAvailable: true,
    sortOrder: 7,
  },
  {
    id: "kopi-senja",
    categoryId: "cat-minuman",
    name: "Kopi Senja Sawah",
    description:
      "Espresso robusta lokal dipadu susu aren kental creamy berlapis es batu segar dengan aroma biji sangrai pedesaan.",
    imageUrl:
      "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=800&q=80",
    price: 28000,
    isActive: true,
    isAvailable: true,
    sortOrder: 8,
  },
];

export const demoProducts: Product[] = PRODUCT_SEED.map((seed) => ({
  ...seed,
  createdAt: NOW,
  updatedAt: NOW,
}));

export const demoModifiers: Modifier[] = [
  {
    id: "mod-pedas",
    name: "Level Pedas",
    description: "Tingkat kepedasan sambal",
    priceDelta: 0,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "mod-nasi-tambah",
    name: "Nasi Tambah",
    description: "Porsi nasi ekstra",
    priceDelta: 8000,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "mod-keju",
    name: "Keju Parut",
    description: "Topping keju untuk minuman",
    priceDelta: 6000,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export const demoProductModifiers: ProductModifier[] = [
  {
    productId: "chicken-roaster",
    modifierId: "mod-pedas",
    isRequired: false,
    minSelect: 0,
    maxSelect: 1,
    sortOrder: 1,
    createdAt: NOW,
  },
  {
    productId: "gurame-bakar",
    modifierId: "mod-pedas",
    isRequired: false,
    minSelect: 0,
    maxSelect: 1,
    sortOrder: 1,
    createdAt: NOW,
  },
  {
    productId: "nasi-liwet",
    modifierId: "mod-nasi-tambah",
    isRequired: false,
    minSelect: 0,
    maxSelect: 1,
    sortOrder: 1,
    createdAt: NOW,
  },
  {
    productId: "kopi-senja",
    modifierId: "mod-keju",
    isRequired: false,
    minSelect: 0,
    maxSelect: 1,
    sortOrder: 1,
    createdAt: NOW,
  },
];

const TABLE_SEED: Array<
  Pick<RestaurantTable, "id" | "tableCode" | "name" | "capacity" | "status">
> = [
  { id: "tbl-a1", tableCode: "A1", name: "Meja A1", capacity: 4, status: "AVAILABLE" },
  { id: "tbl-a2", tableCode: "A2", name: "Meja A2", capacity: 4, status: "OCCUPIED" },
  { id: "tbl-a3", tableCode: "A3", name: "Meja A3", capacity: 6, status: "AVAILABLE" },
  { id: "tbl-b1", tableCode: "B1", name: "Meja B1", capacity: 2, status: "WAITING_SERVICE" },
  { id: "tbl-b2", tableCode: "B2", name: "Meja B2", capacity: 2, status: "WAITING_PAYMENT" },
  { id: "tbl-c1", tableCode: "C1", name: "Meja C1 (Saung)", capacity: 8, status: "AVAILABLE" },
];

export const demoTables: RestaurantTable[] = TABLE_SEED.map((seed) => ({
  ...seed,
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
}));

const REAL_TOKENS_BY_CODE: Record<string, string> = {
  A1: "dev-qr-a1-000000000000000000000001",
  A2: "10a573dea4fc5ab109773a84473eb316d296d0de5a436fae",
  A3: "dev-qr-a3-000000000000000000000003",
  B1: "4b12140f98e0c39cbe54c5c50ab087f93a4bc7d2d41f6a24",
  B2: "134aba84d57f258448d9cb28fd3b0888683e57c8710b31f3",
  C1: "17c0f9b9f4b4b04d4c491b1fbc8d8d836c157c2ff9683798",
};

export const demoQrs: TableQr[] = TABLE_SEED.map((seed, index) => ({
  id: `qr-${seed.id}`,
  tableId: seed.id,
  token: REAL_TOKENS_BY_CODE[seed.tableCode] ?? `demo-token-${index + 1}-TepiSawah`,
  isActive: true,
  createdAt: NOW,
  expiresAt: null,
}));

export const demoSessions: TableSession[] = [
  {
    id: "ses-a2",
    tableId: "tbl-a2",
    status: "OPEN",
    openedAt: "2025-06-01T11:30:00Z",
    closedAt: null,
    openedBy: "Pramusaji Demo",
    closedBy: null,
    orderCount: 2,
    createdAt: "2025-06-01T11:30:00Z",
    updatedAt: NOW,
  },
  {
    id: "ses-b1",
    tableId: "tbl-b1",
    status: "OPEN",
    openedAt: "2025-06-01T12:05:00Z",
    closedAt: null,
    openedBy: "Pramusaji Demo",
    closedBy: null,
    orderCount: 1,
    createdAt: "2025-06-01T12:05:00Z",
    updatedAt: NOW,
  },
  {
    id: "ses-a1",
    tableId: "tbl-a1",
    status: "CLOSED",
    openedAt: "2025-05-31T18:00:00Z",
    closedAt: "2025-05-31T20:15:00Z",
    openedBy: "Pramusaji Demo",
    closedBy: "Kasir Demo",
    orderCount: 3,
    createdAt: "2025-05-31T18:00:00Z",
    updatedAt: "2025-05-31T20:15:00Z",
  },
];

export const demoSettings: RestaurantSettings = {
  id: "set-restaurant",
  restaurantName: "Tepi Sawah",
  address: "Jl. Raya Sawah No. 12, Kabupaten Bandung Barat",
  phone: "+62 812 3456 7890",
  email: "halo@tepisawah.id",
  timezone: "Asia/Jakarta",
  currency: "IDR",
  logoUrl: "/logo.png",
  primaryColor: "#2E6B34",
  createdAt: NOW,
  updatedAt: NOW,
};

export const demoHours: OperatingHours[] = [
  { id: "hrs-0", dayOfWeek: 0, isClosed: false, openTime: "09:00:00", closeTime: "21:00:00", createdAt: NOW, updatedAt: NOW },
  { id: "hrs-1", dayOfWeek: 1, isClosed: true, openTime: null, closeTime: null, createdAt: NOW, updatedAt: NOW },
  { id: "hrs-2", dayOfWeek: 2, isClosed: false, openTime: "11:00:00", closeTime: "21:00:00", createdAt: NOW, updatedAt: NOW },
  { id: "hrs-3", dayOfWeek: 3, isClosed: false, openTime: "11:00:00", closeTime: "21:00:00", createdAt: NOW, updatedAt: NOW },
  { id: "hrs-4", dayOfWeek: 4, isClosed: false, openTime: "11:00:00", closeTime: "22:00:00", createdAt: NOW, updatedAt: NOW },
  { id: "hrs-5", dayOfWeek: 5, isClosed: false, openTime: "09:00:00", closeTime: "22:00:00", createdAt: NOW, updatedAt: NOW },
  { id: "hrs-6", dayOfWeek: 6, isClosed: false, openTime: "09:00:00", closeTime: "22:00:00", createdAt: NOW, updatedAt: NOW },
];

/** Fresh-ish timestamp for records created during a preview session. */
export function demoTimestamp(): string {
  return new Date().toISOString();
}
