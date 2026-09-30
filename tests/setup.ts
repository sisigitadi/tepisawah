/**
 * Global Vitest setup for the jsdom suites.
 *
 * Registers React Testing Library's jest-dom matchers (`toBeInTheDocument`,
 * `toBeDisabled`, …) so auth UI assertions read as behaviour, not markup
 * (docs/qa/TESTING_STRATEGY.md — Layer 2 unit tests).
 */
import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

/*
 * `pnpm -r run test` runs every app's jsdom suite in parallel on one machine.
 * The first test in each file pays jsdom + transform cold start, so RTL's
 * 1000ms default `waitFor` budget is too tight for hydration-gated queries
 * (a form value that lands one render after its heading). Raise the async
 * query ceiling for all suites; fast tests still resolve immediately.
 */
configure({ asyncUtilTimeout: 5000 });
