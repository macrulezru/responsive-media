import type { RefObject } from 'react';
import type { MediaQueryConfig, ResponsiveState, SetConfigOptions } from './create-responsive';
/**
 * Returns the current responsive state. Re-renders only when state changes.
 * Requires React 18+. Generic `T` narrows the type for custom configs.
 *
 * @example
 * type MyState = { sm: boolean; lg: boolean };
 * const { sm, lg } = useResponsive<MyState>();
 */
export declare function useResponsive<T extends Record<string, boolean> = ResponsiveState>(): T;
export interface BreakpointHelpers {
    /** First active breakpoint key, or `null`. */
    current: string | null;
    /** `true` when the current breakpoint is after `key` in the order. */
    isAbove: (key: string) => boolean;
    /** `true` when the current breakpoint is before `key` in the order. */
    isBelow: (key: string) => boolean;
    /** `true` when the current breakpoint is between `from` and `to` (inclusive). */
    between: (from: string, to: string) => boolean;
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
export declare function useBreakpoints(): BreakpointHelpers;
/**
 * Returns a boolean that tracks a raw CSS media query string.
 * Compatible with React 18+ SSR (returns `false` on the server).
 *
 * @example
 * const isDark   = useMediaQuery('(prefers-color-scheme: dark)');
 * const canHover = useMediaQuery('(hover: hover)');
 */
export declare function useMediaQuery(query: string): boolean;
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
export declare function useContainerState(ref: RefObject<Element | null>, config: Record<string, MediaQueryConfig>, options?: SetConfigOptions): Record<string, boolean>;
