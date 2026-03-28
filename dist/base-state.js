import { isSSR } from './utils';
// ---------------------------------------------------------------------------
// Abstract base — shared between ReactiveResponsiveState and ContainerState
// ---------------------------------------------------------------------------
export class BaseResponsiveState {
    constructor() {
        this.state = {};
        this.listeners = new Set();
        this.keyListeners = new Map();
        this.mediaQueries = {};
        this.snapshot = {};
        this.batching = false;
        this.pendingKeyChanges = new Map();
        this.debounceMs = 0;
        this.debounceTimer = null;
        this.order = [];
        this.proxy = new Proxy(this.state, {
            set: (target, prop, value) => {
                if (target[prop] !== value) {
                    target[prop] = value;
                    if (this.batching) {
                        this.pendingKeyChanges.set(prop, value);
                    }
                    else {
                        this.notifyKey(prop, value);
                        this.notify();
                    }
                }
                return true;
            },
            get: (target, prop) => target[prop],
        });
    }
    beginApplyConfig() {
        this.batching = true;
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.mediaQueries = {};
    }
    clearStateKeys(newConfig) {
        Object.keys(this.state).forEach(key => {
            if (!(key in newConfig))
                this.notifyKey(key, false);
            delete this.state[key];
        });
    }
    endApplyConfig() {
        this.batching = false;
        this.pendingKeyChanges.forEach((v, k) => this.notifyKey(k, v));
        this.pendingKeyChanges.clear();
        this.flushNotify();
    }
    applyConfig(config) {
        this.beginApplyConfig();
        this.cleanupSources();
        this.clearStateKeys(config);
        this.setupSources(config);
        this.endApplyConfig();
    }
    // ---------------------------------------------------------------------------
    // Notification helpers
    // ---------------------------------------------------------------------------
    notifyKey(key, value) {
        var _a;
        (_a = this.keyListeners.get(key)) === null || _a === void 0 ? void 0 : _a.forEach(cb => cb(value));
    }
    flushNotify() {
        this.snapshot = { ...this.state };
        this.listeners.forEach(l => l(this.snapshot));
    }
    notify() {
        if (this.debounceMs > 0) {
            if (this.debounceTimer !== null)
                clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.debounceTimer = null;
                this.flushNotify();
            }, this.debounceMs);
        }
        else {
            this.flushNotify();
        }
    }
    // ---------------------------------------------------------------------------
    // Public read API
    // ---------------------------------------------------------------------------
    /**
     * Returns a stable snapshot of the current state.
     * Same reference between changes — safe for React's `useSyncExternalStore`.
     */
    getState() {
        return this.snapshot;
    }
    /** Returns the CSS media query strings for each breakpoint key. */
    getMediaQueries() {
        return { ...this.mediaQueries };
    }
    /** Returns the configured breakpoint order (or empty array if not set). */
    getOrder() {
        return [...this.order];
    }
    // ---------------------------------------------------------------------------
    // Ordered breakpoint helpers
    // ---------------------------------------------------------------------------
    effectiveOrder() {
        return this.order.length ? this.order : Object.keys(this.state);
    }
    /**
     * The first active breakpoint key, or `null`.
     * Reads live state — not affected by debounce.
     *
     * @example
     * if (state.current === 'mobile') { ... }
     */
    get current() {
        const ord = this.effectiveOrder();
        for (const key of ord) {
            if (this.state[key])
                return key;
        }
        return null;
    }
    /**
     * Returns `true` when the current breakpoint comes **after** `key` in the order.
     * Requires an `order` option or relies on config key insertion order.
     *
     * @example
     * // current = 'lg', order = ['xs','sm','md','lg','xl']
     * state.isAbove('sm') // → true
     */
    isAbove(key) {
        const ord = this.effectiveOrder();
        const cur = this.current;
        return ord.indexOf(cur !== null && cur !== void 0 ? cur : '') > ord.indexOf(key);
    }
    /**
     * Returns `true` when the current breakpoint comes **before** `key` in the order.
     */
    isBelow(key) {
        const ord = this.effectiveOrder();
        const cur = this.current;
        const curIdx = ord.indexOf(cur !== null && cur !== void 0 ? cur : '');
        const keyIdx = ord.indexOf(key);
        return curIdx !== -1 && curIdx < keyIdx;
    }
    /**
     * Returns `true` when the current breakpoint is between `from` and `to` (inclusive).
     */
    between(from, to) {
        var _a;
        const ord = this.effectiveOrder();
        const idx = ord.indexOf((_a = this.current) !== null && _a !== void 0 ? _a : '');
        return idx !== -1 && idx >= ord.indexOf(from) && idx <= ord.indexOf(to);
    }
    // ---------------------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------------------
    setConfig(config, options) {
        if ((options === null || options === void 0 ? void 0 : options.debounce) !== undefined)
            this.debounceMs = options.debounce;
        if ((options === null || options === void 0 ? void 0 : options.order) !== undefined)
            this.order = options.order;
        this.applyConfig(config);
    }
    // ---------------------------------------------------------------------------
    // Subscription API
    // ---------------------------------------------------------------------------
    /** Subscribes to all state changes. Fires immediately with current state. Affected by `debounce`. */
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.snapshot);
        return () => this.listeners.delete(listener);
    }
    /** Subscribes to a single key. Fires immediately. Never debounced. */
    on(key, callback) {
        var _a;
        if (!this.keyListeners.has(key))
            this.keyListeners.set(key, new Set());
        const set = this.keyListeners.get(key);
        set.add(callback);
        callback((_a = this.state[key]) !== null && _a !== void 0 ? _a : false);
        return () => set.delete(callback);
    }
    /**
     * Fires `callback` only on `false → true` transitions. Skips initial state.
     * Never debounced.
     */
    onEnter(key, callback) {
        var _a;
        let prev = (_a = this.state[key]) !== null && _a !== void 0 ? _a : false;
        return this.on(key, (matches) => {
            const changed = prev !== matches;
            prev = matches;
            if (changed && matches)
                callback();
        });
    }
    /**
     * Fires `callback` only on `true → false` transitions. Skips initial state.
     * Never debounced.
     */
    onLeave(key, callback) {
        var _a;
        let prev = (_a = this.state[key]) !== null && _a !== void 0 ? _a : false;
        return this.on(key, (matches) => {
            const changed = prev !== matches;
            prev = matches;
            if (changed && !matches)
                callback();
        });
    }
    /**
     * Fires `callback` on the **next change** to `key`, then auto-unsubscribes.
     * Does NOT fire for the current value. Never debounced.
     *
     * @example
     * state.once('mobile', (matches) => console.log('mobile changed to', matches));
     */
    once(key, callback) {
        let cleanup = () => { };
        let skippedInit = false;
        cleanup = this.on(key, (matches) => {
            if (!skippedInit) {
                skippedInit = true;
                return;
            }
            cleanup();
            callback(matches);
        });
        return cleanup;
    }
    /**
     * Fires `callback` on the **next global state change**, then auto-unsubscribes.
     * Affected by `debounce`.
     *
     * @example
     * state.onNextChange((s) => console.log('first change:', s));
     */
    onNextChange(callback) {
        let cleanup = () => { };
        let skippedInit = false;
        cleanup = this.subscribe((s) => {
            if (!skippedInit) {
                skippedInit = true;
                return;
            }
            cleanup();
            callback(s);
        });
        return cleanup;
    }
    /**
     * Fires whenever the **active breakpoint** changes (i.e. `current` changes).
     * Provides `from` and `to` for transition-aware logic. Affected by `debounce`.
     */
    onBreakpointChange(callback) {
        let prev = this.current;
        return this.subscribe(() => {
            const next = this.current;
            if (prev !== next) {
                callback(prev, next);
                prev = next;
            }
        });
    }
    /**
     * Returns a Promise that resolves when `key` reaches `expectedValue`.
     * Resolves immediately if condition is already met. Never debounced.
     */
    waitFor(key, expectedValue = true) {
        var _a;
        if (((_a = this.state[key]) !== null && _a !== void 0 ? _a : false) === expectedValue)
            return Promise.resolve();
        return new Promise((resolve) => {
            const off = this.on(key, (matches) => {
                if (matches === expectedValue) {
                    off();
                    resolve();
                }
            });
        });
    }
    // ---------------------------------------------------------------------------
    // Utilities
    // ---------------------------------------------------------------------------
    /**
     * Syncs breakpoint state to CSS custom properties (`1` / `0`).
     * Removes properties for keys deleted by a config change.
     * Returns a stop / cleanup function.
     *
     * @example
     * const stop = state.syncCSSVars({ prefix: '--bp-' });
     * // → --bp-mobile: 1; --bp-desktop: 0; …
     */
    syncCSSVars(options) {
        var _a, _b;
        if (isSSR())
            return () => { };
        const el = (_a = options === null || options === void 0 ? void 0 : options.element) !== null && _a !== void 0 ? _a : document.documentElement;
        const prefix = (_b = options === null || options === void 0 ? void 0 : options.prefix) !== null && _b !== void 0 ? _b : '--responsive-';
        let prevKeys = new Set();
        return this.subscribe((s) => {
            const cur = new Set(Object.keys(s));
            prevKeys.forEach(k => { if (!cur.has(k))
                el.style.removeProperty(`${prefix}${k}`); });
            Object.entries(s).forEach(([k, v]) => el.style.setProperty(`${prefix}${k}`, v ? '1' : '0'));
            prevKeys = cur;
        });
    }
    /**
     * Sets initial state from a server-side snapshot to prevent SSR layout shift.
     * Only updates keys that exist in the current config.
     */
    hydrate(initialState) {
        let changed = false;
        Object.entries(initialState).forEach(([key, value]) => {
            if (key in this.state && this.state[key] !== value) {
                this.state[key] = value;
                this.notifyKey(key, value);
                changed = true;
            }
        });
        if (changed)
            this.flushNotify();
    }
    /**
     * Binds a breakpoint key to a writable signal from any signals library
     * (`@preact/signals-core`, Angular `signal()`, Vue `ref()`, etc.).
     * The signal is kept in sync via `on()`.
     *
     * @example
     * import { signal } from '@preact/signals-core';
     * const mobile = state.toSignal('mobile', signal);
     * mobile.value; // reactive boolean
     *
     * @example
     * // Vue ref
     * import { ref } from 'vue';
     * const mobile = state.toSignal('mobile', ref);
     */
    toSignal(key, factory) {
        var _a;
        const sig = factory((_a = this.state[key]) !== null && _a !== void 0 ? _a : false);
        this.on(key, (v) => { sig.value = v; });
        return sig;
    }
    /**
     * Dispatches DOM `CustomEvent`s on `target` whenever breakpoints change.
     *
     * Events fired:
     * - `responsive:change`  — on any state change (`detail` = full state snapshot)
     * - `responsive:mobile:enter` / `responsive:mobile:leave` — per-key transitions
     *
     * Returns a cleanup / stop function.
     *
     * @example
     * const stop = state.emitDOMEvents(document, { prefix: 'bp:' });
     * document.addEventListener('bp:mobile:enter', () => initDrawer());
     */
    emitDOMEvents(target = document, options) {
        var _a;
        if (isSSR())
            return () => { };
        const prefix = (_a = options === null || options === void 0 ? void 0 : options.prefix) !== null && _a !== void 0 ? _a : 'responsive:';
        let prev = {};
        let initialized = false;
        return this.subscribe((state) => {
            if (!initialized) {
                initialized = true;
                prev = { ...state };
                return;
            }
            target.dispatchEvent(new CustomEvent(`${prefix}change`, {
                detail: { ...state },
                bubbles: true,
            }));
            const allKeys = new Set([...Object.keys(prev), ...Object.keys(state)]);
            allKeys.forEach(key => {
                const was = prev[key] === true;
                const now = state[key] === true;
                if (!was && now) {
                    target.dispatchEvent(new CustomEvent(`${prefix}${key}:enter`, { bubbles: true }));
                }
                else if (was && !now) {
                    target.dispatchEvent(new CustomEvent(`${prefix}${key}:leave`, { bubbles: true }));
                }
            });
            prev = { ...state };
        });
    }
    /**
     * Removes all `matchMedia` / `ResizeObserver` listeners, clears all
     * subscribers, and cancels any pending debounce timer.
     */
    destroy() {
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.cleanupSources();
        this.listeners.clear();
        this.keyListeners.clear();
    }
}
