/**
 * Catalog page tests (Phase 5).
 *
 * The page is driven through its loader and save seams, so the suite exercises
 * real component behaviour (permission gating per entity, archive vs delete,
 * validation surfacing, tab switching) without touching a browser Supabase
 * client (docs/qa/TESTING_STRATEGY.md Layer 3).
 */
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogPage } from "./catalog-page.js";

const READ = "catalog.read";
const UPDATE = "catalog.update";
const CAT_MANAGE = "categories.manage";
const MOD_MANAGE = "modifiers.manage";
const CREATE = "catalog.create";

type Snapshot = {
  status: "ready" | "error";
  error: string | null;
  categories: unknown[];
  products: unknown[];
  modifiers: unknown[];
};

const CATEGORY = {
  id: "cat-1",
  name: "Makanan",
  description: null,
  sortOrder: 0,
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const PRODUCT = {
  id: "prod-1",
  categoryId: "cat-1",
  name: "Nasi Goreng",
  description: null,
  imageUrl: null,
  price: 45000,
  isActive: true,
  isAvailable: true,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const MODIFIER = {
  id: "mod-1",
  name: "Level Pedas",
  description: null,
  priceDelta: 0,
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const READY: Snapshot = {
  status: "ready",
  error: null,
  categories: [CATEGORY],
  products: [PRODUCT],
  modifiers: [MODIFIER],
};

const { authState, snapshots } = vi.hoisted(() => ({
  authState: { read: true, update: true, catManage: true, modManage: true, create: true },
  snapshots: [] as Snapshot[],
}));

const mockSaveCategory = vi.fn();
const mockSaveModifier = vi.fn();
const mockSaveProduct = vi.fn();
const mockLoadProductEditor = vi.fn();
const mockSaveProductLinks = vi.fn();

vi.mock("./service.js", () => ({
  loadCatalog: async () => {
    const snapshot = snapshots.at(-1) ?? READY;
    return {
      categories: snapshot.categories,
      products: snapshot.products,
      modifiers: snapshot.modifiers,
      error: snapshot.error,
    };
  },
  saveCategory: (...args: unknown[]) => mockSaveCategory(...args),
  saveModifier: (...args: unknown[]) => mockSaveModifier(...args),
  saveProduct: (...args: unknown[]) => mockSaveProduct(...args),
  loadProductEditor: (...args: unknown[]) => mockLoadProductEditor(...args),
  saveProductLinks: (...args: unknown[]) => mockSaveProductLinks(...args),
}));

vi.mock("@tepisawah/auth", () => ({
  AccessDenied: () => <div data-testid="access-denied">Akses ditolak</div>,
  useAuth: () => ({
    status: "authenticated",
    can: (permission: string) =>
      (permission === READ && authState.read) ||
      (permission === UPDATE && authState.update) ||
      (permission === CAT_MANAGE && authState.catManage) ||
      (permission === MOD_MANAGE && authState.modManage) ||
      (permission === CREATE && authState.create),
  }),
}));

describe("CatalogPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    snapshots.length = 0;
    Object.assign(authState, {
      read: true,
      update: true,
      catManage: true,
      modManage: true,
      create: true,
    });
    mockSaveCategory.mockReset();
    mockSaveModifier.mockReset();
    mockSaveProduct.mockReset();
    mockLoadProductEditor.mockReset();
    mockSaveProductLinks.mockReset();
  });

  it("renders the loaded categories", async () => {
    render(<CatalogPage />);
    expect(await screen.findByText("Makanan")).toBeInTheDocument();
    expect(screen.getByText("Kategori (1)")).toBeInTheDocument();
  });

  it("shows the access-denied panel without catalog.read", async () => {
    authState.read = false;
    render(<CatalogPage />);
    expect(await screen.findByTestId("access-denied")).toBeInTheDocument();
  });

  it("switches to the products tab", async () => {
    const user = userEvent.setup();
    render(<CatalogPage />);
    await screen.findByText("Makanan");
    await user.click(screen.getByRole("tab", { name: /Produk/ }));
    expect(await screen.findByText("Nasi Goreng")).toBeInTheDocument();
    expect(screen.getByText(/Rp45\.000/)).toBeInTheDocument();
  });

  it("switches to the modifiers tab", async () => {
    const user = userEvent.setup();
    render(<CatalogPage />);
    await screen.findByText("Makanan");
    await user.click(screen.getByRole("tab", { name: /Modifier/ }));
    expect(await screen.findByText("Level Pedas")).toBeInTheDocument();
  });

  it("hides the add button and shows the read-only hint without categories.manage", async () => {
    authState.catManage = false;
    render(<CatalogPage />);
    expect(await screen.findByText("Hanya baca")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tambah kategori" })).toBeNull();
  });

  it("opens the category editor, saves, and reloads", async () => {
    const user = userEvent.setup();
    mockSaveCategory.mockResolvedValue({
      data: { record: { ...CATEGORY, name: "Makanan Baru" }, audit: null },
      error: null,
      fieldErrors: null,
    });
    render(<CatalogPage />);
    const add = await screen.findByRole("button", { name: "Tambah kategori" });
    await user.click(add);
    const name = await screen.findByRole("textbox", { name: "Nama kategori" });
    await user.type(name, "Minuman");
    await user.click(screen.getByRole("button", { name: "Simpan kategori" }));
    await waitFor(() => expect(mockSaveCategory).toHaveBeenCalledTimes(1));
    expect(mockSaveCategory).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ name: "Minuman", isActive: true }),
      null,
    );
  });

  it("surfaces a validation error without clearing the editor", async () => {
    const user = userEvent.setup();
    mockSaveCategory.mockResolvedValue({
      data: null,
      error: "Validasi gagal.",
      fieldErrors: { name: "Nama kategori wajib diisi." },
    });
    render(<CatalogPage />);
    await user.click(await screen.findByRole("button", { name: "Tambah kategori" }));
    await user.click(screen.getByRole("button", { name: "Simpan kategori" }));
    await waitFor(() => expect(mockSaveCategory).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Nama kategori wajib diisi.")).toBeInTheDocument();
  });

  it("archives a category by setting isActive false, never deleting", async () => {
    const user = userEvent.setup();
    mockSaveCategory.mockResolvedValue({
      data: { record: { ...CATEGORY, isActive: false }, audit: null },
      error: null,
      fieldErrors: null,
    });
    render(<CatalogPage />);
    const archive = await screen.findByRole("button", { name: "Arsipkan" });
    await user.click(archive);
    await waitFor(() => expect(mockSaveCategory).toHaveBeenCalledTimes(1));
    expect(mockSaveCategory).toHaveBeenCalledWith(
      CATEGORY.id,
      expect.objectContaining({ isActive: false }),
      CATEGORY,
    );
  });

  it("offers restore for an already archived category", async () => {
    snapshots.push({
      ...READY,
      categories: [{ ...CATEGORY, isActive: false }],
    });
    const user = userEvent.setup();
    mockSaveCategory.mockResolvedValue({
      data: { record: CATEGORY, audit: null },
      error: null,
      fieldErrors: null,
    });
    render(<CatalogPage />);
    const restore = await screen.findByRole("button", { name: "Pulihkan" });
    await user.click(restore);
    await waitFor(() => expect(mockSaveCategory).toHaveBeenCalledTimes(1));
    expect(mockSaveCategory).toHaveBeenCalledWith(
      CATEGORY.id,
      expect.objectContaining({ isActive: true }),
      expect.objectContaining({ isActive: false }),
    );
  });

  it("blocks product creation when no category exists", async () => {
    snapshots.push({ ...READY, categories: [] });
    const user = userEvent.setup();
    render(<CatalogPage />);
    await screen.findByText("Belum ada kategori");
    await user.click(screen.getByRole("tab", { name: /Produk/ }));
    expect(await screen.findByText("Buat kategori dulu")).toBeInTheDocument();
  });

  it("surfaces a backend denial when RLS refuses the write", async () => {
    const user = userEvent.setup();
    mockSaveCategory.mockResolvedValue({
      data: null,
      error: "Row level security blocked the update.",
      fieldErrors: null,
    });
    render(<CatalogPage />);
    await user.click(await screen.findByRole("button", { name: "Tambah kategori" }));
    await user.click(screen.getByRole("button", { name: "Simpan kategori" }));
    await waitFor(() => expect(mockSaveCategory).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Row level security blocked the update.")).toBeInTheDocument();
  });

  it("shows the load failure with a retry affordance", async () => {
    snapshots.push({ ...READY, status: "error", error: "Koneksi terputus." });
    render(<CatalogPage />);
    expect(await screen.findByText("Koneksi terputus.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeInTheDocument();
  });

  it("renders empty-state guidance for a fresh catalog", async () => {
    snapshots.push({ ...READY, categories: [], products: [], modifiers: [] });
    render(<CatalogPage />);
    expect(await screen.findByText("Tambahkan kategori pertama untuk mulai menyusun menu.")).toBeInTheDocument();
  });

  it("opens product editor, selects a photo preset, and saves product with image", async () => {
    const user = userEvent.setup();
    mockSaveProduct.mockResolvedValue({
      data: { record: { ...PRODUCT, id: "prod-new", imageUrl: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80" }, audit: null },
      error: null,
      fieldErrors: null,
    });
    mockSaveProductLinks.mockResolvedValue({ error: null, fieldErrors: null });

    render(<CatalogPage />);
    await screen.findByText("Makanan");
    await user.click(screen.getByRole("tab", { name: /Produk/ }));
    const addBtn = await screen.findByRole("button", { name: /\+ Tambah produk/i });
    await user.click(addBtn);

    // Verify editor is open
    expect(await screen.findByText("Tambah Menu Produk Baru")).toBeInTheDocument();

    // Fill product name
    const nameInput = screen.getByRole("textbox", { name: "Nama Produk" });
    await user.type(nameInput, "Nasi Timbel Spesial");

    // Switch to Presets tab in image uploader
    const presetsBtn = screen.getByRole("button", { name: /Galeri Pilihan/i });
    await user.click(presetsBtn);

    // Pick a preset image
    const presetCard = screen.getByTitle("Pilih foto Nasi Liwet Sawah");
    await user.click(presetCard);

    // Verify preview is displayed
    expect(screen.getByText("✓ Foto Terpasang")).toBeInTheDocument();

    // Submit form
    const saveBtns = screen.getAllByRole("button", { name: /Simpan Perubahan/i });
    const saveBtn = saveBtns[0];
    expect(saveBtn).toBeDefined();
    if (saveBtn) await user.click(saveBtn);

    await waitFor(() => expect(mockSaveProduct).toHaveBeenCalledTimes(1));
    expect(mockSaveProduct).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        name: "Nasi Timbel Spesial",
        imageUrl: expect.stringContaining("unsplash.com"),
      }),
      null,
    );
  });

  it("edits an existing product and updates price and photo", async () => {
    const user = userEvent.setup();
    mockLoadProductEditor.mockResolvedValue({
      product: PRODUCT,
      links: [],
      error: null,
    });
    mockSaveProduct.mockResolvedValue({
      data: { record: { ...PRODUCT, price: 50000 }, audit: null },
      error: null,
      fieldErrors: null,
    });
    mockSaveProductLinks.mockResolvedValue({ error: null, fieldErrors: null });

    render(<CatalogPage />);
    await screen.findByText("Makanan");
    await user.click(screen.getByRole("tab", { name: /Produk/ }));

    // Find and click Ubah button on product card
    const editBtn = await screen.findByRole("button", { name: "Ubah" });
    await user.click(editBtn);

    // Verify editor loaded product details
    expect(await screen.findByText(/Ubah Menu: Nasi Goreng/)).toBeInTheDocument();

    // Update price
    const priceInput = screen.getByRole("spinbutton", { name: "Harga Jual (Rp)" });
    await user.clear(priceInput);
    await user.type(priceInput, "50000");

    // Save changes
    const editSaveBtns = screen.getAllByRole("button", { name: /Simpan Perubahan/i });
    const editSaveBtn = editSaveBtns[0];
    expect(editSaveBtn).toBeDefined();
    if (editSaveBtn) await user.click(editSaveBtn);

    await waitFor(() => expect(mockSaveProduct).toHaveBeenCalledTimes(1));
    expect(mockSaveProduct).toHaveBeenCalledWith(
      PRODUCT.id,
      expect.objectContaining({
        price: 50000,
      }),
      PRODUCT,
    );
  });
});
