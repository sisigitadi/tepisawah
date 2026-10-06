/**
 * Cart drawer tests (Phase 4).
 *
 * The drawer is the basket review surface, so the suite drives it like a
 * customer would and asserts on the intent it emits: steppers, deletes, per-item
 * notes and the order-level note, then the handoff to checkout
 * (TESTING_STRATEGY.md Layer 3).
 *
 * What the drawer shows is display-only money; what it *emits* is references and
 * intent, so the assertions never reach into a price (API_CONTRACT.md §10.1).
 */
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CartDrawer } from "./cart-drawer.js";
import type { CartLineView } from "@tepisawah/orders";

function line(overrides: Partial<CartLineView> = {}): CartLineView {
  return {
    productId: "p-1",
    name: "Nasi Liwet",
    quantity: 2,
    modifierNames: ["Pedas Sedang"],
    notes: null,
    unitPrice: 25000,
    lineTotal: 50000,
    imageUrl: null,
    ...overrides,
  };
}

const LINES: CartLineView[] = [
  line(),
  line({
    productId: "p-2",
    name: "Ayam Bakar",
    quantity: 1,
    modifierNames: [],
    notes: "tanpa bawang",
    unitPrice: 32000,
    lineTotal: 32000,
  }),
];

describe("CartDrawer", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing while closed", () => {
    render(
      <CartDrawer
        open={false}
        lines={LINES}
        customerNote=""
        onClose={() => undefined}
        onIncrement={() => undefined}
        onDecrement={() => undefined}
        onRemove={() => undefined}
        onItemNoteChange={() => undefined}
        onCustomerNoteChange={() => undefined}
        onCheckout={() => undefined}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists every line with its quantity, modifiers and note", () => {
    render(
      <CartDrawer
        open
        lines={LINES}
        customerNote=""
        onClose={() => undefined}
        onIncrement={() => undefined}
        onDecrement={() => undefined}
        onRemove={() => undefined}
        onItemNoteChange={() => undefined}
        onCustomerNoteChange={() => undefined}
        onCheckout={() => undefined}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Keranjang belanja" })).toBeInTheDocument();
    expect(screen.getByText("Nasi Liwet")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Pedas Sedang")).toBeInTheDocument();
    // The pre-filled per-item note round-trips into the input.
    expect(screen.getByDisplayValue("tanpa bawang")).toBeInTheDocument();
    // The header counts units, not lines.
    expect(screen.getByText("3 menu")).toBeInTheDocument();
    // Display money is formatted for the customer.
    expect(screen.getByText("Rp 82.000")).toBeInTheDocument();
  });

  it("moves a line's quantity through the steppers", async () => {
    const user = userEvent.setup();
    const onIncrement = vi.fn();
    const onDecrement = vi.fn();

    render(
      <CartDrawer
        open
        lines={LINES}
        customerNote=""
        onClose={() => undefined}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
        onRemove={() => undefined}
        onItemNoteChange={() => undefined}
        onCustomerNoteChange={() => undefined}
        onCheckout={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Tambah Nasi Liwet" }));
    await user.click(screen.getByRole("button", { name: "Kurangi Ayam Bakar" }));

    expect(onIncrement).toHaveBeenCalledWith("p-1");
    expect(onDecrement).toHaveBeenCalledWith("p-2");
  });

  it("removes a line", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(
      <CartDrawer
        open
        lines={LINES}
        customerNote=""
        onClose={() => undefined}
        onIncrement={() => undefined}
        onDecrement={() => undefined}
        onRemove={onRemove}
        onItemNoteChange={() => undefined}
        onCustomerNoteChange={() => undefined}
        onCheckout={() => undefined}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Hapus Nasi Liwet dari keranjang" }),
    );

    expect(onRemove).toHaveBeenCalledWith("p-1");
  });

  it("emits per-item note edits", () => {
    const onItemNoteChange = vi.fn();

    render(
      <CartDrawer
        open
        lines={LINES}
        customerNote=""
        onClose={() => undefined}
        onIncrement={() => undefined}
        onDecrement={() => undefined}
        onRemove={() => undefined}
        onItemNoteChange={onItemNoteChange}
        onCustomerNoteChange={() => undefined}
        onCheckout={() => undefined}
      />,
    );

    const input = screen.getAllByPlaceholderText(
      "Mis. tanpa bawang, pedas sedang",
    )[0] as HTMLInputElement;
    // The input is controlled by the basket above the drawer, so the whole edit
    // is applied in one change event (a keystroke-by-keystroke type would race
    // the parent's controlled value).
    fireEvent.change(input, { target: { value: "pedas sedang" } });

    expect(onItemNoteChange).toHaveBeenCalledWith("p-1", "pedas sedang");
  });

  it("emits the order-level note and caps it at the domain length", () => {
    const onCustomerNoteChange = vi.fn();

    render(
      <CartDrawer
        open
        lines={LINES}
        customerNote=""
        onClose={() => undefined}
        onIncrement={() => undefined}
        onDecrement={() => undefined}
        onRemove={() => undefined}
        onItemNoteChange={() => undefined}
        onCustomerNoteChange={onCustomerNoteChange}
        onCheckout={() => undefined}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      "Catatan yang berlaku untuk seluruh pesanan",
    );
    fireEvent.change(textarea, { target: { value: "a".repeat(600) } });

    expect(onCustomerNoteChange).toHaveBeenCalledWith("a".repeat(500));
  });

  it("hands the basket to checkout", async () => {
    const user = userEvent.setup();
    const onCheckout = vi.fn();

    render(
      <CartDrawer
        open
        lines={LINES}
        customerNote=""
        onClose={() => undefined}
        onIncrement={() => undefined}
        onDecrement={() => undefined}
        onRemove={() => undefined}
        onItemNoteChange={() => undefined}
        onCustomerNoteChange={() => undefined}
        onCheckout={onCheckout}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Lanjut ke Pembayaran/ }));

    expect(onCheckout).toHaveBeenCalledTimes(1);
  });

  it("closes on the backdrop, the close button and Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    await render(
      <CartDrawer
        open
        lines={LINES}
        customerNote=""
        onClose={onClose}
        onIncrement={() => undefined}
        onDecrement={() => undefined}
        onRemove={() => undefined}
        onItemNoteChange={() => undefined}
        onCustomerNoteChange={() => undefined}
        onCheckout={() => undefined}
      />,
    );

    // The backdrop and the header ✕ share an accessible name, so each is
    // addressed by what makes it unique.
    const [backdrop] = screen.getAllByRole("button", { name: "Tutup keranjang" });
    await user.click(backdrop as HTMLElement);
    await user.click(screen.getByText("✕"));
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("shows the empty state and no checkout button without lines", () => {
    render(
      <CartDrawer
        open
        lines={[]}
        customerNote=""
        onClose={() => undefined}
        onIncrement={() => undefined}
        onDecrement={() => undefined}
        onRemove={() => undefined}
        onItemNoteChange={() => undefined}
        onCustomerNoteChange={() => undefined}
        onCheckout={() => undefined}
      />,
    );

    expect(
      screen.getByText("Keranjang Anda masih kosong."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Lanjut ke Pembayaran/ }),
    ).not.toBeInTheDocument();
  });

  it("caps a per-item note at the domain length", () => {
    const onItemNoteChange = vi.fn();

    render(
      <CartDrawer
        open
        lines={LINES}
        customerNote=""
        onClose={() => undefined}
        onIncrement={() => undefined}
        onDecrement={() => undefined}
        onRemove={() => undefined}
        onItemNoteChange={onItemNoteChange}
        onCustomerNoteChange={() => undefined}
        onCheckout={() => undefined}
      />,
    );

    // The drawer emits what the customer typed; the basket clamps it on the way
    // in (selectors `setEntryNote`), and the field's own cap keeps the visible
    // text inside the limit.
    const input = screen.getAllByPlaceholderText(
      "Mis. tanpa bawang, pedas sedang",
    )[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: "a".repeat(250) } });

    expect(onItemNoteChange).toHaveBeenCalledWith("p-1", "a".repeat(250));
    expect(input).toHaveAttribute("maxlength", "200");
  });

  it("tells the customer the total is only an estimate", () => {
    render(
      <CartDrawer
        open
        lines={LINES}
        customerNote=""
        onClose={() => undefined}
        onIncrement={() => undefined}
        onDecrement={() => undefined}
        onRemove={() => undefined}
        onItemNoteChange={() => undefined}
        onCustomerNoteChange={() => undefined}
        onCheckout={() => undefined}
      />,
    );

    expect(
      screen.getByText("Harga final dihitung oleh sistem saat pesanan dibuat."),
    ).toBeInTheDocument();
    expect(screen.getByText("Estimasi total")).toBeInTheDocument();
  });
});
