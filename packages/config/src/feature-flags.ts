/**
 * Feature flag registry.
 *
 * Flags are declared here so every app reads the same names; backing store /
 * evaluation wiring arrives in a later phase.
 */
export const FEATURE_FLAGS = {
  /** Online ordering flow on the public web app. */
  onlineOrdering: "online_ordering",
  /** QRIS dynamic QR generation for payments. */
  qrisPayments: "qris_payments",
  /** Realtime kitchen display updates. */
  realtimeKitchen: "realtime_kitchen",
} as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/** Placeholder evaluator; concrete implementation comes post-Phase 0. */
export function isFeatureEnabled(_flag: FeatureFlag): boolean {
  return false;
}
