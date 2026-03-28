import type { App, Ref, ComputedRef } from '@vue/runtime-core';
import type { MediaQueryConfig, ResponsiveState, SetConfigOptions } from './create-responsive';
/**
 * Returns the reactive responsive state.
 * Generic `T` narrows the type for custom configs.
 *
 * @example
 * type MyState = { sm: boolean; lg: boolean };
 * const state = useResponsive<MyState>();
 */
export declare function useResponsive<T extends Record<string, boolean> = Record<string, boolean>>(): T;
export interface BreakpointHelpers {
    /** First active breakpoint key, or `null`. Reactive computed. */
    current: ComputedRef<string | null>;
    /** `true` when the current breakpoint is after `key` in the order. Reactive in templates. */
    isAbove: (key: string) => boolean;
    /** `true` when the current breakpoint is before `key` in the order. Reactive in templates. */
    isBelow: (key: string) => boolean;
    /** `true` when the current breakpoint is between `from` and `to` (inclusive). Reactive in templates. */
    between: (from: string, to: string) => boolean;
}
/**
 * Returns ordered breakpoint helpers that are **reactive in Vue templates
 * and computed properties** — they read from the Vue reactive state and
 * re-evaluate automatically on viewport changes.
 *
 * Requires a breakpoint `order` to be set via `setConfig` or `createResponsiveState`.
 * Falls back to config key insertion order if none is provided.
 *
 * @example
 * const { current, isAbove, isBelow, between } = useBreakpoints();
 *
 * // In template:
 * // <DesktopNav v-if="isAbove('sm')" />
 * // <span>{{ current }}</span>
 */
export declare function useBreakpoints(): BreakpointHelpers;
/**
 * Reactive composable for a single raw CSS media query string.
 * Returns a `Ref<boolean>`. Cleans up automatically on `onUnmounted`.
 *
 * @example
 * const isDark   = useMediaQuery('(prefers-color-scheme: dark)');
 * const canHover = useMediaQuery('(hover: hover)');
 */
export declare function useMediaQuery(query: string): Ref<boolean>;
/**
 * Reactive composable that tracks an element's dimensions with `ResizeObserver`
 * and evaluates breakpoint conditions in JavaScript (Container Queries).
 *
 * Accepts a `Ref<Element | null>` (e.g. from `useTemplateRef`) — automatically
 * sets up and tears down the observer as the element mounts / unmounts.
 *
 * @example
 * <script setup>
 * const cardRef = useTemplateRef('card');
 * const cardState = useContainerState(cardRef, {
 *   compact: [{ type: 'max-width', value: 300 }],
 *   wide:    [{ type: 'min-width', value: 600 }],
 * });
 * </script>
 *
 * <template>
 *   <div ref="card">
 *     <CompactLayout v-if="cardState.compact" />
 *     <WideLayout v-else-if="cardState.wide" />
 *   </div>
 * </template>
 */
export declare function useContainerState(elementRef: Ref<Element | null>, config: Record<string, MediaQueryConfig>, options?: SetConfigOptions): ResponsiveState;
/**
 * Vue plugin that registers the responsive state via `provide`.
 *
 * @example
 * app.use(ResponsivePlugin, {
 *   sm: [{ type: 'max-width', value: 640 }],
 *   lg: [{ type: 'min-width', value: 1024 }],
 * });
 */
export declare const ResponsivePlugin: {
    install(app: App, config?: Record<string, MediaQueryConfig>): void;
};
