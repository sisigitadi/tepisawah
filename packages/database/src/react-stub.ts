/**
 * Build-time stand-in for `react`, aliased only when producing the Node `dist`
 * bundle (`vite build`).
 *
 * The board-channel hook is a genuine React hook and the apps consume it
 * straight from `src/index.ts` through their own bundler, which supplies the
 * real React. The `dist` barrel, though, is a self-contained Node module for
 * tooling — the smoke-test script, ad-hoc REPL work — and must `import()` with
 * no DOM or React dependency installed. These no-op exports keep that import
 * resolvable; the hook is never mounted in Node, so it never runs.
 *
 * This file is a build alias, not a module graph member: nothing imports it by
 * path, and `vite.config.ts` points the bare `react` specifier at it.
 */
export const useEffect = () => {};
export const useRef = () => ({ current: undefined });
export const useState = () => [undefined, () => {}];
export const useCallback = (fn: unknown) => fn;
export const useMemo = (fn: unknown) => fn;
export const useContext = () => undefined;
