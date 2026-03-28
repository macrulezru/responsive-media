import { useSyncExternalStore, useEffect, useRef, useState } from 'react';
import { responsiveState } from './create-responsive';
import { subscribeMediaQuery } from './media-query';
import { createContainerState } from './container-state';
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
export function useResponsive() {
    return useSyncExternalStore((onChange) => responsiveState.subscribe(() => onChange()), () => responsiveState.getState(), () => responsiveState.getState());
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
export function useBreakpoints() {
    // Subscribe to state so the component re-renders on changes
    useResponsive();
    return {
        current: responsiveState.current,
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
export function useMediaQuery(query) {
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
export function useContainerState(ref, config, options) {
    const [state, setState] = useState({});
    useEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        const cs = createContainerState(el, config, options);
        const off = cs.subscribe((s) => setState({ ...s }));
        return () => { off(); cs.destroy(); };
        // config / options are treated as static after mount; memoize if needed
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return state;
}
