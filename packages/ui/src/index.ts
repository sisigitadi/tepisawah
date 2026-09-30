/**
 * @tepisawah/ui — shared component library.
 *
 * Export surface for React components, primitives, icons and design tokens.
 * Apps import components from `@tepisawah/ui`; tokens are re-exported for the
 * rare cases where a layout needs the raw values.
 *
 * Business rules live in the domain packages (`@tepisawah/orders`,
 * `@tepisawah/payments`, ...), never here. This package renders whatever state
 * it is given.
 */

export * from "./tokens/index.js";
export * from "./primitives/index.js";
export * from "./icons/index.js";
export * from "./components/index.js";
