/**
 * A controllable mock for window.matchMedia.
 *
 * Usage:
 *   const mock = createMatchMediaMock();
 *   mock.install();           // replaces window.matchMedia
 *   mock.setMatch('(max-width: 600px)', true);  // fires change listeners
 *   mock.uninstall();         // restores original
 */

type ChangeListener = (event: Pick<MediaQueryListEvent, 'matches'>) => void;

interface MockEntry {
  matches: boolean;
  listeners: Set<ChangeListener>;
}

export interface MatchMediaMock {
  install(): void;
  uninstall(): void;
  /** Sets the match value and fires all registered change listeners for that query. */
  setMatch(query: string, matches: boolean): void;
  /** Returns how many active change listeners exist for a query (useful for leak detection). */
  listenerCount(query: string): number;
  reset(): void;
}

export function createMatchMediaMock(): MatchMediaMock {
  const registry = new Map<string, MockEntry>();
  let original: typeof window.matchMedia | undefined;

  function getOrCreate(query: string): MockEntry {
    if (!registry.has(query)) {
      registry.set(query, { matches: false, listeners: new Set() });
    }
    return registry.get(query)!;
  }

  return {
    install() {
      original = window.matchMedia;
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: (query: string) => {
          const entry = getOrCreate(query);
          return {
            get matches() { return entry.matches; },
            media: query,
            onchange: null,
            addEventListener(event: string, cb: ChangeListener) {
              if (event === 'change') entry.listeners.add(cb);
            },
            removeEventListener(event: string, cb: ChangeListener) {
              if (event === 'change') entry.listeners.delete(cb);
            },
            dispatchEvent: () => false,
            addListener: () => {},
            removeListener: () => {},
          } satisfies MediaQueryList;
        },
      });
    },

    uninstall() {
      if (original !== undefined) {
        Object.defineProperty(window, 'matchMedia', {
          writable: true,
          configurable: true,
          value: original,
        });
      }
    },

    setMatch(query, matches) {
      const entry = getOrCreate(query);
      entry.matches = matches;
      entry.listeners.forEach(cb => cb({ matches }));
    },

    listenerCount(query) {
      return registry.get(query)?.listeners.size ?? 0;
    },

    reset() {
      registry.clear();
    },
  };
}
