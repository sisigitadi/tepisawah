/**
 * @tepisawah/web — `content` feature.
 *
 * Public API surface of the feature; deep internal imports are not allowed
 * (§43). Sections are composed by `pages/HomePage`.
 */
export { ReservationProvider, useReservation } from "./reservation.js";
export {
  SiteHeader,
  Hero,
  About,
  FeaturedMenu,
  PromoSection,
  QrOrder,
  Reservation,
  Gallery,
  LocationSection,
  SiteFooter,
} from "./components/index.js";
