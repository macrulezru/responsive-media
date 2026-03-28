import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMatchMediaMock } from './matchMedia.mock';
import {
  createResponsiveState,
  toMediaQueryString,
  match,
  ReactiveResponsiveState,
} from '../src/create-responsive';
import { ContainerState, createContainerState } from '../src/container-state';
import { TailwindPreset, TailwindOrder, BootstrapPreset, BootstrapOrder, AccessibilityPreset } from '../src/presets';
import { subscribeMediaQuery } from '../src/media-query';
import type { MediaQueryConfig } from '../src/create-responsive';

const mock = createMatchMediaMock();

beforeEach(() => { mock.install(); mock.reset(); });
afterEach(() => { mock.uninstall(); vi.useRealTimers(); });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const smQuery = '(max-width: 600px)';
const mdQuery = '(min-width: 601px) and (max-width: 960px)';
const lgQuery = '(min-width: 961px)';

const threeBreakpoints: Record<string, MediaQueryConfig> = {
  sm: [{ type: 'max-width', value: 600 }],
  md: [{ type: 'min-width', value: 601 }, { type: 'max-width', value: 960 }],
  lg: [{ type: 'min-width', value: 961 }],
};

// ---------------------------------------------------------------------------
// createResponsiveState() factory
// ---------------------------------------------------------------------------

describe('createResponsiveState()', () => {
  it('creates an isolated instance with custom config', () => {
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });
    expect(Object.keys(s.getState())).toEqual(['sm']);
  });

  it('uses default ResponsiveConfig when called with no args', () => {
    const s = createResponsiveState();
    expect(Object.keys(s.getState())).toContain('mobile');
    expect(Object.keys(s.getState())).toContain('desktop');
  });

  it('accepts debounce option', () => {
    vi.useFakeTimers();
    const s = createResponsiveState(
      { sm: [{ type: 'max-width', value: 600 }] },
      { debounce: 50 },
    );
    const listener = vi.fn();
    s.subscribe(listener);
    listener.mockClear();

    mock.setMatch(smQuery, true);
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('accepts order option', () => {
    const s = createResponsiveState(threeBreakpoints, { order: ['sm', 'md', 'lg'] });
    expect(s.getOrder()).toEqual(['sm', 'md', 'lg']);
  });

  it('instances are independent from the singleton', async () => {
    const s = createResponsiveState({ xl: [{ type: 'min-width', value: 1280 }] });
    // singleton still has mobile/tablet/desktop
    const { responsiveState } = await import('../src/create-responsive');
    expect('xl' in responsiveState.getState()).toBe(false);
    expect('xl' in s.getState()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Ordered breakpoints: isAbove / isBelow / between
// ---------------------------------------------------------------------------

describe('isAbove() / isBelow() / between()', () => {
  it('isAbove returns true when current is after the key', () => {
    mock.setMatch(lgQuery, true);
    const s = createResponsiveState(threeBreakpoints, { order: ['sm', 'md', 'lg'] });
    expect(s.isAbove('sm')).toBe(true);
    expect(s.isAbove('md')).toBe(true);
    expect(s.isAbove('lg')).toBe(false);
  });

  it('isBelow returns true when current is before the key', () => {
    mock.setMatch(smQuery, true);
    const s = createResponsiveState(threeBreakpoints, { order: ['sm', 'md', 'lg'] });
    expect(s.isBelow('md')).toBe(true);
    expect(s.isBelow('lg')).toBe(true);
    expect(s.isBelow('sm')).toBe(false);
  });

  it('between returns true when current is within the inclusive range', () => {
    mock.setMatch(mdQuery, true);
    const s = createResponsiveState(threeBreakpoints, { order: ['sm', 'md', 'lg'] });
    expect(s.between('sm', 'lg')).toBe(true);
    expect(s.between('sm', 'md')).toBe(true);
    expect(s.between('md', 'lg')).toBe(true);
    expect(s.between('lg', 'lg')).toBe(false);
  });

  it('falls back to config key insertion order when no order set', () => {
    mock.setMatch(lgQuery, true);
    const s = createResponsiveState(threeBreakpoints); // no order
    expect(s.isAbove('sm')).toBe(true);  // relies on Object.keys order: sm, md, lg
  });

  it('reacts to breakpoint changes', () => {
    mock.setMatch(smQuery, true);
    const s = createResponsiveState(threeBreakpoints, { order: ['sm', 'md', 'lg'] });
    expect(s.isBelow('md')).toBe(true);

    mock.setMatch(smQuery, false);
    mock.setMatch(lgQuery, true);
    expect(s.isBelow('md')).toBe(false);
    expect(s.isAbove('md')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toMediaQueryString()
// ---------------------------------------------------------------------------

describe('toMediaQueryString()', () => {
  it('builds AND query from flat array', () => {
    expect(toMediaQueryString([
      { type: 'min-width', value: 768 },
      { type: 'max-width', value: 1024 },
    ])).toBe('(min-width: 768px) and (max-width: 1024px)');
  });

  it('builds OR query from nested array', () => {
    expect(toMediaQueryString([
      [{ type: 'max-width', value: 600 }],
      [{ type: 'orientation', value: 'portrait' }],
    ])).toBe('(max-width: 600px), (orientation: portrait)');
  });

  it('handles raw type verbatim', () => {
    expect(toMediaQueryString([{ type: 'raw', value: 'print' }])).toBe('print');
  });

  it('combines raw with features', () => {
    expect(toMediaQueryString([
      { type: 'raw', value: 'screen' },
      { type: 'max-width', value: 600 },
    ])).toBe('screen and (max-width: 600px)');
  });
});

// ---------------------------------------------------------------------------
// 'raw' media type in config
// ---------------------------------------------------------------------------

describe("raw condition type", () => {
  it('passes the value to matchMedia without parens', () => {
    const s = createResponsiveState({ printing: [{ type: 'raw', value: 'print' }] });
    expect(s.getMediaQueries().printing).toBe('print');
  });
});

// ---------------------------------------------------------------------------
// once()
// ---------------------------------------------------------------------------

describe('once()', () => {
  it('does NOT fire for the current (initial) value', () => {
    mock.setMatch(smQuery, true);
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });
    const cb = vi.fn();
    s.once('sm', cb);
    expect(cb).not.toHaveBeenCalled();
  });

  it('fires on the next change and auto-unsubscribes', () => {
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });
    const cb = vi.fn();
    s.once('sm', cb);

    mock.setMatch(smQuery, true);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(true);

    // Should not fire again
    mock.setMatch(smQuery, false);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('returns an unsubscribe function', () => {
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });
    const cb = vi.fn();
    const off = s.once('sm', cb);
    off();
    mock.setMatch(smQuery, true);
    expect(cb).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onNextChange()
// ---------------------------------------------------------------------------

describe('onNextChange()', () => {
  it('does NOT fire for the initial subscription call', () => {
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });
    const cb = vi.fn();
    s.onNextChange(cb);
    expect(cb).not.toHaveBeenCalled();
  });

  it('fires on the next state change and auto-unsubscribes', () => {
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });
    const cb = vi.fn();
    s.onNextChange(cb);

    mock.setMatch(smQuery, true);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0][0].sm).toBe(true);

    // Must not fire again
    mock.setMatch(smQuery, false);
    expect(cb).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// toSignal()
// ---------------------------------------------------------------------------

describe('toSignal()', () => {
  it('creates a signal with the current value', () => {
    mock.setMatch(smQuery, true);
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });

    const signalFactory = (v: boolean) => ({ value: v });
    const sig = s.toSignal('sm', signalFactory);
    expect(sig.value).toBe(true);
  });

  it('updates the signal when the breakpoint changes', () => {
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });
    const sig = s.toSignal('sm', (v) => ({ value: v }));
    expect(sig.value).toBe(false);

    mock.setMatch(smQuery, true);
    expect(sig.value).toBe(true);
  });

  it('returns false for unknown keys', () => {
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });
    const sig = s.toSignal('nonexistent', (v) => ({ value: v }));
    expect(sig.value).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// emitDOMEvents()
// ---------------------------------------------------------------------------

describe('emitDOMEvents()', () => {
  it('dispatches a change event on state transitions', () => {
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });
    const target = new EventTarget();
    const listener = vi.fn();
    target.addEventListener('responsive:change', listener);
    s.emitDOMEvents(target);

    mock.setMatch(smQuery, true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('does NOT dispatch events for the initial subscription call', () => {
    mock.setMatch(smQuery, true);
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });
    const target = new EventTarget();
    const listener = vi.fn();
    target.addEventListener('responsive:change', listener);
    s.emitDOMEvents(target);
    expect(listener).not.toHaveBeenCalled();
  });

  it('dispatches enter event when breakpoint becomes active', () => {
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });
    const target = new EventTarget();
    const enterCb = vi.fn();
    const leaveCb = vi.fn();
    target.addEventListener('responsive:sm:enter', enterCb);
    target.addEventListener('responsive:sm:leave', leaveCb);
    s.emitDOMEvents(target);

    mock.setMatch(smQuery, true);
    expect(enterCb).toHaveBeenCalledOnce();
    expect(leaveCb).not.toHaveBeenCalled();
  });

  it('dispatches leave event when breakpoint becomes inactive', () => {
    mock.setMatch(smQuery, true);
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });
    const target = new EventTarget();
    const leaveCb = vi.fn();
    target.addEventListener('responsive:sm:leave', leaveCb);
    s.emitDOMEvents(target);

    mock.setMatch(smQuery, false);
    expect(leaveCb).toHaveBeenCalledOnce();
  });

  it('supports custom prefix', () => {
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });
    const target = new EventTarget();
    const cb = vi.fn();
    target.addEventListener('bp:sm:enter', cb);
    s.emitDOMEvents(target, { prefix: 'bp:' });

    mock.setMatch(smQuery, true);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('returns a cleanup function that stops events', () => {
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });
    const target = new EventTarget();
    const cb = vi.fn();
    target.addEventListener('responsive:change', cb);
    const stop = s.emitDOMEvents(target);
    stop();

    mock.setMatch(smQuery, true);
    expect(cb).not.toHaveBeenCalled();
  });

  it('includes full state in change event detail', () => {
    const s = createResponsiveState({ sm: [{ type: 'max-width', value: 600 }] });
    const target = new EventTarget();
    let detail: unknown;
    target.addEventListener('responsive:change', (e) => { detail = (e as CustomEvent).detail; });
    s.emitDOMEvents(target);

    mock.setMatch(smQuery, true);
    expect(detail).toEqual({ sm: true });
  });
});

// ---------------------------------------------------------------------------
// AccessibilityPreset
// ---------------------------------------------------------------------------

describe('AccessibilityPreset', () => {
  it('has the expected keys', () => {
    expect(Object.keys(AccessibilityPreset)).toEqual([
      'dark', 'light', 'reducedMotion', 'highContrast',
      'lowContrast', 'noHover', 'coarsePointer', 'forcedColors', 'print',
    ]);
  });

  it('generates correct media query strings', () => {
    const s = createResponsiveState(AccessibilityPreset);
    const mqs = s.getMediaQueries();
    expect(mqs.dark).toBe('(prefers-color-scheme: dark)');
    expect(mqs.reducedMotion).toBe('(prefers-reduced-motion: reduce)');
    expect(mqs.print).toBe('print');
  });
});

// ---------------------------------------------------------------------------
// TailwindOrder / BootstrapOrder
// ---------------------------------------------------------------------------

describe('Preset order arrays', () => {
  it('TailwindOrder matches TailwindPreset keys', () => {
    expect([...TailwindOrder]).toEqual(Object.keys(TailwindPreset));
  });

  it('BootstrapOrder matches BootstrapPreset keys', () => {
    expect([...BootstrapOrder]).toEqual(Object.keys(BootstrapPreset));
  });

  it('isAbove works correctly with TailwindPreset + TailwindOrder', () => {
    const lgTailwindQuery = '(min-width: 1024px) and (max-width: 1279px)';
    mock.setMatch(lgTailwindQuery, true);
    const s = createResponsiveState(TailwindPreset, { order: [...TailwindOrder] });
    expect(s.isAbove('sm')).toBe(true);
    expect(s.isAbove('xl')).toBe(false);
    expect(s.between('md', 'xl')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ContainerState
// ---------------------------------------------------------------------------

function stubResizeObserver() {
  vi.stubGlobal('ResizeObserver', class {
    constructor(_cb: ResizeObserverCallback) {}
    observe = vi.fn();
    disconnect = vi.fn();
  });
}

describe('ContainerState — initial evaluation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('evaluates max-width condition from getBoundingClientRect', () => {
    stubResizeObserver();
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 250, height: 400,
      top: 0, left: 0, bottom: 400, right: 250, toJSON: () => {},
    });

    const cs = createContainerState(el, {
      compact: [{ type: 'max-width', value: 300 }],
      wide:    [{ type: 'min-width', value: 500 }],
    });

    expect(cs.getState().compact).toBe(true);
    expect(cs.getState().wide).toBe(false);
  });

  it('evaluates min-width condition correctly', () => {
    stubResizeObserver();
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 700, height: 400,
      top: 0, left: 0, bottom: 400, right: 700, toJSON: () => {},
    });

    const cs = createContainerState(el, {
      wide: [{ type: 'min-width', value: 600 }],
    });

    expect(cs.getState().wide).toBe(true);
  });
});

describe('ContainerState — ResizeObserver updates', () => {
  it('updates state when ResizeObserver fires', () => {
    // Capture the ResizeObserver callback
    let observerCallback: ResizeObserverCallback = () => {};
    const observeSpy = vi.fn();
    const disconnectSpy = vi.fn();

    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: ResizeObserverCallback) { observerCallback = cb; }
      observe = observeSpy;
      disconnect = disconnectSpy;
    });

    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 400, height: 300,
      top: 0, left: 0, bottom: 300, right: 400, toJSON: () => {},
    });

    const cs = createContainerState(el, {
      compact: [{ type: 'max-width', value: 300 }],
    });
    expect(cs.getState().compact).toBe(false);

    // Simulate resize
    observerCallback([{
      target: el,
      contentRect: { width: 200, height: 300, top: 0, left: 0, bottom: 300, right: 200, x: 0, y: 0, toJSON: () => {} },
      contentBoxSize: [],
      borderBoxSize: [],
      devicePixelContentBoxSize: [],
    }], cs as unknown as ResizeObserver);

    expect(cs.getState().compact).toBe(true);

    vi.unstubAllGlobals();
  });

  it('calls observer.disconnect() on destroy()', () => {
    const disconnectSpy = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(_cb: ResizeObserverCallback) {}
      observe = vi.fn();
      disconnect = disconnectSpy;
    });

    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 400, height: 300,
      top: 0, left: 0, bottom: 300, right: 400, toJSON: () => {},
    });

    const cs = createContainerState(el, { compact: [{ type: 'max-width', value: 300 }] });
    cs.destroy();
    expect(disconnectSpy).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it('getMediaQueries() returns @container-compatible strings', () => {
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 400, height: 300,
      top: 0, left: 0, bottom: 300, right: 400, toJSON: () => {},
    });

    vi.stubGlobal('ResizeObserver', class {
      constructor(_cb: ResizeObserverCallback) {}
      observe = vi.fn();
      disconnect = vi.fn();
    });

    const cs = createContainerState(el, {
      compact: [{ type: 'max-width', value: 300 }],
    });
    expect(cs.getMediaQueries().compact).toBe('(max-width: 300px)');

    vi.unstubAllGlobals();
  });
});

describe('ContainerState — OR logic', () => {
  it('evaluates OR groups correctly', () => {
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 250, height: 600,
      top: 0, left: 0, bottom: 600, right: 250, toJSON: () => {},
    });
    vi.stubGlobal('ResizeObserver', class {
      constructor(_cb: ResizeObserverCallback) {}
      observe = vi.fn();
      disconnect = vi.fn();
    });

    const cs = createContainerState(el, {
      smallOrTall: [
        [{ type: 'max-width', value: 300 }],
        [{ type: 'min-height', value: 500 }],
      ],
    });

    // Width is 250 (<= 300) OR height is 600 (>= 500) — both true
    expect(cs.getState().smallOrTall).toBe(true);

    vi.unstubAllGlobals();
  });
});

describe('ContainerState — all BaseResponsiveState methods', () => {
  function makeContainerState(width = 400, height = 300) {
    vi.stubGlobal('ResizeObserver', class {
      constructor(_cb: ResizeObserverCallback) {}
      observe = vi.fn();
      disconnect = vi.fn();
    });
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width, height, top: 0, left: 0, bottom: height, right: width, toJSON: () => {},
    });
    return createContainerState(el, {
      compact: [{ type: 'max-width', value: 300 }],
      wide:    [{ type: 'min-width', value: 500 }],
    });
  }

  afterEach(() => vi.unstubAllGlobals());

  it('subscribe fires immediately with current state', () => {
    const cs = makeContainerState();
    const listener = vi.fn();
    cs.subscribe(listener);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0]).toEqual({ compact: false, wide: false });
  });

  it('hydrate sets initial state', () => {
    const cs = makeContainerState();
    cs.hydrate({ compact: true });
    expect(cs.getState().compact).toBe(true);
  });

  it('waitFor resolves immediately when condition already met', async () => {
    const cs = makeContainerState(200); // 200 < 300 → compact = true
    await expect(cs.waitFor('compact', true)).resolves.toBeUndefined();
  });
});
