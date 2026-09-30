/**
 * @tepisawah/ui — color tokens.
 *
 * Semantic palette for the Tepi Sawah design system
 * (TepiSawah_Master_Design_System_v1.0). Values are raw CSS colors so they can
 * be consumed from inline styles or projected into CSS custom properties.
 */

export const colors = {
  /** Brand green — padi / rice field. */
  brand: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
    950: "#052e16",
  },
  /** Accent amber — harvest / warm highlight. */
  accent: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
    950: "#451a03",
  },
  /** Neutral warm stone. */
  neutral: {
    0: "#ffffff",
    50: "#fafaf9",
    100: "#f5f5f4",
    200: "#e7e5e4",
    300: "#d6d3d1",
    400: "#a8a29e",
    500: "#78716c",
    600: "#57534e",
    700: "#44403c",
    800: "#292524",
    900: "#1c1917",
    950: "#0c0a09",
  },
  /** Semantic status colors. */
  semantic: {
    success: "#16a34a",
    successFaint: "#dcfce7",
    warning: "#d97706",
    warningFaint: "#fef3c7",
    error: "#dc2626",
    errorFaint: "#fee2e2",
    info: "#2563eb",
    infoFaint: "#dbeafe",
  },
} as const;

/** Foreground / background pairs for light surfaces. */
export const surface = {
  background: colors.neutral[50],
  surface: colors.neutral[0],
  surfaceMuted: colors.neutral[100],
  foreground: colors.neutral[900],
  foregroundMuted: colors.neutral[600],
  foregroundSubtle: colors.neutral[400],
  border: colors.neutral[200],
  borderStrong: colors.neutral[300],
  brand: colors.brand[600],
  brandFaint: colors.brand[50],
} as const;

export type ColorScale = keyof typeof colors;
export type SurfaceToken = keyof typeof surface;
