/**
 * Environment names and resolution.
 *
 * Values are read from Vite's `import.meta.env` in apps; this module stays
 * framework-agnostic by accepting an injected record.
 */
export const ENVIRONMENTS = {
  development: "development",
  staging: "staging",
  production: "production",
} as const;

export type Environment = (typeof ENVIRONMENTS)[keyof typeof ENVIRONMENTS];

/** Resolve an environment name from a record like `import.meta.env`. */
export function resolveEnvironment(
  env: Record<string, string | undefined>,
): Environment {
  const raw = env.MODE ?? env.NODE_ENV ?? ENVIRONMENTS.development;
  switch (raw) {
    case ENVIRONMENTS.production:
      return ENVIRONMENTS.production;
    case ENVIRONMENTS.staging:
      return ENVIRONMENTS.staging;
    default:
      return ENVIRONMENTS.development;
  }
}
