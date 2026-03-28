import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMatchMediaMock } from './matchMedia.mock';
import { ReactiveResponsiveState } from '../src/create-responsive';
import { match } from '../src/create-responsive';
import { TailwindPreset, BootstrapPreset } from '../src/presets';
import { subscribeMediaQuery } from '../src/media-query';

const mock = createMatchMediaMock();

beforeEach(() => {
  mock.install();
  mock.reset();
});

afterEach(() => {
  mock.uninstall();
  vi.useRealTimers();
});

function makeState(config: Record<string, import('../src/create-responsive').MediaQueryConfig> = {
  sm: [{ type: 'max-width', value: 600 }],
  lg: [{ type: 'min-width', value: 601 }],
}) {
  const state = new ReactiveResponsiveState();
  state.setConfig(config);
  return state;
}

const smQuery = '(max-width: 600px)';
const lgQuery = '(min-width: 601px)';

// ---------------------------------------------------------------------------
// onEnter / onLeave
// ---------------------------------------------------------------------------

describe('onEnter()', () => {
  it('fires when breakpoint becomes active', () => {
    const state = makeState();
    const cb = vi.fn();
    state.onEnter('sm', cb);
    expect(cb).not.toHaveBeenCalled(); // sm is false initially

    mock.setMatch(smQuery, true);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('does not fire when breakpoint becomes inactive', () => {
    mock.setMatch(smQuery, true);
    const state = makeState();
    const cb = vi.fn();
    state.onEnter('sm', cb);
    cb.mockClear();

    mock.setMatch(smQuery, false);
    expect(cb).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe function', () => {
    const state = makeState();
    const cb = vi.fn();
    const off = state.onEnter('sm', cb);
    off();
    mock.setMatch(smQuery, true);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('onLeave()', () => {
  it('fires when breakpoint becomes inactive', () => {
    mock.setMatch(smQuery, true);
    const state = makeState();
    const cb = vi.fn();
    state.onLeave('sm', cb);
    expect(cb).not.toHaveBeenCalled(); // sm is true initially

    mock.setMatch(smQuery, false);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('does not fire when breakpoint becomes active', () => {
    const state = makeState();
    const cb = vi.fn();
    state.onLeave('sm', cb);

    mock.setMatch(smQuery, true);
    expect(cb).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe function', () => {
    mock.setMatch(smQuery, true);
    const state = makeState();
    const cb = vi.fn();
    const off = state.onLeave('sm', cb);
    off();
    mock.setMatch(smQuery, false);
    expect(cb).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// waitFor
// ---------------------------------------------------------------------------

describe('waitFor()', () => {
  it('resolves immediately when condition is already met', async () => {
    mock.setMatch(smQuery, true);
    const state = makeState();
    await expect(state.waitFor('sm', true)).resolves.toBeUndefined();
  });

  it('resolves when condition becomes true', async () => {
    const state = makeState();
    const promise = state.waitFor('sm', true);

    mock.setMatch(smQuery, true);
    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves when condition becomes false', async () => {
    mock.setMatch(smQuery, true);
    const state = makeState();
    const promise = state.waitFor('sm', false);

    mock.setMatch(smQuery, false);
    await expect(promise).resolves.toBeUndefined();
  });

  it('does not resolve before condition is met', () => {
    const state = makeState();
    let resolved = false;
    state.waitFor('sm').then(() => { resolved = true; });

    expect(resolved).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// current
// ---------------------------------------------------------------------------

describe('current', () => {
  it('returns null when no breakpoints are active', () => {
    const state = makeState();
    expect(state.current).toBeNull();
  });

  it('returns the first active breakpoint key', () => {
    mock.setMatch(smQuery, true);
    const state = makeState();
    expect(state.current).toBe('sm');
  });

  it('updates as breakpoints change', () => {
    mock.setMatch(lgQuery, true);
    const state = makeState();
    expect(state.current).toBe('lg');

    mock.setMatch(lgQuery, false);
    mock.setMatch(smQuery, true);
    expect(state.current).toBe('sm');
  });

  it('reflects live state, not debounced snapshot', () => {
    vi.useFakeTimers();
    const state = makeState();
    state.setConfig({ sm: [{ type: 'max-width', value: 600 }] }, { debounce: 100 });

    mock.setMatch(smQuery, true);
    // Snapshot is stale but current reads live state
    expect(state.current).toBe('sm');
    expect(state.getState()).toEqual({ sm: false }); // snapshot not yet updated

    vi.runAllTimers();
    expect(state.getState()).toEqual({ sm: true });
  });
});

// ---------------------------------------------------------------------------
// onBreakpointChange
// ---------------------------------------------------------------------------

describe('onBreakpointChange()', () => {
  it('does not fire on initial subscribe call', () => {
    const state = makeState();
    const cb = vi.fn();
    state.onBreakpointChange(cb);
    expect(cb).not.toHaveBeenCalled();
  });

  it('fires with from and to when breakpoint changes', () => {
    mock.setMatch(lgQuery, true);
    const state = makeState();
    const transitions: Array<[string | null, string | null]> = [];
    state.onBreakpointChange((from, to) => transitions.push([from, to]));

    // Two separate matchMedia events → two transitions: lg→null, then null→sm
    mock.setMatch(lgQuery, false);
    mock.setMatch(smQuery, true);
    expect(transitions).toEqual([['lg', null], [null, 'sm']]);
  });

  it('fires with null as to when all breakpoints go inactive', () => {
    mock.setMatch(smQuery, true);
    const state = makeState();
    const transitions: Array<[string | null, string | null]> = [];
    state.onBreakpointChange((from, to) => transitions.push([from, to]));

    mock.setMatch(smQuery, false);
    expect(transitions).toEqual([['sm', null]]);
  });

  it('returns an unsubscribe function', () => {
    const state = makeState();
    const cb = vi.fn();
    const off = state.onBreakpointChange(cb);
    off();
    mock.setMatch(smQuery, true);
    expect(cb).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// match()
// ---------------------------------------------------------------------------

describe('match()', () => {
  it('returns the value for the first matching key', () => {
    const state = { sm: true, lg: false };
    expect(match(state, { sm: 1, lg: 4 })).toBe(1);
  });

  it('follows insertion order for priority', () => {
    const state = { sm: true, lg: true };
    expect(match(state, { sm: 'first', lg: 'second' })).toBe('first');
    expect(match(state, { lg: 'first', sm: 'second' })).toBe('first');
  });

  it('returns fallback when no key matches', () => {
    const state = { sm: false, lg: false };
    expect(match(state, { sm: 1, lg: 4 }, 99)).toBe(99);
  });

  it('returns undefined when no match and no fallback', () => {
    const state = { sm: false };
    expect(match(state, { sm: 1 })).toBeUndefined();
  });

  it('works with non-numeric values (components, strings, etc.)', () => {
    const state = { sm: false, lg: true };
    const result = match(state, { sm: 'MobileNav', lg: 'DesktopNav' });
    expect(result).toBe('DesktopNav');
  });
});

// ---------------------------------------------------------------------------
// syncCSSVars()
// ---------------------------------------------------------------------------

describe('syncCSSVars()', () => {
  it('sets CSS custom properties on documentElement', () => {
    mock.setMatch(smQuery, true);
    const state = makeState();
    state.syncCSSVars();

    expect(document.documentElement.style.getPropertyValue('--responsive-sm')).toBe('1');
    expect(document.documentElement.style.getPropertyValue('--responsive-lg')).toBe('0');
  });

  it('updates CSS vars when state changes', () => {
    const state = makeState();
    state.syncCSSVars();

    mock.setMatch(smQuery, true);
    expect(document.documentElement.style.getPropertyValue('--responsive-sm')).toBe('1');

    mock.setMatch(smQuery, false);
    expect(document.documentElement.style.getPropertyValue('--responsive-sm')).toBe('0');
  });

  it('supports custom prefix', () => {
    mock.setMatch(smQuery, true);
    const state = makeState();
    state.syncCSSVars({ prefix: '--bp-' });

    expect(document.documentElement.style.getPropertyValue('--bp-sm')).toBe('1');
  });

  it('supports custom element', () => {
    const el = document.createElement('div');
    mock.setMatch(smQuery, true);
    const state = makeState();
    state.syncCSSVars({ element: el });

    expect(el.style.getPropertyValue('--responsive-sm')).toBe('1');
  });

  it('removes CSS vars for deleted breakpoints on setConfig', () => {
    const state = makeState();
    state.syncCSSVars();
    // sm and lg vars exist now
    expect(document.documentElement.style.getPropertyValue('--responsive-sm')).toBe('0');

    state.setConfig({ xl: [{ type: 'min-width', value: 1280 }] });
    // sm and lg should be removed
    expect(document.documentElement.style.getPropertyValue('--responsive-sm')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--responsive-xl')).toBe('0');
  });

  it('returns a cleanup function that stops updates', () => {
    const state = makeState();
    const stop = state.syncCSSVars();
    // syncCSSVars fires on subscribe → var is '0' (sm is false)
    expect(document.documentElement.style.getPropertyValue('--responsive-sm')).toBe('0');
    stop();

    mock.setMatch(smQuery, true);
    // After stop(), var must stay '0' — not update to '1'
    expect(document.documentElement.style.getPropertyValue('--responsive-sm')).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// hydrate()
// ---------------------------------------------------------------------------

describe('hydrate()', () => {
  it('sets initial state from provided values', () => {
    const state = makeState();
    expect(state.getState().sm).toBe(false);

    state.hydrate({ sm: true });
    expect(state.getState().sm).toBe(true);
  });

  it('notifies subscribers after hydration', () => {
    const state = makeState();
    const listener = vi.fn();
    state.subscribe(listener);
    listener.mockClear();

    state.hydrate({ sm: true });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].sm).toBe(true);
  });

  it('ignores keys not in current config', () => {
    const state = makeState();
    state.hydrate({ nonexistent: true } as Record<string, boolean>);
    expect('nonexistent' in state.getState()).toBe(false);
  });

  it('does not notify if no values changed', () => {
    const state = makeState();
    const listener = vi.fn();
    state.subscribe(listener);
    listener.mockClear();

    state.hydrate({ sm: false }); // already false
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Debounce
// ---------------------------------------------------------------------------

describe('debounce option', () => {
  it('delays subscribe notifications by the specified ms', () => {
    vi.useFakeTimers();
    const state = new ReactiveResponsiveState();
    state.setConfig(
      { sm: [{ type: 'max-width', value: 600 }] },
      { debounce: 100 },
    );

    const listener = vi.fn();
    state.subscribe(listener);
    listener.mockClear();

    mock.setMatch(smQuery, true);
    expect(listener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].sm).toBe(true);
  });

  it('coalesces rapid changes into a single notify', () => {
    vi.useFakeTimers();
    const state = new ReactiveResponsiveState();
    state.setConfig(
      { sm: [{ type: 'max-width', value: 600 }] },
      { debounce: 100 },
    );

    const listener = vi.fn();
    state.subscribe(listener);
    listener.mockClear();

    mock.setMatch(smQuery, true);
    mock.setMatch(smQuery, false);
    mock.setMatch(smQuery, true);

    vi.advanceTimersByTime(100);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].sm).toBe(true);
  });

  it('on() listeners are never debounced', () => {
    vi.useFakeTimers();
    const state = new ReactiveResponsiveState();
    state.setConfig(
      { sm: [{ type: 'max-width', value: 600 }] },
      { debounce: 100 },
    );

    const cb = vi.fn();
    state.on('sm', cb);
    cb.mockClear();

    mock.setMatch(smQuery, true);
    // Should fire immediately, not waiting for debounce
    expect(cb).toHaveBeenCalledWith(true);
  });

  it('setConfig always fires immediately regardless of debounce', () => {
    vi.useFakeTimers();
    const state = new ReactiveResponsiveState();
    state.setConfig(
      { sm: [{ type: 'max-width', value: 600 }] },
      { debounce: 500 },
    );

    const listener = vi.fn();
    state.subscribe(listener);
    listener.mockClear();

    // setConfig itself fires immediately (not debounced)
    state.setConfig({ lg: [{ type: 'min-width', value: 601 }] }, { debounce: 500 });
    expect(listener).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// destroy()
// ---------------------------------------------------------------------------

describe('destroy()', () => {
  it('removes all listeners from matchMedia', () => {
    const state = makeState();
    state.destroy();
    expect(mock.listenerCount(smQuery)).toBe(0);
    expect(mock.listenerCount(lgQuery)).toBe(0);
  });

  it('stops notifying subscribe listeners', () => {
    const state = makeState();
    const listener = vi.fn();
    state.subscribe(listener);
    listener.mockClear();

    state.destroy();
    mock.setMatch(smQuery, true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('cancels pending debounce timer', () => {
    vi.useFakeTimers();
    const state = new ReactiveResponsiveState();
    state.setConfig({ sm: [{ type: 'max-width', value: 600 }] }, { debounce: 100 });

    const listener = vi.fn();
    state.subscribe(listener);
    listener.mockClear();

    mock.setMatch(smQuery, true);
    state.destroy();
    vi.runAllTimers();

    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

describe('TailwindPreset', () => {
  it('has the expected breakpoint keys', () => {
    expect(Object.keys(TailwindPreset)).toEqual(['xs', 'sm', 'md', 'lg', 'xl', '2xl']);
  });

  it('applies without error', () => {
    const state = makeState();
    expect(() => state.setConfig(TailwindPreset)).not.toThrow();
    expect(Object.keys(state.getState())).toEqual(['xs', 'sm', 'md', 'lg', 'xl', '2xl']);
  });

  it('produces correct media query strings', () => {
    const state = makeState(TailwindPreset);
    const mqs = state.getMediaQueries();
    expect(mqs.xs).toBe('(max-width: 639px)');
    expect(mqs.sm).toBe('(min-width: 640px) and (max-width: 767px)');
    expect(mqs['2xl']).toBe('(min-width: 1536px)');
  });
});

describe('BootstrapPreset', () => {
  it('has the expected breakpoint keys', () => {
    expect(Object.keys(BootstrapPreset)).toEqual(['xs', 'sm', 'md', 'lg', 'xl', 'xxl']);
  });

  it('applies without error', () => {
    const state = makeState();
    expect(() => state.setConfig(BootstrapPreset)).not.toThrow();
  });

  it('produces correct media query strings', () => {
    const state = makeState(BootstrapPreset);
    const mqs = state.getMediaQueries();
    expect(mqs.xs).toBe('(max-width: 575px)');
    expect(mqs.sm).toBe('(min-width: 576px) and (max-width: 767px)');
    expect(mqs.xxl).toBe('(min-width: 1400px)');
  });
});

// ---------------------------------------------------------------------------
// subscribeMediaQuery()
// ---------------------------------------------------------------------------

describe('subscribeMediaQuery()', () => {
  it('calls callback immediately with current match', () => {
    mock.setMatch('(prefers-color-scheme: dark)', true);
    const cb = vi.fn();
    subscribeMediaQuery('(prefers-color-scheme: dark)', cb);
    expect(cb).toHaveBeenCalledWith(true);
  });

  it('fires when the query match changes', () => {
    const cb = vi.fn();
    subscribeMediaQuery('(hover: hover)', cb);
    cb.mockClear();

    mock.setMatch('(hover: hover)', true);
    expect(cb).toHaveBeenCalledWith(true);
  });

  it('returns an unsubscribe function', () => {
    const cb = vi.fn();
    const off = subscribeMediaQuery('(hover: hover)', cb);
    cb.mockClear();

    off();
    mock.setMatch('(hover: hover)', true);
    expect(cb).not.toHaveBeenCalled();
  });

  it('registers and removes its listener cleanly (no leak)', () => {
    const query = '(prefers-reduced-motion: reduce)';
    const cb = vi.fn();
    const off = subscribeMediaQuery(query, cb);
    expect(mock.listenerCount(query)).toBe(1);

    off();
    expect(mock.listenerCount(query)).toBe(0);
  });
});
