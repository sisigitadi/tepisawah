/**
 * @tepisawah/ui — border radius and elevation tokens.
 */

export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radii;

export const shadows = {
  none: "none",
  xs: "0 1px 2px 0 rgb(28 25 23 / 0.05)",
  sm: "0 1px 3px 0 rgb(28 25 23 / 0.1), 0 1px 2px -1px rgb(28 25 23 / 0.1)",
  md: "0 4px 6px -1px rgb(28 25 23 / 0.1), 0 2px 4px -2px rgb(28 25 23 / 0.1)",
  lg: "0 10px 15px -3px rgb(28 25 23 / 0.1), 0 4px 6px -4px rgb(28 25 23 / 0.1)",
  xl: "0 20px 25px -5px rgb(28 25 23 / 0.1), 0 8px 10px -6px rgb(28 25 23 / 0.1)",
} as const;

export type ShadowToken = keyof typeof shadows;

/** Stacking order for overlaying surfaces (toasts, modals, tooltips). */
export const zIndices = {
  base: 0,
  raised: 10,
  sticky: 100,
  overlay: 900,
  modal: 1000,
  toast: 1100,
  tooltip: 1200,
} as const;

export type ZIndexToken = keyof typeof zIndices;

/** Standard focus ring for keyboard navigation. */
export const focusRing = {
  outline: `2px solid ${"#16a34a"}`,
  outlineOffset: "2px",
} as const;
