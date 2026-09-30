/**
 * @tepisawah/ui — spacing tokens.
 *
 * A 4px base unit scale shared by layout primitives.
 */

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export type SpacingToken = keyof typeof spacing;

/** Pixel value for a spacing token, with a fallback for raw numbers. */
export function spacingValue(token: SpacingToken | number): number {
  return typeof token === "number" ? token : spacing[token];
}
