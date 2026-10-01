/**
 * Query layer entry point.
 *
 * Apps must prefer the command contract over raw queries whenever a contract
 * exists (REPOSITORY_STRUCTURE.md §35).
 */
export * from "./profile.js";
export * from "./authorization.js";
export * from "./catalog.js";
export * from "./catalog-public.js";
export * from "./tables.js";
export * from "./tables-public.js";
export * from "./sessions.js";
export * from "./orders.js";
export * from "./order-board-channel.js";
export * from "./settings.js";
