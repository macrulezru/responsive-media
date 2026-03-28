import { inject, reactive, ref, computed, watchEffect, onUnmounted, getCurrentInstance, } from '@vue/runtime-core';
import { responsiveState, setResponsiveConfig } from './create-responsive';
import { subscribeMediaQuery } from './media-query';
import { createContainerState } from './container-state';
// ---------------------------------------------------------------------------
// Shared Vue reactive state (singleton per Vue app)
// ---------------------------------------------------------------------------
const RESPONSIVE_KEY = Symbol('responsiveState');
let vueReactiveState = null;
function ensureVueState() {
    if (vueReactiveState)
        return vueReactiveState;
    vueReactiveState = reactive({ ...responsiveState.getState() });
    responsiveState.subscribe((state) => {
        Object.keys(vueReactiveState).forEach(key => {
            if (!(key in state))
                delete vueReactiveState[key];
        });
        Object.assign(vueReactiveState, state);
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
export function useResponsive() {
    const injected = inject(RESPONSIVE_KEY, null);
    if (injected !== null)
        return injected;
    return ensureVueState();
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
export function useBreakpoints() {
    const state = ensureVueState();
    // Reads from Vue reactive state → Vue tracks these as dependencies
    function getCurrent() {
        var _a;
        const order = responsiveState.getOrder();
        const keys = order.length ? order : Object.keys(state);
        return (_a = keys.find(k => state[k])) !== null && _a !== void 0 ? _a : null;
    }
    function getOrder() {
        const order = responsiveState.getOrder();
        return order.length ? order : Object.keys(state);
    }
    return {
        current: computed(getCurrent),
        isAbove(key) {
            const ord = getOrder();
            const cur = getCurrent();
            return ord.indexOf(cur !== null && cur !== void 0 ? cur : '') > ord.indexOf(key);
        },
        isBelow(key) {
            const ord = getOrder();
            const cur = getCurrent();
            const curIdx = ord.indexOf(cur !== null && cur !== void 0 ? cur : '');
            const keyIdx = ord.indexOf(key);
            return curIdx !== -1 && curIdx < keyIdx;
        },
        between(from, to) {
            var _a;
            const ord = getOrder();
            const idx = ord.indexOf((_a = getCurrent()) !== null && _a !== void 0 ? _a : '');
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
export function useMediaQuery(query) {
    const matches = ref(false);
    const off = subscribeMediaQuery(query, (v) => { matches.value = v; });
    if (getCurrentInstance())
        onUnmounted(off);
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
export function useContainerState(elementRef, config, options) {
    const state = reactive({});
    watchEffect((cleanup) => {
        const el = elementRef.value;
        if (!el)
            return;
        const cs = createContainerState(el, config, options);
        const off = cs.subscribe((s) => {
            Object.keys(state).forEach(k => { if (!(k in s))
                delete state[k]; });
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
    install(app, config) {
        if (config)
            setResponsiveConfig(config);
        app.provide(RESPONSIVE_KEY, ensureVueState());
    },
};
