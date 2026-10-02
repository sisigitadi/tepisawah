/**
 * Deployment domain mapping (REPOSITORY_STRUCTURE.md §53).
 */
export const DOMAINS = {
  web: "tepisawah.id",
  order: "order.tepisawah.id",
  pos: "pos.tepisawah.id",
  kitchen: "kitchen.tepisawah.id",
  waiter: "waiter.tepisawah.id",
  admin: "admin.tepisawah.id",
  staff: "staff.tepisawah.id",
} as const;

export type AppName = keyof typeof DOMAINS;

/** Base origin for the given app, including scheme. */
export function appOrigin(app: AppName, https = true): string {
  return `${https ? "https" : "http"}://${DOMAINS[app]}`;
}
