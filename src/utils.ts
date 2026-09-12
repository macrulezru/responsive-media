export const isSSR          = (): boolean => typeof window === 'undefined';
export const hasMatchMedia  = (): boolean => !isSSR() && typeof window.matchMedia === 'function';
export const hasResizeObserver = (): boolean => !isSSR() && typeof ResizeObserver === 'function';

/**
 * Dev-mode check for diagnostic warnings that should run while developing
 * but stay silent in production. Reads `process.env.NODE_ENV` rather than
 * `import.meta.env.DEV`: this package builds with plain `tsc` (no bundler of
 * its own), so `import.meta.env.DEV` would never be replaced at all here —
 * `process.env.NODE_ENV` is the convention actually supported by consuming
 * apps' own bundlers (Vite, webpack, rollup, etc.). Reached via `globalThis`
 * with an inline structural type instead of `@types/node`, matching this
 * package's deliberately empty `tsconfig.json` `types: []` (no ambient
 * globals leaking into a library that ships to both browser and Node).
 */
export const isDevMode = (): boolean => {
  const proc = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
  return typeof proc !== 'undefined' && proc.env?.NODE_ENV !== 'production';
};
