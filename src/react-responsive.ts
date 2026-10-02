import { useSyncExternalStore, useEffect, useRef, useState, useCallback } from 'react';
import type { RefObject } from 'react';
import { responsiveState, match } from './create-responsive';
import type { MediaQueryConfig, ResponsiveState, SetConfigOptions } from './create-responsive';
import { subscribeMediaQuery } from './media-query';
import { createContainerState } from './container-state';
import type { ConfigToState } from './responsive.enum';
import { setResponsiveConfig } from './create-responsive';
import { getUserPreferencesState } from './user-preferences';
import type { UserPreferences } from './user-preferences';
import { getViewportSize, subscribeViewportSize } from './viewport-size';
import type { SubscribeViewportSizeOptions } from './viewport-size';
import type { ViewportSize } from './size';

// ---------------------------------------------------------------------------
// useResponsive
// ---------------------------------------------------------------------------

/**
 * Returns the current responsive state. Re-renders only when state changes.
 * Requires React 18+. Generic `T` narrows the type for custom configs.
 *
 * @example
 * type MyState = { sm: boolean; lg: boolean };
 * const { sm, lg } = useResponsive<MyState>();
 */
export function useResponsive<
  T extends Record<string, boolean> = ResponsiveState,
>(): T {
  return useSyncExternalStore(
    (onChange) => responsiveState.subscribe(() => onChange()),
    () => responsiveState.getState<T>(),
    () => responsiveState.getSsrState<T>(),
  );
}

// ---------------------------------------------------------------------------
// useBreakpoints
// ---------------------------------------------------------------------------

export interface BreakpointHelpers<K extends string = string> {
  /** First active breakpoint key, or `null`. */
  current: K | null;
  /** `true` when the current breakpoint is after `key` in the order. */
  isAbove: (key: K) => boolean;
  /** `true` when the current breakpoint is before `key` in the order. */
  isBelow: (key: K) => boolean;
  /** `true` when the current breakpoint is between `from` and `to` (inclusive). */
  between: (from: K, to: K) => boolean;
}

/**
 * Returns ordered breakpoint helpers. Re-renders when the responsive state
 * changes, so all helpers always reflect the current breakpoint.
 *
 * Requires a breakpoint `order` set via `setResponsiveConfig` or
 * `createResponsiveState`. Falls back to config key insertion order.
 *
 * @example
 * const { current, isAbove, isBelow, between } = useBreakpoints();
 * return isAbove('sm') ? <DesktopNav /> : <MobileNav />;
 */
export function useBreakpoints<K extends string = string>(): BreakpointHelpers<K> {
  // Subscribe to state so the component re-renders on changes
  useResponsive();

  return {
    current: responsiveState.current as K | null,
    isAbove: (key) => responsiveState.isAbove(key),
    isBelow: (key) => responsiveState.isBelow(key),
    between: (from, to) => responsiveState.between(from, to),
  };
}

// ---------------------------------------------------------------------------
// useMediaQuery
// ---------------------------------------------------------------------------

/**
 * Returns a boolean that tracks a raw CSS media query string.
 * Compatible with React 18+ SSR (returns `false` on the server).
 *
 * @example
 * const isDark   = useMediaQuery('(prefers-color-scheme: dark)');
 * const canHover = useMediaQuery('(hover: hover)');
 */
export function useMediaQuery(query: string): boolean {
  const queryRef = useRef(query);
  queryRef.current = query;
  const [matches, setMatches] = useState(false);
  useEffect(() => subscribeMediaQuery(queryRef.current, setMatches), [query]);
  return matches;
}

// ---------------------------------------------------------------------------
// useContainerState
// ---------------------------------------------------------------------------

/**
 * Tracks an element's dimensions with `ResizeObserver` and evaluates
 * breakpoint conditions in JavaScript (Container Queries).
 *
 * Pass a `ref` created with `useRef<Element>(null)` — the hook sets up the
 * observer after mount and cleans up on unmount.
 *
 * @example
 * function Card() {
 *   const ref = useRef<HTMLDivElement>(null);
 *   const { compact, wide } = useContainerState(ref, {
 *     compact: [{ type: 'max-width', value: 300 }],
 *     wide:    [{ type: 'min-width', value: 600 }],
 *   });
 *   return (
 *     <div ref={ref}>
 *       {compact ? <CompactLayout /> : wide ? <WideLayout /> : <DefaultLayout />}
 *     </div>
 *   );
 * }
 */
export function useContainerState<C extends Record<string, MediaQueryConfig>>(
  ref: RefObject<Element | null>,
  config: C,
  options?: SetConfigOptions,
): ConfigToState<C> {
  const [state, setState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cs: ReturnType<typeof createContainerState> | undefined;
    let off: (() => void) | undefined;
    let rafId: number | undefined;

    function trySetup(): void {
      const el = ref.current;
      if (!el) {
        // A plain RefObject has no change notification of its own (unlike
        // Vue's reactive Ref, which the equivalent watchEffect-based
        // useContainerState re-runs on automatically) — ref.current can
        // still become non-null on a later render (an element behind a
        // conditional render, a portal, a child ref set after this effect's
        // own commit), so poll for it instead of giving up after the very
        // first check.
        rafId = requestAnimationFrame(trySetup);
        return;
      }
      cs = createContainerState(el, config, options);
      off = cs.subscribe((s) => setState({ ...s }));
    }

    trySetup();

    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      off?.();
      cs?.destroy();
    };
    // config / options are treated as static after mount; memoize if needed
  }, []);

  return state as ConfigToState<C>;
}

export function useResponsiveValue<T>(map: Record<string, T>, fallback?: T): T | undefined {
  const state = useResponsive();
  return match(state, map, fallback);
}

function subscribeUserPreferences(onChange: () => void): () => void {
  return getUserPreferencesState().subscribe(() => onChange());
}

function getUserPreferencesSnapshot(): UserPreferences {
  return getUserPreferencesState().getState<Record<string, boolean>>() as unknown as UserPreferences;
}

function getUserPreferencesServerSnapshot(): UserPreferences {
  return getUserPreferencesState().getSsrState<Record<string, boolean>>() as unknown as UserPreferences;
}

export function useUserPreferences(): UserPreferences {
  return useSyncExternalStore(
    subscribeUserPreferences,
    getUserPreferencesSnapshot,
    getUserPreferencesServerSnapshot,
  );
}

const SERVER_VIEWPORT_SIZE: ViewportSize = { width: 0, height: 0 };
let viewportSnapshot: ViewportSize | null = null;

function getViewportSnapshot(): ViewportSize {
  if (viewportSnapshot === null) viewportSnapshot = getViewportSize();
  return viewportSnapshot;
}

function getServerViewportSnapshot(): ViewportSize {
  return SERVER_VIEWPORT_SIZE;
}

export function useViewportSize(options?: SubscribeViewportSizeOptions): ViewportSize {
  const throttle = options?.throttle;
  const subscribe = useCallback(
    (onChange: () => void) =>
      subscribeViewportSize((size) => {
        if (
          viewportSnapshot === null ||
          viewportSnapshot.width !== size.width ||
          viewportSnapshot.height !== size.height
        ) {
          viewportSnapshot = size;
          onChange();
        }
      }, { throttle }),
    [throttle],
  );
  return useSyncExternalStore(subscribe, getViewportSnapshot, getServerViewportSnapshot);
}

export function defineResponsive<C extends Record<string, MediaQueryConfig>>(
  config: C,
  options?: SetConfigOptions,
) {
  setResponsiveConfig(config, options);
  return {
    useResponsive: () => useResponsive<ConfigToState<C>>(),
    useBreakpoints: () => useBreakpoints<Extract<keyof C, string>>(),
    useResponsiveValue: <T>(map: Partial<Record<Extract<keyof C, string>, T>>, fallback?: T) =>
      useResponsiveValue<T>(map as Record<string, T>, fallback),
  };
}
