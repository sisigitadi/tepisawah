/**
 * Catalog page (Phase 5 — CLINE_IMPLEMENTATION_PLAN.md §11).
 *
 * The admin view of the centralized menu source of truth: categories, products
 * and modifiers in one page with three tabs. Archival is soft (`is_active =
 * false`) — the database never grants DELETE on these tables, so an archived
 * row stays for historical integrity (DATABASE_SCHEMA.md §13-§15).
 *
 * The permission checks here are UX-only: every read and write is re-checked by
 * RLS server-side (AUTH_RBAC_RLS.md §47). A session with only `catalog.read`
 * gets the list and a read-only hint, never a working save button.
 */
import { AccessDenied, useAuth } from "@tepisawah/auth";
import { Button, Card, StatusBadge } from "@tepisawah/ui";
import { PERMISSIONS } from "@tepisawah/permissions";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import { loadCatalog, saveCategory, saveModifier, saveProduct } from "./service.js";
import type { CatalogSnapshot } from "./service.js";
import {
  EMPTY_CATEGORY_FORM,
  EMPTY_MODIFIER_FORM,
  toCategoryForm,
  toCategoryInput,
  toModifierForm,
  toModifierInput,
  toProductForm,
  toProductInput,
  useCatalogState,
  type CategoryForm,
  type LoaderResult,
  type ModifierForm,
} from "./use-catalog.js";
import { CategoryForm as CategoryFields } from "./category-form.js";
import { ModifierForm as ModifierFields } from "./modifier-form.js";
import { ProductEditor } from "./product-editor.js";

type Tab = "categories" | "products" | "modifiers";

interface Editing {
  kind: "category" | "product" | "modifier";
  /** null while creating. */
  id: string | null;
}

/** `loadCatalog` reports a failure inline; the loader hook needs a status field. */
function toLoaderResult(snapshot: CatalogSnapshot & { error: string | null }): LoaderResult {
  return {
    status: snapshot.error === null ? "ready" : "error",
    error: snapshot.error,
    categories: snapshot.categories,
    products: snapshot.products,
    modifiers: snapshot.modifiers,
  };
}

export function CatalogPage(): ReactNode {
  const { can } = useAuth();
  const canRead = can(PERMISSIONS.CATALOG_READ);
  const canManageProducts = can(PERMISSIONS.CATALOG_UPDATE);
  const canManageCategories = can(PERMISSIONS.CATEGORIES_MANAGE);
  const canManageModifiers = can(PERMISSIONS.MODIFIERS_MANAGE);

  const loader = useCallback(async (): Promise<LoaderResult> => {
    const snapshot = await loadCatalog();
    return toLoaderResult(snapshot);
  }, []);

  const { state, reload, setStatus } = useCatalogState(loader);
  const [tab, setTab] = useState<Tab>("categories");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryForm>(EMPTY_CATEGORY_FORM);
  const [modifierDraft, setModifierDraft] = useState<ModifierForm>(EMPTY_MODIFIER_FORM);
  const [errors, setErrors] = useState<Record<string, string> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!canRead) {
    return <AccessDenied />;
  }

  if (state.status === "loading" && state.categories.length === 0) {
    return <p aria-live="polite">Memuat katalog…</p>;
  }

  if (state.status === "error") {
    return (
      <Card elevation="low" title="Tidak dapat memuat katalog">
        <p role="alert">{state.error}</p>
        <Button variant="secondary" onClick={reload}>
          Coba lagi
        </Button>
      </Card>
    );
  }

  const startEdit = (next: Editing): void => {
    setEditing(next);
    setErrors(null);
    setMessage(null);
    if (next.kind === "category") {
      const current = next.id === null ? null : state.categories.find((row) => row.id === next.id) ?? null;
      setCategoryDraft(toCategoryForm(current));
    }
    if (next.kind === "modifier") {
      const current = next.id === null ? null : state.modifiers.find((row) => row.id === next.id) ?? null;
      setModifierDraft(toModifierForm(current));
    }
  };

  const cancel = (): void => {
    setEditing(null);
    setErrors(null);
    setMessage(null);
  };

  const submitCategory = async (): Promise<void> => {
    if (editing === null || editing.kind !== "category") return;
    setStatus({ status: "loading" });
    const current = editing.id === null ? null : state.categories.find((row) => row.id === editing.id) ?? null;
    const result = await saveCategory(editing.id, toCategoryInput(categoryDraft), current);
    setStatus({ status: "ready" });
    if (result.error) {
      setErrors(result.fieldErrors);
      setMessage(result.error);
      return;
    }
    cancel();
    await reload();
  };

  const submitModifier = async (): Promise<void> => {
    if (editing === null || editing.kind !== "modifier") return;
    setStatus({ status: "loading" });
    const current = editing.id === null ? null : state.modifiers.find((row) => row.id === editing.id) ?? null;
    const result = await saveModifier(editing.id, toModifierInput(modifierDraft), current);
    setStatus({ status: "ready" });
    if (result.error) {
      setErrors(result.fieldErrors);
      setMessage(result.error);
      return;
    }
    cancel();
    await reload();
  };

  const archive = async (
    kind: "category" | "product" | "modifier",
    id: string,
  ): Promise<void> => {
    setStatus({ status: "loading" });
    if (kind === "product") {
      const current = state.products.find((row) => row.id === id);
      if (!current) {
        setStatus({ status: "ready" });
        return;
      }
      const result = await saveProduct(
        id,
        toProductInput({
          ...toProductForm(current, state.categories, state.products),
          isActive: false,
        }),
        current,
      );
      setStatus({ status: "ready" });
      if (result.error) {
        setMessage(result.error);
        return;
      }
      await reload();
      return;
    }

    if (kind === "category") {
      const current = state.categories.find((row) => row.id === id);
      if (!current) {
        setStatus({ status: "ready" });
        return;
      }
      const result = await saveCategory(
        id,
        toCategoryInput({ ...toCategoryForm(current), isActive: !current.isActive }),
        current,
      );
      setStatus({ status: "ready" });
      if (result.error) {
        setMessage(result.error);
        return;
      }
      await reload();
      return;
    }

    const current = state.modifiers.find((row) => row.id === id);
    if (!current) {
      setStatus({ status: "ready" });
      return;
    }
    const result = await saveModifier(
      id,
      toModifierInput({ ...toModifierForm(current), isActive: !current.isActive }),
      current,
    );
    setStatus({ status: "ready" });
    if (result.error) {
      setMessage(result.error);
      return;
    }
    await reload();
  };

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "categories", label: "Kategori", count: state.categories.length },
    { id: "products", label: "Produk", count: state.products.length },
    { id: "modifiers", label: "Modifier", count: state.modifiers.length },
  ];

  return (
    <div className="catalog-page">
      <div className="catalog-toolbar">
        <h2>Katalog menu</h2>
        <div className="catalog-tabs" role="tablist">
          {tabs.map((entry) => (
            <Button
              key={entry.id}
              variant={tab === entry.id ? "primary" : "secondary"}
              size="sm"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => {
                setTab(entry.id);
                cancel();
              }}
            >
              {entry.label} ({entry.count})
            </Button>
          ))}
        </div>
      </div>

      {message ? (
        <Card elevation="low" title="Gagal menyimpan">
          <p role="alert">{message}</p>
        </Card>
      ) : null}

      {tab === "categories" ? (
        <CategoriesSection
          rows={state.categories}
          editable={canManageCategories}
          editing={editing}
          draft={categoryDraft}
          errors={errors}
          saving={state.status === "loading"}
          onStart={startEdit}
          onCancel={cancel}
          onChange={setCategoryDraft}
          onSubmit={submitCategory}
          onArchive={archive}
        />
      ) : null}

      {tab === "products" ? (
        editing !== null && editing.kind === "product" ? (
          <ProductEditor
            productId={editing.id}
            categories={state.categories}
            modifiers={state.modifiers}
            editable={canManageProducts}
            onDone={() => {
              cancel();
              void reload();
            }}
            onCancel={cancel}
          />
        ) : (
          <ProductsSection
            rows={state.products}
            categories={state.categories}
            editable={canManageProducts}
            onStart={startEdit}
            onArchive={archive}
          />
        )
      ) : null}

      {tab === "modifiers" ? (
        <ModifiersSection
          rows={state.modifiers}
          editable={canManageModifiers}
          editing={editing}
          draft={modifierDraft}
          errors={errors}
          saving={state.status === "loading"}
          onStart={startEdit}
          onCancel={cancel}
          onChange={setModifierDraft}
          onSubmit={submitModifier}
          onArchive={archive}
        />
      ) : null}
    </div>
  );
}

interface SectionProps {
  editable: boolean;
  onStart: (next: Editing) => void;
  onArchive: (kind: "category" | "product" | "modifier", id: string) => void;
}

interface CategoriesSectionProps extends SectionProps {
  rows: ReadonlyArray<import("@tepisawah/database").Category>;
  editing: Editing | null;
  draft: CategoryForm;
  errors: Record<string, string> | null;
  saving: boolean;
  onCancel: () => void;
  onChange: (form: CategoryForm) => void;
  onSubmit: () => void;
}

function CategoriesSection(props: CategoriesSectionProps): ReactNode {
  const {
    rows,
    editable,
    editing,
    draft,
    errors,
    saving,
    onStart,
    onCancel,
    onChange,
    onSubmit,
    onArchive,
  } = props;

  return (
    <div>
      {editable ? (
        <div className="catalog-actions">
          <Button
            variant="primary"
            onClick={() => onStart({ kind: "category", id: null })}
          >
            Tambah kategori
          </Button>
        </div>
      ) : (
        <p className="catalog-hint">Hanya baca</p>
      )}

      {rows.length === 0 ? (
        <Card elevation="low" title="Belum ada kategori">
          <p>Tambahkan kategori pertama untuk mulai menyusun menu.</p>
        </Card>
      ) : (
        <div className="catalog-list">
          {rows.map((row) => (
            <Card
              key={row.id}
              elevation="low"
              title={row.name}
              actions={
                <>
                  <StatusBadge
                    status={row.isActive ? "active" : "inactive"}
                    label={row.isActive ? "Aktif" : "Diarsipkan"}
                  />
                  {editable ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onStart({ kind: "category", id: row.id })}
                      >
                        Ubah
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onArchive("category", row.id)}
                      >
                        {row.isActive ? "Arsipkan" : "Pulihkan"}
                      </Button>
                    </>
                  ) : null}
                </>
              }
            >
              <p>Urutan tampil: {row.sortOrder}</p>
              {row.description ? <p>{row.description}</p> : null}
            </Card>
          ))}
        </div>
      )}

      {editing !== null && editing.kind === "category" ? (
        <CategoryFields
          form={draft}
          errors={errors}
          editable={editable}
          saving={saving}
          onChange={(patch) => onChange({ ...draft, ...patch })}
          onSubmit={() => void onSubmit()}
        />
      ) : null}
      {editing !== null && editing.kind === "category" ? (
        <div className="catalog-actions">
          <Button variant="ghost" disabled={saving} onClick={onCancel}>
            Batal
          </Button>
        </div>
      ) : null}
    </div>
  );
}

interface ProductsSectionProps extends SectionProps {
  rows: ReadonlyArray<import("@tepisawah/database").Product>;
  categories: ReadonlyArray<import("@tepisawah/database").Category>;
  editable: boolean;
}

function ProductsSection(props: ProductsSectionProps): ReactNode {
  const { rows, categories, editable, onStart, onArchive } = props;
  const categoryName = (id: string): string =>
    categories.find((category) => category.id === id)?.name ?? "—";

  if (categories.length === 0) {
    return (
      <Card elevation="low" title="Buat kategori dulu">
        <p>Produk hanya bisa dibuat setelah ada kategori menu.</p>
      </Card>
    );
  }

  return (
    <div>
      {editable ? (
        <div className="catalog-actions">
          <Button
            variant="primary"
            onClick={() => onStart({ kind: "product", id: null })}
          >
            Tambah produk
          </Button>
        </div>
      ) : (
        <p className="catalog-hint">Hanya baca</p>
      )}

      {rows.length === 0 ? (
        <Card elevation="low" title="Belum ada produk">
          <p>Tambahkan produk pertama ke kategori menu.</p>
        </Card>
      ) : (
        <div className="catalog-list">
          {rows.map((row) => (
            <Card
              key={row.id}
              elevation="low"
              title={row.name}
              actions={
                <>
                  <StatusBadge
                    status={row.isActive ? "active" : "inactive"}
                    label={row.isActive ? "Aktif" : "Diarsipkan"}
                  />
                  {row.isActive ? (
                    <StatusBadge
                      status={row.isAvailable ? "active" : "inactive"}
                      label={row.isAvailable ? "Tersedia" : "Habis"}
                    />
                  ) : null}
                  {editable ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onStart({ kind: "product", id: row.id })}
                      >
                        Ubah
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onArchive("product", row.id)}
                      >
                        {row.isActive ? "Arsipkan" : "Pulihkan"}
                      </Button>
                    </>
                  ) : null}
                </>
              }
            >
              {row.imageUrl ? (
                <img
                  className="catalog-thumb"
                  src={row.imageUrl}
                  alt={row.name}
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
              <p>
                {categoryName(row.categoryId)} · Rp{row.price.toLocaleString("id-ID")}
              </p>
              {row.description ? <p>{row.description}</p> : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface ModifiersSectionProps extends SectionProps {
  rows: ReadonlyArray<import("@tepisawah/database").Modifier>;
  editing: Editing | null;
  draft: ModifierForm;
  errors: Record<string, string> | null;
  saving: boolean;
  onCancel: () => void;
  onChange: (form: ModifierForm) => void;
  onSubmit: () => void;
}

function ModifiersSection(props: ModifiersSectionProps): ReactNode {
  const {
    rows,
    editable,
    editing,
    draft,
    errors,
    saving,
    onStart,
    onCancel,
    onChange,
    onSubmit,
    onArchive,
  } = props;

  return (
    <div>
      {editable ? (
        <div className="catalog-actions">
          <Button
            variant="primary"
            onClick={() => onStart({ kind: "modifier", id: null })}
          >
            Tambah modifier
          </Button>
        </div>
      ) : (
        <p className="catalog-hint">Hanya baca</p>
      )}

      {rows.length === 0 ? (
        <Card elevation="low" title="Belum ada modifier">
          <p>Modifier adalah kustomisasi yang dapat dipasang ke produk.</p>
        </Card>
      ) : (
        <div className="catalog-list">
          {rows.map((row) => (
            <Card
              key={row.id}
              elevation="low"
              title={row.name}
              actions={
                <>
                  <StatusBadge
                    status={row.isActive ? "active" : "inactive"}
                    label={row.isActive ? "Aktif" : "Diarsipkan"}
                  />
                  {editable ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onStart({ kind: "modifier", id: row.id })}
                      >
                        Ubah
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onArchive("modifier", row.id)}
                      >
                        {row.isActive ? "Arsipkan" : "Pulihkan"}
                      </Button>
                    </>
                  ) : null}
                </>
              }
            >
              <p>Selisih harga: Rp{row.priceDelta.toLocaleString("id-ID")}</p>
              {row.description ? <p>{row.description}</p> : null}
            </Card>
          ))}
        </div>
      )}

      {editing !== null && editing.kind === "modifier" ? (
        <ModifierFields
          form={draft}
          errors={errors}
          editable={editable}
          saving={saving}
          onChange={(patch) => onChange({ ...draft, ...patch })}
          onSubmit={() => void onSubmit()}
        />
      ) : null}
      {editing !== null && editing.kind === "modifier" ? (
        <div className="catalog-actions">
          <Button variant="ghost" disabled={saving} onClick={onCancel}>
            Batal
          </Button>
        </div>
      ) : null}
    </div>
  );
}
