/**
 * Manual order page (Phase 8A — API_CONTRACT.md §11.1).
 *
 * The waiter's order entry. Three deliberate properties:
 *
 * 1. No money is shown before the server answers. The catalog price next to a
 *    product is a *display* convenience read from the catalog; the order total
 *    is only ever rendered after `create_draft_order()` returns it. The submit
 *    button sends no price at all (MASTER prompt).
 * 2. The table must have an OPEN session. The session is resolved from the
 *    backend, not typed in; a table without one is offered but its order cannot
 *    be created yet — session management belongs to cashier/supervisor
 *    (AUTH_RBAC_RLS.md §9 baseline: Waiter has Tables Read, not Tables Manage).
 * 3. Every failure surfaces as text rather than a silent empty state, because a
 *    waiter who cannot see why an order failed will just submit it twice.
 */
import { Button, Card } from "@tepisawah/ui";
import type { ReactNode } from "react";

import { useManualOrder } from "./use-manual-order.js";

const formatIDR = (value: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export function ManualOrderPage(): ReactNode {
  const vm = useManualOrder();

  if (vm.loadPhase === "loading") {
    return (
      <div className="manual-order" aria-busy="true">
        <p className="manual-order__hint">Memuat meja dan menu…</p>
      </div>
    );
  }

  if (vm.loadPhase === "error") {
    return (
      <div className="manual-order">
        <p className="manual-order__error" role="alert">
          {vm.loadError ?? "Data gagal dimuat."}
        </p>
        <Button variant="secondary" onClick={() => void vm.reset()}>
          Coba lagi
        </Button>
      </div>
    );
  }

  if (vm.created !== null) {
    const order = vm.confirmed ?? vm.created;
    const sent = vm.confirmPhase === "done";
    return (
      <div className="manual-order">
        <Card elevation="low" title={sent ? "Pesanan dikirim" : "Pesanan dibuat"}>
          <p>
            Nomor order <strong>{order.orderNumber}</strong> — meja{" "}
            <strong>{vm.tables.find((t) => t.id === vm.tableId)?.tableCode ?? "-"}</strong>
          </p>
          <p className="manual-order__total">Total {formatIDR(order.total)}</p>
          {sent ? (
            <p className="manual-order__session manual-order__session--open">
              Order sudah masuk antrian konfirmasi kasir.
            </p>
          ) : (
            <p className="manual-order__hint">
              Order masih berupa draf dan belum terlihat oleh kasir. Kirim agar
              masuk antrian konfirmasi.
            </p>
          )}
          {vm.confirmPhase === "error" ? (
            <p className="manual-order__error" role="alert">
              {vm.confirmError ?? "Pesanan gagal dikirim."}
            </p>
          ) : null}
          <div className="manual-order__actions">
            {sent ? null : (
              <Button
                variant="primary"
                fullWidth
                disabled={!vm.canConfirm}
                aria-busy={vm.confirmPhase === "confirming"}
                onClick={() => void vm.confirm()}
              >
                {vm.confirmPhase === "confirming" ? "Mengirim…" : "Kirim order"}
              </Button>
            )}
            <Button variant="secondary" onClick={() => vm.reset()}>
              Order baru
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const selected = vm.tables.find((t) => t.id === vm.tableId) ?? null;
  const sessionClosed = vm.tableId !== null && vm.activeSession === null;

  return (
    <div className="manual-order">
      <Card elevation="low" title="Order manual" description="Pilih meja, lalu tambah menu">
        <label className="manual-order__field" htmlFor="manual-order-table">
          Meja
          <select
            id="manual-order-table"
            value={vm.tableId ?? ""}
            onChange={(event) => vm.setTable(event.target.value)}
          >
            <option value="">— pilih meja —</option>
            {vm.tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.tableCode} — {table.name}
              </option>
            ))}
          </select>
        </label>

        {vm.tableId === null ? (
          <p className="manual-order__hint">Pilih meja untuk mulai memesan.</p>
        ) : vm.activeSession !== null ? (
          <p className="manual-order__session manual-order__session--open">
            Sesi meja aktif — order akan ikut sesi ini.
          </p>
        ) : (
          <p className="manual-order__session manual-order__session--closed" role="alert">
            Sesi meja belum dibuka. Minta kasir/supervisor membuka sesi sebelum
            membuat order.
          </p>
        )}
      </Card>

      {selected !== null ? (
        <Card elevation="low" title={`Menu — ${selected.tableCode}`}>
          {vm.catalog.length === 0 ? (
            <p className="manual-order__hint">Menu kosong.</p>
          ) : (
            <ul className="manual-order__catalog">
              {vm.catalog.map((category) => (
                <li key={category.id} className="manual-order__category">
                  <h3 className="manual-order__category-name">{category.name}</h3>
                  <ul className="manual-order__products">
                    {category.products.map((product) => {
                      const line = vm.lines.find((l) => l.productId === product.productId);
                      return (
                        <li
                          key={product.productId}
                          className="manual-order__product"
                          aria-disabled={product.isAvailable ? undefined : true}
                        >
                          <span className="manual-order__product-name">{product.name}</span>
                          <span className="manual-order__product-price">
                            {formatIDR(product.price)}
                          </span>
                          {product.isAvailable ? null : (
                            <span className="manual-order__out">Habis</span>
                          )}
                          <span className="manual-order__stepper">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Kurang ${product.name}`}
                              disabled={line === undefined}
                              onClick={() => vm.decrementLine(product.productId)}
                            >
                              −
                            </Button>
                            <span className="manual-order__qty">{line?.quantity ?? 0}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Tambah ${product.name}`}
                              disabled={!product.isAvailable}
                              onClick={() => vm.addLine(product.productId)}
                            >
                              +
                            </Button>
                          </span>
                          {line ? (
                            <label className="manual-order__notes">
                              <span className="manual-order__notes-label">Catatan</span>
                              <input
                                type="text"
                                value={line.notes ?? ""}
                                placeholder="mis. tidak pedas"
                                onChange={(event) =>
                                  vm.setLineNotes(product.productId, event.target.value)
                                }
                              />
                            </label>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {selected !== null ? (
        <Card elevation="low" title="Catatan">
          <label className="manual-order__field" htmlFor="manual-order-customer-note">
            Catatan untuk kitchen
            <textarea
              id="manual-order-customer-note"
              rows={2}
              value={vm.customerNote}
              onChange={(event) => vm.setCustomerNote(event.target.value)}
            />
          </label>
          <label className="manual-order__field" htmlFor="manual-order-internal-note">
            Catatan internal (staf)
            <textarea
              id="manual-order-internal-note"
              rows={2}
              value={vm.internalNote}
              onChange={(event) => vm.setInternalNote(event.target.value)}
            />
          </label>
        </Card>
      ) : null}

      <div className="manual-order__actions">              <Button
                variant="primary"
          fullWidth
          disabled={!vm.canSubmit || sessionClosed}
          aria-busy={vm.submitPhase === "submitting"}
          onClick={() => void vm.submit()}
        >
          {vm.submitPhase === "submitting" ? "Mengirim order…" : "Buat order draf"}
        </Button>
      </div>

      {vm.submitPhase === "error" ? (
        <p className="manual-order__error" role="alert">
          {vm.submitError ?? "Order gagal dibuat."}
        </p>
      ) : null}
      <p className="manual-order__price-hint">
        Harga dihitung oleh sistem saat order dibuat, bukan dari aplikasi ini.
      </p>
    </div>
  );
}
