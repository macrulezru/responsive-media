import type { MediaQueryConfig } from './responsive.enum';
import { isSSR } from './utils';

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

// ---------------------------------------------------------------------------
// Abstract base — shared between ReactiveResponsiveState and ContainerState
// ---------------------------------------------------------------------------

export abstract class BaseResponsiveState {
  protected state: ResponsiveState = {};
  protected listeners: Set<ResponsiveListener> = new Set();
  protected keyListeners: Map<string, Set<(matches: boolean) => void>> = new Map();
  public proxy: ResponsiveState;
  protected mediaQueries: Record<string, string> = {};
  protected snapshot: ResponsiveState = {};
  protected batching = false;
  protected pendingKeyChanges: Map<string, boolean> = new Map();
  protected debounceMs = 0;
  protected debounceTimer: ReturnType<typeof setTimeout> | null = null;
  protected order: string[] = [];

  constructor() {
    this.proxy = new Proxy(this.state, {
      set: (target, prop: string, value: boolean) => {
        if (target[prop] !== value) {
          target[prop] = value;
          if (this.batching) {
            this.pendingKeyChanges.set(prop, value);
          } else {
            this.notifyKey(prop, value);
            this.notify();
          }
        }
        return true;
      },
      get: (target, prop: string) => target[prop],
    });
  }

  // ---------------------------------------------------------------------------
  // Template methods for subclasses
  // ---------------------------------------------------------------------------

  /** Subclass implements the source-specific setup (matchMedia / ResizeObserver). */
  protected abstract setupSources(config: Record<string, MediaQueryConfig>): void;
  /** Subclass cleans up source listeners (matchMedia handlers / ResizeObserver). */
  protected abstract cleanupSources(): void;

  protected beginApplyConfig(): void {
    this.batching = true;
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.mediaQueries = {};
  }

  protected clearStateKeys(newConfig: Record<string, MediaQueryConfig>): void {
    Object.keys(this.state).forEach(key => {
      if (!(key in newConfig)) this.notifyKey(key, false);
      delete this.state[key];
    });
  }

  protected endApplyConfig(): void {
    this.batching = false;
    this.pendingKeyChanges.forEach((v, k) => this.notifyKey(k, v));
    this.pendingKeyChanges.clear();
    this.flushNotify();
  }

  protected applyConfig(config: Record<string, MediaQueryConfig>): void {
    this.beginApplyConfig();
    this.cleanupSources();
    this.clearStateKeys(config);
    this.setupSources(config);
    this.endApplyConfig();
  }

  // ---------------------------------------------------------------------------
  // Notification helpers
  // ---------------------------------------------------------------------------

  protected notifyKey(key: string, value: boolean): void {
    this.keyListeners.get(key)?.forEach(cb => cb(value));
  }

  protected flushNotify(): void {
    this.snapshot = { ...this.state };
    this.listeners.forEach(l => l(this.snapshot));
  }

  protected notify(): void {
    if (this.debounceMs > 0) {
      if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.flushNotify();
      }, this.debounceMs);
    } else {
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
  getState<T extends Record<string, boolean> = ResponsiveState>(): T {
    return this.snapshot as unknown as T;
  }

  /** Returns the CSS media query strings for each breakpoint key. */
  getMediaQueries(): Record<string, string> {
    return { ...this.mediaQueries };
  }

  /** Returns the configured breakpoint order (or empty array if not set). */
  getOrder(): string[] {
    return [...this.order];
  }

  // ---------------------------------------------------------------------------
  // Ordered breakpoint helpers
  // ---------------------------------------------------------------------------

  private effectiveOrder(): string[] {
    return this.order.length ? this.order : Object.keys(this.state);
  }

  /**
   * The first active breakpoint key, or `null`.
   * Reads live state — not affected by debounce.
   *
   * @example
   * if (state.current === 'mobile') { ... }
   */
  get current(): string | null {
    const ord = this.effectiveOrder();
    for (const key of ord) {
      if (this.state[key]) return key;
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
  isAbove(key: string): boolean {
    const ord = this.effectiveOrder();
    const cur = this.current;
    return ord.indexOf(cur ?? '') > ord.indexOf(key);
  }

  /**
   * Returns `true` when the current breakpoint comes **before** `key` in the order.
   */
  isBelow(key: string): boolean {
    const ord = this.effectiveOrder();
    const cur = this.current;
    const curIdx = ord.indexOf(cur ?? '');
    const keyIdx = ord.indexOf(key);
    return curIdx !== -1 && curIdx < keyIdx;
  }

  /**
   * Returns `true` when the current breakpoint is between `from` and `to` (inclusive).
   */
  between(from: string, to: string): boolean {
    const ord = this.effectiveOrder();
    const idx = ord.indexOf(this.current ?? '');
    return idx !== -1 && idx >= ord.indexOf(from) && idx <= ord.indexOf(to);
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  setConfig(config: Record<string, MediaQueryConfig>, options?: SetConfigOptions): void {
    if (options?.debounce !== undefined) this.debounceMs = options.debounce;
    if (options?.order !== undefined) this.order = options.order;
    this.applyConfig(config);
  }

  // ---------------------------------------------------------------------------
  // Subscription API
  // ---------------------------------------------------------------------------

  /** Subscribes to all state changes. Fires immediately with current state. Affected by `debounce`. */
  subscribe(listener: ResponsiveListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  /** Subscribes to a single key. Fires immediately. Never debounced. */
  on(key: string, callback: (matches: boolean) => void): () => void {
    if (!this.keyListeners.has(key)) this.keyListeners.set(key, new Set());
    const set = this.keyListeners.get(key)!;
    set.add(callback);
    callback(this.state[key] ?? false);
    return () => set.delete(callback);
  }

  /**
   * Fires `callback` only on `false → true` transitions. Skips initial state.
   * Never debounced.
   */
  onEnter(key: string, callback: () => void): () => void {
    let prev = this.state[key] ?? false;
    return this.on(key, (matches) => {
      const changed = prev !== matches;
      prev = matches;
      if (changed && matches) callback();
    });
  }

  /**
   * Fires `callback` only on `true → false` transitions. Skips initial state.
   * Never debounced.
   */
  onLeave(key: string, callback: () => void): () => void {
    let prev = this.state[key] ?? false;
    return this.on(key, (matches) => {
      const changed = prev !== matches;
      prev = matches;
      if (changed && !matches) callback();
    });
  }

  /**
   * Fires `callback` on the **next change** to `key`, then auto-unsubscribes.
   * Does NOT fire for the current value. Never debounced.
   *
   * @example
   * state.once('mobile', (matches) => console.log('mobile changed to', matches));
   */
  once(key: string, callback: (matches: boolean) => void): () => void {
    let cleanup: (() => void) = () => {};
    let skippedInit = false;
    cleanup = this.on(key, (matches) => {
      if (!skippedInit) { skippedInit = true; return; }
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
  onNextChange(callback: (state: ResponsiveState) => void): () => void {
    let cleanup: (() => void) = () => {};
    let skippedInit = false;
    cleanup = this.subscribe((s) => {
      if (!skippedInit) { skippedInit = true; return; }
      cleanup();
      callback(s);
    });
    return cleanup;
  }

  /**
   * Fires whenever the **active breakpoint** changes (i.e. `current` changes).
   * Provides `from` and `to` for transition-aware logic. Affected by `debounce`.
   */
  onBreakpointChange(
    callback: (from: string | null, to: string | null) => void,
  ): () => void {
    let prev = this.current;
    return this.subscribe(() => {
      const next = this.current;
      if (prev !== next) { callback(prev, next); prev = next; }
    });
  }

  /**
   * Returns a Promise that resolves when `key` reaches `expectedValue`.
   * Resolves immediately if condition is already met. Never debounced.
   */
  waitFor(key: string, expectedValue = true): Promise<void> {
    if ((this.state[key] ?? false) === expectedValue) return Promise.resolve();
    return new Promise((resolve) => {
      const off = this.on(key, (matches) => {
        if (matches === expectedValue) { off(); resolve(); }
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
  syncCSSVars(options?: SyncCSSVarsOptions): () => void {
    if (isSSR()) return () => {};
    const el = options?.element ?? document.documentElement;
    const prefix = options?.prefix ?? '--responsive-';
    let prevKeys = new Set<string>();

    return this.subscribe((s) => {
      const cur = new Set(Object.keys(s));
      prevKeys.forEach(k => { if (!cur.has(k)) el.style.removeProperty(`${prefix}${k}`); });
      Object.entries(s).forEach(([k, v]) => el.style.setProperty(`${prefix}${k}`, v ? '1' : '0'));
      prevKeys = cur;
    });
  }

  /**
   * Sets initial state from a server-side snapshot to prevent SSR layout shift.
   * Only updates keys that exist in the current config.
   */
  hydrate(initialState: Record<string, boolean>): void {
    let changed = false;
    Object.entries(initialState).forEach(([key, value]) => {
      if (key in this.state && this.state[key] !== value) {
        this.state[key] = value;
        this.notifyKey(key, value);
        changed = true;
      }
    });
    if (changed) this.flushNotify();
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
  toSignal<T extends WritableSignal<boolean>>(
    key: string,
    factory: SignalFactory<boolean>,
  ): T {
    const sig = factory(this.state[key] ?? false) as T;
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
  emitDOMEvents(
    target: EventTarget = document,
    options?: EmitDOMEventsOptions,
  ): () => void {
    if (isSSR()) return () => {};
    const prefix = options?.prefix ?? 'responsive:';
    let prev: Record<string, boolean> = {};
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
        } else if (was && !now) {
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
  destroy(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.cleanupSources();
    this.listeners.clear();
    this.keyListeners.clear();
  }
}
