/**
 * @tepisawah/web — public website home page.
 *
 * Composes the production homepage sections per the Stitch reference
 * (docs/design/references/stitch/tepi_sawah_official_production_homepage).
 * Section markup lives in the `content` feature; this page only composes.
 */
import type { ReactNode } from "react";
import {
  About,
  FeaturedMenu,
  Gallery,
  Hero,
  LocationSection,
  PromoSection,
  QrOrder,
  Reservation,
  ReservationProvider,
  SiteFooter,
  SiteHeader,
} from "../features/content/index.js";

export function HomePage(): ReactNode {
  return (
    <ReservationProvider>
      <SiteHeader />
      <main className="web-main">
        <Hero />
        <About />
        <FeaturedMenu />
        <PromoSection />
        <QrOrder />
        <Reservation />
        <Gallery />
        <LocationSection />
      </main>
      <SiteFooter />
    </ReservationProvider>
  );
}
