/**
 * Vue 3 adapter — import from 'responsive-media/vue', not the package root.
 * Kept as its own entry (mirroring 'responsive-media/react') specifically so this
 * file's static `@vue/runtime-core` import never reaches a consumer who doesn't
 * use Vue.
 */
import {
  inject,
  reactive,
  ref,
  computed,
  watch,
  watchEffect,
  nextTick,
  toValue,
  onUnmounted,
  getCurrentInstance,
} from '@vue/runtime-core';
import type { App, Ref, ComputedRef, MaybeRefOrGetter } from '@vue/runtime-core';
import { responsiveState, setResponsiveConfig, createResponsiveState, match } from './create-responsive';
import type {
  MediaQueryConfig,
  ResponsiveState,
  SetConfigOptions,
  ReactiveResponsiveState,
} from './create-responsive';
import { subscribeMediaQuery } from './media-query';
import { createContainerState } from './container-state';
import type { ConfigToState } from './responsive.enum';
import { hasMatchMedia } from './utils';
import { getUserPreferencesState } from './user-preferences';
import type { UserPreferences } from './user-preferences';
import { subscribeViewportSize } from './viewport-size';
import type { SubscribeViewportSizeOptions } from './viewport-size';
import type { ViewportSize } from './size';

// ---------------------------------------------------------------------------
// Shared Vue reactive state (singleton per Vue app)
// ---------------------------------------------------------------------------

// Exported (not just module-private) so a consumer can `provide(RESPONSIVE_KEY, ...)`
// a custom/mock state themselves — e.g. for testing, or a subtree that should read
// different breakpoint data than the app-wide default. useResponsive()/
// useBreakpoints() both honor whatever's found under this key via inject().
export const RESPONSIVE_KEY = Symbol('responsiveState');
let vueReactiveState: ResponsiveState | null = null;

const sourceByMirror = new WeakMap<object, ReactiveResponsiveState>();

interface AppMirror {
  state: ResponsiveState;
  freeze: (seed: ResponsiveState) => void;
  commit: () => void;
  stop: () => void;
}

function createAppMirror(source: ReactiveResponsiveState): AppMirror {
  const state = reactive<ResponsiveState>({ ...source.getState() });
  sourceByMirror.set(state, source);
  let frozen = false;

  const sync = (next: ResponsiveState) => {
    if (frozen) return;
    Object.keys(state).forEach(key => {
      if (!(key in next)) delete state[key];
    });
    Object.assign(state, next);
  };

  const stop = source.subscribe(sync);

  return {
    state,
    freeze(seed) {
      frozen = true;
      Object.keys(state).forEach(key => delete state[key]);
      Object.assign(state, seed);
    },
    commit() {
      frozen = false;
      sync(source.getState());
    },
    stop,
  };
}

function ensureVueState(): ResponsiveState {
  if (vueReactiveState) return vueReactiveState;
  vueReactiveState = createAppMirror(responsiveState).state;
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

export interface BreakpointHelpers<K extends string = string> {
  /** First active breakpoint key, or `null`. Reactive computed. */
  current: ComputedRef<K | null>;
  /** `true` when the current breakpoint is after `key` in the order. Reactive in templates. */
  isAbove: (key: K) => boolean;
  /** `true` when the current breakpoint is before `key` in the order. Reactive in templates. */
  isBelow: (key: K) => boolean;
  /** `true` when the current breakpoint is between `from` and `to` (inclusive). Reactive in templates. */
  between: (from: K, to: K) => boolean;
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
export function useBreakpoints<K extends string = string>(): BreakpointHelpers<K> {
  // Honors a custom state provided via provide(RESPONSIVE_KEY, ...) — same DI
  // useResponsive() already supports, which useBreakpoints() used to ignore
  // entirely (always reading the global default state regardless of what was
  // injected). The global singleton's own explicit `order` only applies to
  // the global default state itself — a genuinely different injected state
  // falls back to its own key insertion order, same as ensureVueState()'s
  // state does when no explicit order was configured for it either.
  const injected = inject<ResponsiveState>(
    RESPONSIVE_KEY as symbol,
    null as unknown as ResponsiveState,
  );
  const state = injected ?? ensureVueState();
  const source = sourceByMirror.get(state);

  // Reads from Vue reactive state → Vue tracks these as dependencies
  function getOrder(): string[] {
    const order = source ? source.getOrder() : [];
    return order.length ? order : Object.keys(state);
  }

  function getCurrent(): string | null {
    const keys = getOrder();
    return keys.find(k => (state as Record<string, boolean>)[k]) ?? null;
  }

  return {
    current: computed(getCurrent) as ComputedRef<K | null>,

    isAbove(key: string): boolean {
      const ord = getOrder();
      const cur = getCurrent();
      const curIdx = ord.indexOf(cur ?? '');
      const keyIdx = ord.indexOf(key);
      return curIdx !== -1 && keyIdx !== -1 && curIdx > keyIdx;
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

export interface StoppableMediaQueryRef extends Ref<boolean> {
  /**
   * Removes the underlying `matchMedia` listener. Called automatically via
   * `onUnmounted` when there's an active component instance; call this
   * yourself when using `useMediaQuery()` outside one (a Pinia store, a
   * plain factory) — there's no unmount hook to rely on there, so `off` was
   * previously never exposed and the listener leaked for the page's lifetime.
   */
  stop: () => void;
}

/**
 * Reactive composable for a single raw CSS media query string.
 * Returns a `Ref<boolean>` (with an additional `.stop()` for manual cleanup
 * outside a component instance — see `StoppableMediaQueryRef`). Cleans up
 * automatically on `onUnmounted` when called inside one.
 *
 * @example
 * const isDark   = useMediaQuery('(prefers-color-scheme: dark)');
 * const canHover = useMediaQuery('(hover: hover)');
 */
export function useMediaQuery(query: MaybeRefOrGetter<string>): StoppableMediaQueryRef {
  const matches = ref(false) as StoppableMediaQueryRef;
  let off: () => void = () => {};

  const stopWatch = watch(
    () => toValue(query),
    (next) => {
      off();
      off = subscribeMediaQuery(next, (v) => { matches.value = v; });
    },
    { immediate: true },
  );

  matches.stop = () => {
    stopWatch();
    off();
    off = () => {};
  };
  if (getCurrentInstance()) onUnmounted(matches.stop);
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
export function useContainerState<C extends Record<string, MediaQueryConfig>>(
  elementRef: Ref<Element | null>,
  config: C,
  options?: SetConfigOptions,
): ConfigToState<C> {
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

  return state as unknown as ConfigToState<C>;
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

export type HydrationMode = 'immediate' | 'deferred';

export interface DefineResponsiveOptions extends SetConfigOptions {
  hydration?: HydrationMode;
}

export interface ResponsivePluginOptions {
  ssrState?: Record<string, boolean>;
  hydration?: HydrationMode;
  hydrating?: boolean;
}

function wrapMount(app: App, mirror: AppMirror, seed: ResponsiveState, hydrating: boolean | undefined): void {
  const original = app.mount;
  app.mount = ((container: string | Element, ...rest: unknown[]) => {
    const element = typeof container === 'string' ? document.querySelector(container) : container;
    const isHydrating = hydrating ?? (element instanceof Element && element.hasChildNodes());
    if (isHydrating) mirror.freeze(seed);
    const result = (original as (...args: unknown[]) => unknown).call(app, container, ...rest);
    if (isHydrating) nextTick(() => mirror.commit());
    return result;
  }) as typeof app.mount;
}

export function useResponsiveValue<T>(map: Record<string, T>, fallback?: T): ComputedRef<T | undefined> {
  const state = useResponsive();
  return computed(() => match(state, map, fallback));
}

let preferencesMirror: UserPreferences | null = null;

export function useUserPreferences(): UserPreferences {
  if (preferencesMirror === null) {
    preferencesMirror = createAppMirror(getUserPreferencesState()).state as unknown as UserPreferences;
  }
  return preferencesMirror;
}

export interface StoppableViewportSize extends ViewportSize {
  stop: () => void;
}

export function useViewportSize(options?: SubscribeViewportSizeOptions): StoppableViewportSize {
  const size = reactive({ width: 0, height: 0, stop: () => {} });
  const off = subscribeViewportSize((next) => {
    size.width = next.width;
    size.height = next.height;
  }, options);
  size.stop = off;
  if (getCurrentInstance()) onUnmounted(off);
  return size;
}

export function defineResponsive<C extends Record<string, MediaQueryConfig>>(
  config: C,
  options?: DefineResponsiveOptions,
) {
  const { hydration, ...settings } = options ?? {};
  setResponsiveConfig(config, settings);
  return {
    useResponsive: () => useResponsive<ConfigToState<C>>(),
    useBreakpoints: () => useBreakpoints<Extract<keyof C, string>>(),
    useResponsiveValue: <T>(map: Partial<Record<Extract<keyof C, string>, T>>, fallback?: T) =>
      useResponsiveValue<T>(map as Record<string, T>, fallback),
    plugin: {
      install(app: App, installOptions: ResponsivePluginOptions = {}) {
        const mode = installOptions.hydration ?? hydration ?? 'immediate';
        const ssrState = installOptions.ssrState ?? settings.ssrState;

        if (!hasMatchMedia()) {
          const source = createResponsiveState(config, { ...settings, ssrState });
          const mirror = createAppMirror(source);
          app.provide(RESPONSIVE_KEY, mirror.state);
          app.onUnmount(() => {
            mirror.stop();
            source.destroy();
          });
          return;
        }

        const mirror = createAppMirror(responsiveState);
        app.provide(RESPONSIVE_KEY, mirror.state);
        if (mode === 'deferred') {
          wrapMount(app, mirror, { ...responsiveState.getSsrState(), ...installOptions.ssrState }, installOptions.hydrating);
        }
      },
    },
  };
}
