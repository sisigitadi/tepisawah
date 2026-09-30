/**
 * @tepisawah/order — `checkout` feature (Phase 8A).
 *
 * Customer draft order creation. The cart carries product and modifier
 * references plus quantity and notes; prices are computed server-side inside
 * `create_draft_order()`, so no money ever travels from the browser
 * (API_CONTRACT.md §10.1, §2.2).
 *
 * Public API surface of the feature; deep internal imports are not allowed
 * (REPOSITORY_STRUCTURE.md §43).
 */
export { CheckoutPage } from "./checkout-page.js";
export { submitDraftOrder } from "./service.js";
export type {
  CartLine,
  CheckoutError,
  CheckoutResult,
  SubmitDraftOrderInput,
} from "./service.js";
