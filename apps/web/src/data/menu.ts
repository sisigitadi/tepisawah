/**
 * @tepisawah/web — menu re-export.
 *
 * The canonical catalog lives in @tepisawah/ui (single source of truth shared
 * with the order, POS, kitchen and waiter apps) so every screen shows the
 * same items, prices and illustrations. This file keeps the local import path
 * stable for web feature modules.
 */
export {
  MENU_CATEGORIES,
  MENU_CATEGORY_LABEL,
  MENU_ITEMS,
  formatPrice,
  filterMenuItems,
  getMenuItem,
} from "@tepisawah/ui";
export type { MenuCategory, MenuItem } from "@tepisawah/ui";
