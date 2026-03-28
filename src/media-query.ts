/**
 * Low-level reactive wrapper around a single raw CSS media query string.
 * Framework-agnostic — Vue and React adapters live in their own files.
 */

function isSSR(): boolean {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function';
}

/**
 * Subscribes to a raw CSS media query string. The callback is called immediately
 * with the current match state and again whenever it changes.
 * Returns an unsubscribe / cleanup function.
 *
 * @example
 * const off = subscribeMediaQuery('(prefers-color-scheme: dark)', (matches) => {
 *   document.body.classList.toggle('dark', matches);
 * });
 * // Later:
 * off();
 */
export function subscribeMediaQuery(
  query: string,
  callback: (matches: boolean) => void,
): () => void {
  if (isSSR()) {
    callback(false);
    return () => {};
  }

  const mql = window.matchMedia(query);
  const handler = (e: MediaQueryListEvent) => callback(e.matches);
  mql.addEventListener('change', handler);
  callback(mql.matches);

  return () => mql.removeEventListener('change', handler);
}
