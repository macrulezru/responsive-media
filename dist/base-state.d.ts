import type { MediaQueryConfig } from './responsive.enum';
export type ResponsiveState = Record<string, boolean>;
export type ResponsiveListener = (state: ResponsiveState) => void;
export interface SetConfigOptions {
    /**
     * Debounce delay in milliseconds for `subscribe` listeners.
     * `on()`, `onEnter()`, `onLeave()`, `once()`, and `waitFor()` are never debounced.
     * Pass `0` to disable (default).
     */
    debounce?: number;
    /**
     * Explicit breakpoint order for `isAbove()`, `isBelow()`, and `between()`.
     * If omitted, config key insertion order is used.
     * @example ['xs', 'sm', 'md', 'lg', 'xl', '2xl']
     */
    order?: string[];
}
export interface SyncCSSVarsOptions {
    /** Target element. Defaults to `document.documentElement`. */
    element?: HTMLElement;
    /** CSS custom property prefix. Defaults to `'--responsive-'`. */
    prefix?: string;
}
export interface EmitDOMEventsOptions {
    /** Custom event prefix. Defaults to `'responsive:'`. */
    prefix?: string;
}
export interface WritableSignal<T> {
    value: T;
}
export type SignalFactory<T> = (initialValue: T) => WritableSignal<T>;
export declare abstract class BaseResponsiveState {
    protected state: ResponsiveState;
    protected listeners: Set<ResponsiveListener>;
    protected keyListeners: Map<string, Set<(matches: boolean) => void>>;
    proxy: ResponsiveState;
    protected mediaQueries: Record<string, string>;
    protected snapshot: ResponsiveState;
    protected batching: boolean;
    protected pendingKeyChanges: Map<string, boolean>;
    protected debounceMs: number;
    protected debounceTimer: ReturnType<typeof setTimeout> | null;
    protected order: string[];
    constructor();
    /** Subclass implements the source-specific setup (matchMedia / ResizeObserver). */
    protected abstract setupSources(config: Record<string, MediaQueryConfig>): void;
    /** Subclass cleans up source listeners (matchMedia handlers / ResizeObserver). */
    protected abstract cleanupSources(): void;
    protected beginApplyConfig(): void;
    protected clearStateKeys(newConfig: Record<string, MediaQueryConfig>): void;
    protected endApplyConfig(): void;
    protected applyConfig(config: Record<string, MediaQueryConfig>): void;
    protected notifyKey(key: string, value: boolean): void;
    protected flushNotify(): void;
    protected notify(): void;
    /**
     * Returns a stable snapshot of the current state.
     * Same reference between changes — safe for React's `useSyncExternalStore`.
     */
    getState<T extends Record<string, boolean> = ResponsiveState>(): T;
    /** Returns the CSS media query strings for each breakpoint key. */
    getMediaQueries(): Record<string, string>;
    /** Returns the configured breakpoint order (or empty array if not set). */
    getOrder(): string[];
    private effectiveOrder;
    /**
     * The first active breakpoint key, or `null`.
     * Reads live state — not affected by debounce.
     *
     * @example
     * if (state.current === 'mobile') { ... }
     */
    get current(): string | null;
    /**
     * Returns `true` when the current breakpoint comes **after** `key` in the order.
     * Requires an `order` option or relies on config key insertion order.
     *
     * @example
     * // current = 'lg', order = ['xs','sm','md','lg','xl']
     * state.isAbove('sm') // → true
     */
    isAbove(key: string): boolean;
    /**
     * Returns `true` when the current breakpoint comes **before** `key` in the order.
     */
    isBelow(key: string): boolean;
    /**
     * Returns `true` when the current breakpoint is between `from` and `to` (inclusive).
     */
    between(from: string, to: string): boolean;
    setConfig(config: Record<string, MediaQueryConfig>, options?: SetConfigOptions): void;
    /** Subscribes to all state changes. Fires immediately with current state. Affected by `debounce`. */
    subscribe(listener: ResponsiveListener): () => void;
    /** Subscribes to a single key. Fires immediately. Never debounced. */
    on(key: string, callback: (matches: boolean) => void): () => void;
    /**
     * Fires `callback` only on `false → true` transitions. Skips initial state.
     * Never debounced.
     */
    onEnter(key: string, callback: () => void): () => void;
    /**
     * Fires `callback` only on `true → false` transitions. Skips initial state.
     * Never debounced.
     */
    onLeave(key: string, callback: () => void): () => void;
    /**
     * Fires `callback` on the **next change** to `key`, then auto-unsubscribes.
     * Does NOT fire for the current value. Never debounced.
     *
     * @example
     * state.once('mobile', (matches) => console.log('mobile changed to', matches));
     */
    once(key: string, callback: (matches: boolean) => void): () => void;
    /**
     * Fires `callback` on the **next global state change**, then auto-unsubscribes.
     * Affected by `debounce`.
     *
     * @example
     * state.onNextChange((s) => console.log('first change:', s));
     */
    onNextChange(callback: (state: ResponsiveState) => void): () => void;
    /**
     * Fires whenever the **active breakpoint** changes (i.e. `current` changes).
     * Provides `from` and `to` for transition-aware logic. Affected by `debounce`.
     */
    onBreakpointChange(callback: (from: string | null, to: string | null) => void): () => void;
    /**
     * Returns a Promise that resolves when `key` reaches `expectedValue`.
     * Resolves immediately if condition is already met. Never debounced.
     */
    waitFor(key: string, expectedValue?: boolean): Promise<void>;
    /**
     * Syncs breakpoint state to CSS custom properties (`1` / `0`).
     * Removes properties for keys deleted by a config change.
     * Returns a stop / cleanup function.
     *
     * @example
     * const stop = state.syncCSSVars({ prefix: '--bp-' });
     * // → --bp-mobile: 1; --bp-desktop: 0; …
     */
    syncCSSVars(options?: SyncCSSVarsOptions): () => void;
    /**
     * Sets initial state from a server-side snapshot to prevent SSR layout shift.
     * Only updates keys that exist in the current config.
     */
    hydrate(initialState: Record<string, boolean>): void;
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
    toSignal<T extends WritableSignal<boolean>>(key: string, factory: SignalFactory<boolean>): T;
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
    emitDOMEvents(target?: EventTarget, options?: EmitDOMEventsOptions): () => void;
    /**
     * Removes all `matchMedia` / `ResizeObserver` listeners, clears all
     * subscribers, and cancels any pending debounce timer.
     */
    destroy(): void;
}
