import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMatchMediaMock } from './matchMedia.mock';
import { ReactiveResponsiveState } from '../src/create-responsive';
import type { MediaQueryConfig } from '../src/create-responsive';

// Each test creates its own ReactiveResponsiveState instance to avoid
// singleton bleed-over between tests.

const mock = createMatchMediaMock();

beforeEach(() => {
  mock.install();
  mock.reset();
});

afterEach(() => {
  mock.uninstall();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(config: Record<string, MediaQueryConfig>) {
  const state = new ReactiveResponsiveState();
  state.setConfig(config);
  return state;
}

const smQuery = '(max-width: 600px)';
const lgQuery = '(min-width: 601px)';

const simpleConfig: Record<string, MediaQueryConfig> = {
  sm: [{ type: 'max-width', value: 600 }],
  lg: [{ type: 'min-width', value: 601 }],
};

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('initial state', () => {
  it('reflects matchMedia.matches at construction time', () => {
    mock.setMatch(smQuery, true);
    mock.setMatch(lgQuery, false);
    const state = makeState(simpleConfig);
    expect(state.proxy.sm).toBe(true);
    expect(state.proxy.lg).toBe(false);
  });

  it('defaults to false when matchMedia returns false', () => {
    const state = makeState(simpleConfig);
    expect(state.proxy.sm).toBe(false);
    expect(state.proxy.lg).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Viewport changes
// ---------------------------------------------------------------------------

describe('viewport changes', () => {
  it('updates proxy when matchMedia fires a change event', () => {
    const state = makeState(simpleConfig);
    expect(state.proxy.sm).toBe(false);

    mock.setMatch(smQuery, true);
    expect(state.proxy.sm).toBe(true);
  });

  it('notifies subscribe listeners on change', () => {
    const state = makeState(simpleConfig);
    const calls: boolean[] = [];
    state.subscribe(s => calls.push(s.sm));

    // Initial call on subscribe
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(false);

    mock.setMatch(smQuery, true);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toBe(true);
  });

  it('does not notify if value did not change', () => {
    mock.setMatch(smQuery, true);
    const state = makeState(simpleConfig);
    const listener = vi.fn();
    state.subscribe(listener);
    listener.mockClear();

    // Fire the same value again
    mock.setMatch(smQuery, true);
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// subscribe / unsubscribe
// ---------------------------------------------------------------------------

describe('subscribe', () => {
  it('calls listener immediately with current state', () => {
    mock.setMatch(smQuery, true);
    const state = makeState(simpleConfig);
    const listener = vi.fn();
    state.subscribe(listener);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].sm).toBe(true);
  });

  it('unsubscribe stops receiving updates', () => {
    const state = makeState(simpleConfig);
    const listener = vi.fn();
    const off = state.subscribe(listener);
    listener.mockClear();

    off();
    mock.setMatch(smQuery, true);
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// on() — per-key listener
// ---------------------------------------------------------------------------

describe('on()', () => {
  it('calls callback immediately with current value', () => {
    mock.setMatch(smQuery, true);
    const state = makeState(simpleConfig);
    const cb = vi.fn();
    state.on('sm', cb);
    expect(cb).toHaveBeenCalledWith(true);
  });

  it('fires only for the watched key', () => {
    const state = makeState(simpleConfig);
    const smCb = vi.fn();
    const lgCb = vi.fn();
    state.on('sm', smCb);
    state.on('lg', lgCb);
    smCb.mockClear();
    lgCb.mockClear();

    mock.setMatch(smQuery, true);
    expect(smCb).toHaveBeenCalledWith(true);
    expect(lgCb).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe function', () => {
    const state = makeState(simpleConfig);
    const cb = vi.fn();
    const off = state.on('sm', cb);
    cb.mockClear();

    off();
    mock.setMatch(smQuery, true);
    expect(cb).not.toHaveBeenCalled();
  });

  it('returns false for unknown key', () => {
    const state = makeState(simpleConfig);
    const cb = vi.fn();
    state.on('nonexistent', cb);
    expect(cb).toHaveBeenCalledWith(false);
  });
});

// ---------------------------------------------------------------------------
// getState()
// ---------------------------------------------------------------------------

describe('getState()', () => {
  it('returns a plain object copy of current state', () => {
    mock.setMatch(smQuery, true);
    const state = makeState(simpleConfig);
    const snapshot = state.getState();
    expect(snapshot).toEqual({ sm: true, lg: false });
    expect(snapshot).not.toBe(state.proxy); // must be a copy
  });

  it('returns same reference between changes (stable for React)', () => {
    const state = makeState(simpleConfig);
    const a = state.getState();
    const b = state.getState();
    expect(a).toBe(b);
  });

  it('returns a new reference after a change', () => {
    const state = makeState(simpleConfig);
    const before = state.getState();
    mock.setMatch(smQuery, true);
    const after = state.getState();
    expect(before).not.toBe(after);
  });
});

// ---------------------------------------------------------------------------
// setConfig() — reconfiguration
// ---------------------------------------------------------------------------

describe('setConfig()', () => {
  it('applies the new config and removes old keys', () => {
    const state = makeState(simpleConfig);
    expect('sm' in state.proxy).toBe(true);

    state.setConfig({ xl: [{ type: 'min-width', value: 1280 }] });
    expect('sm' in state.proxy).toBe(false);
    expect('xl' in state.proxy).toBe(true);
  });

  it('sends a single notify after setConfig (not one per key)', () => {
    const state = makeState(simpleConfig);
    const listener = vi.fn();
    state.subscribe(listener);
    listener.mockClear();

    state.setConfig({
      a: [{ type: 'max-width', value: 400 }],
      b: [{ type: 'min-width', value: 401 }],
      c: [{ type: 'min-width', value: 1000 }],
    });

    expect(listener).toHaveBeenCalledOnce();
  });

  it('does not leave stale listeners after reconfiguration (no memory leak)', () => {
    const state = makeState(simpleConfig);

    // Reconfigure — should remove old smQuery listeners
    state.setConfig({ xl: [{ type: 'min-width', value: 1280 }] });

    // Old query should have 0 listeners now
    expect(mock.listenerCount(smQuery)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getMediaQueries()
// ---------------------------------------------------------------------------

describe('getMediaQueries()', () => {
  it('returns the correct CSS media query strings', () => {
    const state = makeState(simpleConfig);
    const mqs = state.getMediaQueries();
    expect(mqs.sm).toBe(smQuery);
    expect(mqs.lg).toBe(lgQuery);
  });
});

// ---------------------------------------------------------------------------
// buildMediaQuery — OR logic (nested arrays)
// ---------------------------------------------------------------------------

describe('OR-logic config', () => {
  it('joins groups with commas for OR semantics', () => {
    const state = makeState({
      smallOrPortrait: [
        [{ type: 'max-width', value: 600 }],
        [{ type: 'orientation', value: 'portrait' }],
      ],
    });
    const mqs = state.getMediaQueries();
    expect(mqs.smallOrPortrait).toBe(
      '(max-width: 600px), (orientation: portrait)',
    );
  });

  it('joins conditions within a group with AND', () => {
    const state = makeState({
      tabletLandscape: [
        [
          { type: 'min-width', value: 601 },
          { type: 'max-width', value: 960 },
          { type: 'orientation', value: 'landscape' },
        ],
      ],
    });
    const mqs = state.getMediaQueries();
    expect(mqs.tabletLandscape).toBe(
      '(min-width: 601px) and (max-width: 960px) and (orientation: landscape)',
    );
  });
});

// ---------------------------------------------------------------------------
// formatValue — pixel and non-pixel types
// ---------------------------------------------------------------------------

describe('value formatting', () => {
  it('appends px to numeric width/height values', () => {
    const state = makeState({ w: [{ type: 'max-width', value: 800 }] });
    expect(state.getMediaQueries().w).toBe('(max-width: 800px)');
  });

  it('does not append px to string values', () => {
    const state = makeState({ o: [{ type: 'orientation', value: 'landscape' }] });
    expect(state.getMediaQueries().o).toBe('(orientation: landscape)');
  });

  it('does not append px to numeric non-pixel types', () => {
    const state = makeState({ g: [{ type: 'grid', value: 1 }] });
    expect(state.getMediaQueries().g).toBe('(grid: 1)');
  });

  it('does not append px to aspect-ratio', () => {
    const state = makeState({ ar: [{ type: 'aspect-ratio', value: '16/9' }] });
    expect(state.getMediaQueries().ar).toBe('(aspect-ratio: 16/9)');
  });

  it('supports prefers-color-scheme', () => {
    const state = makeState({ dark: [{ type: 'prefers-color-scheme', value: 'dark' }] });
    expect(state.getMediaQueries().dark).toBe('(prefers-color-scheme: dark)');
  });

  it('supports prefers-reduced-motion', () => {
    const state = makeState({ motion: [{ type: 'prefers-reduced-motion', value: 'reduce' }] });
    expect(state.getMediaQueries().motion).toBe('(prefers-reduced-motion: reduce)');
  });

  it('supports hover', () => {
    const state = makeState({ touch: [{ type: 'hover', value: 'none' }] });
    expect(state.getMediaQueries().touch).toBe('(hover: none)');
  });
});

// ---------------------------------------------------------------------------
// Default ResponsiveConfig — mutual exclusivity
// ---------------------------------------------------------------------------

describe('default config breakpoints', () => {
  it('default instance has mobile / tablet / desktop keys', async () => {
    // Import the singleton (uses default config)
    const { responsiveState } = await import('../src/create-responsive');
    const keys = Object.keys(responsiveState.getState());
    expect(keys).toContain('mobile');
    expect(keys).toContain('tablet');
    expect(keys).toContain('desktop');
  });
});
