# @tepisawah/ui

> **Status: Phase 0 scaffold.** Design tokens, primitives, icons, and presentational components only — no business logic, no data fetching.

The shared React component library used by every app. Presentational and
composable: components know nothing about orders, payments, or Supabase.

## Structure

```
src/
  tokens/      # Design tokens: color, spacing, typography, radius, shadow
  primitives/  # Low-level building blocks (Box, Text, Stack, …)
  icons/       # Icon set as React components
  components/  # Higher-level presentational components
  index.ts     # Public surface
```

## Usage

```tsx
import { Button, Card } from "@tepisawah/ui";
```

## Conventions

- Components consume tokens, never hard-coded style values.
- Accessibility is a first-class requirement: every interactive primitive forwards
  refs and accepts standard ARIA props.
- Business-domain components belong in an app's `features/`, not here.
- Only dependency: `react` + `react-dom`.

## Build

```bash
pnpm --filter @tepisawah/ui typecheck
```
