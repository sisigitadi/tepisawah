/**
 * Product editor (Phase 5).
 *
 * Stateful editor for one product and its `product_modifiers` links. Owns two
 * drafts (product fields, link rows) and two save calls; both ride the
 * RLS-enforced browser client, so a session without `catalog.create` /
 * `catalog.update` simply receives an RLS error (AUTH_RBAC_RLS.md §25).
 *
 * Nothing here trusts a client price for a customer: the form value is staff
 * input only, and the price a customer pays is always re-read from the catalog
 * by `resolve_order_item()` at order time (API_CONTRACT.md §27).
 */
import { Button, Card } from "@tepisawah/ui";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Category, Modifier, Product, ProductModifier } from "@tepisawah/database";

import {
  loadProductEditor,
  saveProduct,
  saveProductLinks,
} from "./service.js";
import {
  toLinkInputs,
  toLinkRows,
  toProductForm,
  toProductInput,
  type LinkRow,
  type ProductForm,
} from "./use-catalog.js";
import { ProductForm as ProductFormFields } from "./product-form.js";
import { ProductLinks } from "./product-links.js";

export interface ProductEditorProps {
  /** null while creating a new product. */
  productId: string | null;
  categories: readonly Category[];
  modifiers: readonly Modifier[];
  editable: boolean;
  onDone: () => void;
  onCancel: () => void;
}

type Phase = "loading" | "ready" | "saving" | "error";

export function ProductEditor(props: ProductEditorProps): ReactNode {
  const { productId, categories, modifiers, editable, onDone, onCancel } = props;

  const [phase, setPhase] = useState<Phase>("ready");
  const [form, setForm] = useState<ProductForm>(() =>
    toProductForm(null, categories, []),
  );
  const [current, setCurrent] = useState<Product | null>(null);
  const [currentLinks, setCurrentLinks] = useState<ReadonlyArray<ProductModifier>>([]);
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [pendingAttach, setPendingAttach] = useState("");
  const [errors, setErrors] = useState<Record<string, string> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (productId === null) {
      setCurrent(null);
      setCurrentLinks([]);
      setForm(toProductForm(null, categories, []));
      setRows([]);
      return;
    }
    setPhase("loading");
    const result = await loadProductEditor(productId);
    if (result.error) {
      setPhase("error");
      setMessage(result.error);
      return;
    }
    setCurrent(result.product);
    setCurrentLinks(result.links ?? []);
    setForm(toProductForm(result.product, categories, []));
    setRows(toLinkRows(result.links ?? []));
    setPhase("ready");
  }, [productId, categories]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveAll = async (): Promise<void> => {
    setErrors(null);
    setMessage(null);
    setPhase("saving");

    const input = toProductInput(form);
    const productResult = await saveProduct(productId, input, current);

    if (productResult.error || !productResult.data) {
      setPhase("ready");
      setErrors(productResult.fieldErrors);
      setMessage(productResult.error);
      return;
    }

    const targetId = productResult.data.record.id;
    const linkResult = await saveProductLinks(
      targetId,
      toLinkInputs(targetId, rows),
      currentLinks,
      new Map(modifiers.map((modifier) => [modifier.id, modifier.name])),
    );

    setPhase("ready");
    if (linkResult.error) {
      setErrors(linkResult.fieldErrors);
      setMessage(linkResult.error);
      return;
    }
    onDone();
  };

  if (phase === "loading") {
    return <p aria-live="polite">Memuat produk…</p>;
  }

  return (
    <div className="catalog-editor">
      {message ? (
        <Card elevation="low" title="Gagal menyimpan">
          <p role="alert">{message}</p>
        </Card>
      ) : null}

      <ProductFormFields
        form={form}
        categories={categories}
        errors={errors}
        editable={editable}
        saving={phase === "saving"}
        onChange={(patch) => setForm((previous) => ({ ...previous, ...patch }))}
        onSubmit={() => void saveAll()}
      />

      {productId !== null ? (
        <ProductLinks
          rows={rows}
          modifiers={modifiers}
          errors={errors}
          editable={editable}
          saving={phase === "saving"}
          pendingAttach={pendingAttach}
          onChange={setRows}
          onPendingAttach={setPendingAttach}
          onAttach={() => {
            if (pendingAttach === "") return;
            setRows((previous) => [
              ...previous,
              {
                modifierId: pendingAttach,
                isRequired: false,
                minSelect: "0",
                maxSelect: "1",
                sortOrder: previous.length,
              },
            ]);
            setPendingAttach("");
          }}
          onSubmit={() => void saveAll()}
        />
      ) : (
        <p className="catalog-hint">
          Simpan produk ini sebelum memasang modifier.
        </p>
      )}

      <div className="catalog-actions">
        <Button variant="ghost" disabled={phase === "saving"} onClick={onCancel}>
          Batal
        </Button>
      </div>
    </div>
  );
}
