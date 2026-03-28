import {
  inject,
  reactive,
  ref,
  computed,
  watchEffect,
  onUnmounted,
  getCurrentInstance,
} from '@vue/runtime-core';
import type { App, Ref, ComputedRef } from '@vue/runtime-core';
import { responsiveState, setResponsiveConfig } from './create-responsive';
import type { MediaQueryConfig, ResponsiveState, SetConfigOptions } from './create-responsive';
import { subscribeMediaQuery } from './media-query';
import { createContainerState } from './container-state';

// ---------------------------------------------------------------------------
// Shared Vue reactive state (singleton per Vue app)
// ---------------------------------------------------------------------------

const RESPONSIVE_KEY = Symbol('responsiveState');
let vueReactiveState: ResponsiveState | null = null;

function ensureVueState(): ResponsiveState {
  if (vueReactiveState) return vueReactiveState;

  vueReactiveState = reactive<ResponsiveState>({ ...responsiveState.getState() });

  responsiveState.subscribe((state) => {
    Object.keys(vueReactiveState!).forEach(key => {
      if (!(key in state)) delete (vueReactiveState as ResponsiveState)[key];
    });
    Object.assign(vueReactiveState!, state);
  });

  return vueReactiveState;
}

// ---------------------------------------------------------------------------
// useResponsive
// ---------------------------------------------------------------------------

/**
 * Returns the reactive responsive state.
 * Generic `T` narrows the type for custom configs.
 *
 * @example
 * type MyState = { sm: boolean; lg: boolean };
 * const state = useResponsive<MyState>();
 */
export function useResponsive<
  T extends Record<string, boolean> = Record<string, boolean>,
>(): T {
  const injected = inject<T>(RESPONSIVE_KEY as symbol, null as unknown as T);
  if (injected !== null) return injected;
  return ensureVueState() as unknown as T;
}

// ---------------------------------------------------------------------------
// useBreakpoints
// ---------------------------------------------------------------------------

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
export function useBreakpoints(): BreakpointHelpers {
  const state = ensureVueState();

  // Reads from Vue reactive state → Vue tracks these as dependencies
  function getCurrent(): string | null {
    const order = responsiveState.getOrder();
    const keys = order.length ? order : Object.keys(state);
    return keys.find(k => (state as Record<string, boolean>)[k]) ?? null;
  }

  function getOrder(): string[] {
    const order = responsiveState.getOrder();
    return order.length ? order : Object.keys(state);
  }

  return {
    current: computed(getCurrent),

    isAbove(key: string): boolean {
      const ord = getOrder();
      const cur = getCurrent();
      return ord.indexOf(cur ?? '') > ord.indexOf(key);
    },

    isBelow(key: string): boolean {
      const ord = getOrder();
      const cur = getCurrent();
      const curIdx = ord.indexOf(cur ?? '');
      const keyIdx = ord.indexOf(key);
      return curIdx !== -1 && curIdx < keyIdx;
    },

    between(from: string, to: string): boolean {
      const ord = getOrder();
      const idx = ord.indexOf(getCurrent() ?? '');
      return idx !== -1 && idx >= ord.indexOf(from) && idx <= ord.indexOf(to);
    },
  };
}

// ---------------------------------------------------------------------------
// useMediaQuery
// ---------------------------------------------------------------------------

/**
 * Reactive composable for a single raw CSS media query string.
 * Returns a `Ref<boolean>`. Cleans up automatically on `onUnmounted`.
 *
 * @example
 * const isDark   = useMediaQuery('(prefers-color-scheme: dark)');
 * const canHover = useMediaQuery('(hover: hover)');
 */
export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(false);
  const off = subscribeMediaQuery(query, (v) => { matches.value = v; });
  if (getCurrentInstance()) onUnmounted(off);
  return matches;
}

// ---------------------------------------------------------------------------
// useContainerState
// ---------------------------------------------------------------------------

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
export function useContainerState(
  elementRef: Ref<Element | null>,
  config: Record<string, MediaQueryConfig>,
  options?: SetConfigOptions,
): ResponsiveState {
  const state = reactive<ResponsiveState>({});

  watchEffect((cleanup) => {
    const el = elementRef.value;
    if (!el) return;

    const cs = createContainerState(el, config, options);

    const off = cs.subscribe((s) => {
      Object.keys(state).forEach(k => { if (!(k in s)) delete state[k]; });
      Object.assign(state, s);
    });

    cleanup(() => {
      off();
      cs.destroy();
    });
  });

  return state;
}

// ---------------------------------------------------------------------------
// ResponsivePlugin
// ---------------------------------------------------------------------------

/**
 * Vue plugin that registers the responsive state via `provide`.
 *
 * @example
 * app.use(ResponsivePlugin, {
 *   sm: [{ type: 'max-width', value: 640 }],
 *   lg: [{ type: 'min-width', value: 1024 }],
 * });
 */
export const ResponsivePlugin = {
  install(app: App, config?: Record<string, MediaQueryConfig>) {
    if (config) setResponsiveConfig(config);
    app.provide(RESPONSIVE_KEY, ensureVueState());
  },
};
