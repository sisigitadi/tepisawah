/**
 * @tepisawah/pos — logger.
 *
 * Phase 0 scaffold: structure and tooling only.
 * Thin wrapper so logging stays consistent and can be swapped for telemetry later.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, message: string, context?: unknown): void {
  const payload = context === undefined ? message : { message, context };
  console[level](payload);
}

export const logger = {
  debug: (message: string, context?: unknown) => log("debug", message, context),
  info: (message: string, context?: unknown) => log("info", message, context),
  warn: (message: string, context?: unknown) => log("warn", message, context),
  error: (message: string, context?: unknown) => log("error", message, context),
};
