/**
 * @tepisawah/web — public website home page.
 *
 * Composes the production homepage sections per the Stitch reference
 * (docs/design/references/stitch/tepi_sawah_official_production_homepage).
 * Section markup lives in the `content` feature; this page only composes.
 */
import type { ReactNode } from "react";
import { useLandingContent } from "../hooks/index.js";
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
  ThemeInjector,
} from "../features/content/index.js";

export function HomePage(): ReactNode {
  const { content } = useLandingContent();

  return (
    <ReservationProvider>
      <ThemeInjector />
      <SiteHeader />
      <main className="web-main">
        {content.hero.isActive !== false && <Hero />}
        {content.about.isActive !== false && <About />}
        {content.menu.isActive !== false && <FeaturedMenu />}
        {content.promo.isActive !== false && <PromoSection />}
        {content.qrOrder.isActive !== false && <QrOrder />}
        {content.reservation.isActive !== false && <Reservation />}
        {content.gallery.isActive !== false && <Gallery />}
        {content.location.isActive !== false && <LocationSection />}
      </main>
      <SiteFooter />
    </ReservationProvider>
  );
}
