/**
 * Checkout page (Phase 8A).
 *
 * What the customer reviews before sending the cart to the kitchen. The page
 * deliberately shows no money until the server returns the DRAFT order: the
 * order number, subtotal and total below are read back from `create_draft_order()`,
 * never computed from the cart, so a customer cannot see — let alone send — a
 * price of their own (API_CONTRACT.md §2.2, §10.1).
 *
 * The submit is guarded by the resolved table context. If the session was
 * closed after the customer scanned, the RPC refuses and the page surfaces that
 * refusal instead of silently retrying into a void.
 */
import { Button, Card } from "@tepisawah/ui";
import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { PublicTableResolve } from "@tepisawah/database";
import { normalizeCartNote } from "@tepisawah/orders";
import {
  checkoutIdempotencyKey,
  checkoutSubmitIdempotencyKey,
  submitDraftOrder,
  submitDraftOrderForConfirmation,
} from "./service.js";
import type { CartLine, CheckoutError } from "./service.js";

export interface CheckoutPageProps {
  /** The table context the QR resolved; the order joins its active session. */
  table: PublicTableResolve;
  /** The cart the customer built. */
  items: CartLine[];
  /** The order-level note the customer attached in the basket, if any. */
  customerNote?: string | null;
  /** Called with the created DRAFT order so the app can route to its status. */
  onSubmitted?: (orderId: string, orderNumber: string) => void;
  /** Called when the customer wants to change the cart. */
  onBack?: () => void;
}

type Phase = "idle" | "submitting" | "error";

const formatIDR = (value: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

function newAttemptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CheckoutPage(props: CheckoutPageProps): ReactNode {
  const { table, items, customerNote, onSubmitted, onBack } = props;
  const [phase, setPhase] = useState<Phase>("idle");
  const [failure, setFailure] = useState<CheckoutError | null>(null);

  // One attempt per checkout: generated on first submit and held for every
  // retry of the same basket. Paired with a fingerprint of the cart in the
  // idempotency key, a retry collapses to the first order while a basket the
  // customer changed in between does not (API_CONTRACT.md §2.3).
  const attemptRef = useRef<string | null>(null);
  const [created, setCreated] = useState<{
    id: string;
    orderNumber: string;
    total: number;
  } | null>(null);

  const [flowSettings] = useState<{
    orderFlowMode: "post_pay" | "pre_pay" | "flexible";
    qrisInstruction: string;
  }>(() => {
    try {
      const raw = localStorage.getItem("tepisawah_order_flow_settings");
      if (raw) return JSON.parse(raw);
    } catch {
      // Non-blocking fallback
    }
    return {
      orderFlowMode: "flexible",
      qrisInstruction: "Scan QRIS di kasir setelah selesai makan, atau bayar langsung via QRIS di HP.",
    };
  });

  const [paymentOption, setPaymentOption] = useState<"cashier" | "qris">(() =>
    flowSettings.orderFlowMode === "pre_pay" ? "qris" : "cashier"
  );

  const submit = useCallback(async () => {
    setPhase("submitting");
    setFailure(null);

    if (attemptRef.current === null) attemptRef.current = newAttemptId();

    // Step 1 of 2: create the DRAFT with its content-scoped key.
    const created = await submitDraftOrder({
      tableId: table.tableId,
      tableSessionId: table.session?.id ?? "",
      items,
      customerNote: normalizeCartNote(customerNote ?? null),
      idempotencyKey: checkoutIdempotencyKey(attemptRef.current, items),
    });

    if (created.error || !created.data) {
      setFailure(created.error ?? { message: "Pesanan gagal dibuat." });
      setPhase("error");
      return;
    }

    // Step 2 of 2: send it to the kitchen queue.
    const submitted = await submitDraftOrderForConfirmation({
      orderId: created.data.order.id,
      tableId: table.tableId,
      tableSessionId: table.session?.id ?? "",
      idempotencyKey: checkoutSubmitIdempotencyKey(attemptRef.current, created.data.order.id),
    });

    if (submitted.error || !submitted.data) {
      setFailure(submitted.error ?? { message: "Pesanan gagal dikirim." });
      setPhase("error");
      return;
    }

    const order = submitted.data.order;
    setCreated({ id: order.id, orderNumber: order.orderNumber, total: order.total });
    setPhase("idle");
    onSubmitted?.(order.id, order.orderNumber);
  }, [table, items, customerNote, onSubmitted]);

  if (created !== null) {
    if (paymentOption === "qris" || flowSettings.orderFlowMode === "pre_pay") {
      return (
        <Card
          elevation="low"
          title="Pesanan dibuat"
          description="Pesanan Anda telah diterima. Silakan selesaikan pembayaran QRIS di bawah ini."
        >
          <p>
            Nomor order <strong>{created.orderNumber}</strong> • Meja <strong>{table.tableCode}</strong>
          </p>
          <p className="checkout__total">Total Pembayaran: {formatIDR(created.total)}</p>
          
          <div className="qris-checkout-card">
            <div className="qris-checkout-header">
              <span className="qris-pill">QRIS STANDAR BI</span>
              <span className="qris-merchant-title">TEPI SAWAH RESTO &amp; COFFEE</span>
            </div>
            <div className="qris-qr-box">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=00020101021226600016ID.CO.QRIS.WWW01189360091100293847550215ID10260029384755303360540${created.total}5802ID5910TEPI SAWAH6007CIREBON6304`}
                alt="QRIS Pembayaran"
                className="qris-dynamic-img"
              />
            </div>
            <p className="qris-nm-id">NMID: ID1026002938475 • Ciperna, Cirebon</p>
            <p className="qris-guide-text">
              Buka aplikasi Mobile Banking (BCA, Mandiri, BRI) atau e-Wallet (GoPay, OVO, ShopeePay, DANA) &amp; scan QRIS di atas untuk menyelesaikan pesanan.
            </p>
            <div style={{ marginTop: "1rem" }}>
              <Button
                variant="primary"
                fullWidth
                onClick={() => onSubmitted?.(created.id, created.orderNumber)}
              >
                Lihat status pesanan
              </Button>
            </div>
          </div>
        </Card>
      );
    }

    return (
      <Card
        elevation="low"
        title="Pesanan dibuat"
        description="Pesanan Anda sudah masuk antrian konfirmasi kasir & dapur."
      >
        <p>
          Nomor order <strong>{created.orderNumber}</strong> • Meja <strong>{table.tableCode}</strong>
        </p>
        <p className="checkout__total">Total {formatIDR(created.total)}</p>
        <div style={{ padding: "1rem", background: "rgba(46, 107, 52, 0.08)", borderRadius: "8px", margin: "1rem 0" }}>
          <p className="checkout__hint" style={{ margin: 0, fontSize: "0.92rem", lineHeight: "1.6", color: "#183a1d" }}>
            🍽️ <strong>Pesanan langsung dimasak oleh dapur!</strong><br />
            Silakan bersantai dan nikmati hidangan Anda. Pembayaran dapat diselesaikan di kasir setelah selesai makan (sebutkan Meja <strong>{table.tableCode}</strong>).
          </p>
        </div>
        <Button
          variant="primary"
          fullWidth
          onClick={() => onSubmitted?.(created.id, created.orderNumber)}
        >
          Lihat status pesanan
        </Button>
      </Card>
    );
  }

  const sessionClosed = table.session === null || table.session.status !== "OPEN";
  const normalizedNote = normalizeCartNote(customerNote ?? null);

  return (
    <div className="checkout">
      <Card
        elevation="low"
        title={`Checkout — Meja ${table.tableCode}`}
        description={table.restaurantName ?? undefined}
      >
        <ul className="checkout__items">
          {items.map((item) => (
            <li key={item.productId} className="checkout__item">
              <span className="checkout__qty">{item.quantity}×</span>
              <span className="checkout__name">{item.name ?? item.productId}</span>
              {item.notes ? (
                <span className="checkout__note">{item.notes}</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="checkout__price-hint">
          Harga dihitung oleh sistem saat pesanan dibuat.
        </p>
        {normalizedNote !== null ? (
          <p className="checkout__customer-note">
            <strong>Catatan:</strong> {normalizedNote}
          </p>
        ) : null}

        {/* Pilihan Alur Pembayaran & Keuangan */}
        <div className="checkout__payment-box" style={{ marginTop: "1.25rem", borderTop: "1px solid #e7e5e4", paddingTop: "1rem" }}>
          <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "#183a1d" }}>Metode &amp; Alur Pembayaran</h4>
          
          {flowSettings.orderFlowMode === "flexible" ? (
            <div style={{ display: "grid", gap: "0.65rem" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.65rem",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: `2px solid ${paymentOption === "cashier" ? "#2e6b34" : "#e7e5e4"}`,
                  background: paymentOption === "cashier" ? "#f7faf8" : "#ffffff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="paymentOption"
                  checked={paymentOption === "cashier"}
                  onChange={() => setPaymentOption("cashier")}
                  style={{ marginTop: "0.2rem", accentColor: "#2e6b34" }}
                />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <strong style={{ fontSize: "0.875rem", color: "#1c1917" }}>Bayar di Kasir</strong>
                    <span style={{ fontSize: "0.68rem", background: "#f5f5f4", padding: "0.1rem 0.35rem", borderRadius: "4px" }}>
                      Post-Pay
                    </span>
                  </div>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "#57534e" }}>
                    Pesan sekarang &amp; langsung dimasak. Pembayaran di kasir setelah selesai makan.
                  </p>
                </div>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.65rem",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: `2px solid ${paymentOption === "qris" ? "#2e6b34" : "#e7e5e4"}`,
                  background: paymentOption === "qris" ? "#f7faf8" : "#ffffff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="paymentOption"
                  checked={paymentOption === "qris"}
                  onChange={() => setPaymentOption("qris")}
                  style={{ marginTop: "0.2rem", accentColor: "#2e6b34" }}
                />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <strong style={{ fontSize: "0.875rem", color: "#1c1917" }}>Bayar Langsung via QRIS</strong>
                    <span style={{ fontSize: "0.68rem", background: "#dcfce7", color: "#15803d", padding: "0.1rem 0.35rem", borderRadius: "4px" }}>
                      Instan
                    </span>
                  </div>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "#57534e" }}>
                    Bayar langsung via aplikasi Mobile Banking (BCA, Mandiri, BRI) atau e-Wallet di HP Anda.
                  </p>
                </div>
              </label>
            </div>
          ) : flowSettings.orderFlowMode === "pre_pay" ? (
            <div style={{ padding: "0.65rem 0.85rem", background: "#fef3c7", borderRadius: "6px", fontSize: "0.8125rem", color: "#92400e" }}>
              <strong>💳 Pembayaran di Awal</strong>
              <p style={{ margin: "0.15rem 0 0" }}>
                Restoran menerapkan pembayaran di awal. Silakan selesaikan pembayaran QRIS atau kasir agar pesanan segera dimasak.
              </p>
            </div>
          ) : (
            <div style={{ padding: "0.65rem 0.85rem", background: "#e0f2fe", borderRadius: "6px", fontSize: "0.8125rem", color: "#0369a1" }}>
              <strong>🍽️ Pesan Dulu, Bayar di Kasir</strong>
              <p style={{ margin: "0.15rem 0 0" }}>
                Pesanan Anda langsung diteruskan ke dapur. Pembayaran dilakukan di kasir setelah selesai makan.
              </p>
            </div>
          )}
        </div>

        {sessionClosed ? (
          <p className="checkout__session-closed" role="alert" style={{ marginTop: "0.85rem" }}>
            Sesi meja belum dibuka atau sudah ditutup. Tunggu staf membuka sesi
            sebelum memesan.
          </p>
        ) : null}
      </Card>
      <div className="checkout__actions">
        <Button variant="secondary" onClick={onBack} disabled={phase === "submitting"}>
          Ubah pesanan
        </Button>
        <Button
          variant="primary"
          fullWidth
          disabled={phase === "submitting" || sessionClosed || items.length === 0}
          aria-busy={phase === "submitting"}
          onClick={submit}
        >
          {phase === "submitting" ? "Mengirim pesanan…" : "Kirim pesanan"}
        </Button>
      </div>
      {phase === "error" ? (
        <p className="checkout__error" role="alert">
          {failure?.message ?? "Pesanan gagal dikirim."}
        </p>
      ) : null}
    </div>
  );
}
