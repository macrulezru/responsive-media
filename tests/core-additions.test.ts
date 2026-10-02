import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  createResponsiveState,
  statesFromSize,
  detectDevice,
  parseViewportCookie,
  serializeViewportCookie,
  resolveSsrState,
  getViewportSize,
  subscribeViewportSize,
  toMediaQueries,
  toScssMap,
  toScssModule,
  toCustomMedia,
  toTailwindScreens,
  getUserPreferencesState,
} from '../src/index';
import type { MediaQueryConfig } from '../src/index';
import { createViewportMock, evaluateMediaQuery } from '../src/testing';

const config: Record<string, MediaQueryConfig> = {
  mobile: [{ type: 'max-width', value: 600 }],
  tablet: [{ type: 'max-width', value: 960 }],
  desktop: [{ type: 'min-width', value: 961 }],
};

describe('getSsrState', () => {
  it('returns the seeded values for every key of the config, a stable object', () => {
    const state = createResponsiveState(config, { ssrState: { desktop: true } });
    expect(state.getSsrState()).toEqual({ mobile: false, tablet: false, desktop: true });
    expect(state.getSsrState()).toBe(state.getSsrState());
  });

  it('is all-false without ssrState and follows setConfig', () => {
    const state = createResponsiveState(config);
    expect(state.getSsrState()).toEqual({ mobile: false, tablet: false, desktop: false });
    state.setConfig({ sm: [{ type: 'max-width', value: 1 }] }, { ssrState: { sm: true } });
    expect(state.getSsrState()).toEqual({ sm: true });
  });
});

describe('statesFromSize', () => {
  it('evaluates width, height and orientation conditions against a size', () => {
    expect(statesFromSize(config, { width: 390, height: 844 })).toEqual({ mobile: true, tablet: true, desktop: false });
    expect(statesFromSize(config, { width: 1440, height: 900 })).toEqual({ mobile: false, tablet: false, desktop: true });
    const withOrientation: Record<string, MediaQueryConfig> = {
      portrait: [{ type: 'orientation', value: 'portrait' }],
    };
    expect(statesFromSize(withOrientation, { width: 390, height: 844 })).toEqual({ portrait: true });
  });
});

describe('SSR hints', () => {
  it('detects the device class from a user agent', () => {
    expect(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148')).toBe('mobile');
    expect(detectDevice('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit Mobile Safari')).toBe('mobile');
    expect(detectDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('tablet');
    expect(detectDevice('Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit Safari')).toBe('tablet');
    expect(detectDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120')).toBe('desktop');
    expect(detectDevice('')).toBeNull();
    expect(detectDevice(undefined)).toBeNull();
  });

  it('round-trips the viewport cookie and rejects garbage', () => {
    expect(serializeViewportCookie({ width: 1200.4, height: 799.6 })).toBe('1200x800');
    expect(parseViewportCookie('1200x800')).toEqual({ width: 1200, height: 800 });
    expect(parseViewportCookie('abc')).toBeNull();
    expect(parseViewportCookie('1x2')).toBeNull();
    expect(parseViewportCookie(undefined)).toBeNull();
  });

  it('prefers the cookie, then the user agent, then the fallback', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148';
    expect(resolveSsrState(config, { cookie: '1440x900', userAgent: iphone })).toEqual({
      mobile: false,
      tablet: false,
      desktop: true,
    });
    expect(resolveSsrState(config, { userAgent: iphone })).toEqual({ mobile: true, tablet: true, desktop: false });
    expect(resolveSsrState(config, {}, { fallback: { desktop: true } })).toEqual({
      mobile: false,
      tablet: false,
      desktop: true,
    });
  });

  it('honours the order of the hints and custom device sizes', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148';
    expect(resolveSsrState(config, { cookie: '1440x900', userAgent: iphone }, { hints: ['user-agent', 'cookie'] }).mobile).toBe(true);
    expect(resolveSsrState(config, { cookie: '1440x900' }, { hints: ['user-agent'] })).toEqual({
      mobile: false,
      tablet: false,
      desktop: false,
    });
    expect(
      resolveSsrState(config, { userAgent: iphone }, { devices: { mobile: { width: 700, height: 900 } } }),
    ).toEqual({ mobile: false, tablet: true, desktop: false });
  });
});

describe('viewport size', () => {
  const mock = createViewportMock({ width: 800, height: 600 });

  afterEach(() => {
    mock.uninstall();
    vi.useRealTimers();
  });

  it('reads the window size and follows resize with a throttle', () => {
    vi.useFakeTimers();
    mock.install();
    expect(getViewportSize()).toEqual({ width: 800, height: 600 });

    const seen: Array<{ width: number; height: number }> = [];
    const stop = subscribeViewportSize((size) => seen.push(size), { throttle: 100 });
    expect(seen).toEqual([{ width: 800, height: 600 }]);

    mock.setViewport({ width: 900 });
    mock.setViewport({ width: 1000 });
    mock.setViewport({ width: 1100 });
    expect(seen.length).toBeLessThan(4);
    vi.advanceTimersByTime(150);
    expect(seen[seen.length - 1]).toEqual({ width: 1100, height: 600 });

    const count = seen.length;
    stop();
    mock.setViewport({ width: 500 });
    vi.advanceTimersByTime(500);
    expect(seen.length).toBe(count);
  });

  it('emits every change when the throttle is 0', () => {
    mock.install();
    const seen: number[] = [];
    const stop = subscribeViewportSize((size) => seen.push(size.width), { throttle: 0 });
    mock.setViewport({ width: 900 });
    mock.setViewport({ width: 1000 });
    expect(seen).toEqual([800, 900, 1000]);
    stop();
  });
});

describe('CSS exports', () => {
  it('maps every key to its media query', () => {
    expect(toMediaQueries(config)).toEqual({
      mobile: '(max-width: 600px)',
      tablet: '(max-width: 960px)',
      desktop: '(min-width: 961px)',
    });
  });

  it('renders an SCSS map, quoting keys that are not plain identifiers', () => {
    expect(toScssMap({ '2xl': [{ type: 'min-width', value: 1536 }] })).toBe('$queries: (\n  "2xl": "(min-width: 1536px)"\n);');
    expect(toScssMap(config, { name: 'bp' })).toContain('$bp: (');
  });

  it('renders a ready SCSS module with a media mixin', () => {
    const text = toScssModule(config);
    expect(text).toContain("@use 'sass:map';");
    expect(text).toContain('"mobile": "(max-width: 600px)"');
    expect(text).toContain('@mixin media($key) {');
    expect(text).toContain('@media #{map.get($queries, $key)} {');
    expect(toScssModule(config, { name: 'q', mixin: 'at' })).toContain('@mixin at($key) {');
  });

  it('renders @custom-media rules and Tailwind screens', () => {
    expect(toCustomMedia(config)).toBe(
      '@custom-media --mobile (max-width: 600px);\n@custom-media --tablet (max-width: 960px);\n@custom-media --desktop (min-width: 961px);',
    );
    expect(toCustomMedia(config, { prefix: '--bp-' })).toContain('--bp-mobile');
    expect(toTailwindScreens(config)).toEqual({
      mobile: { raw: '(max-width: 600px)' },
      tablet: { raw: '(max-width: 960px)' },
      desktop: { raw: '(min-width: 961px)' },
    });
  });

  it('handles OR groups', () => {
    const or: Record<string, MediaQueryConfig> = {
      touch: [[{ type: 'max-width', value: 600 }], [{ type: 'hover', value: 'none' }]],
    };
    expect(toMediaQueries(or).touch).toBe('(max-width: 600px), (hover: none)');
  });
});

describe('user preferences state', () => {
  const mock = createViewportMock();

  afterEach(() => mock.uninstall());

  it('is one shared instance over the accessibility preset', () => {
    expect(getUserPreferencesState()).toBe(getUserPreferencesState());
    expect(Object.keys(getUserPreferencesState().getMediaQueries()).sort()).toEqual(
      ['coarsePointer', 'dark', 'forcedColors', 'highContrast', 'light', 'lowContrast', 'noHover', 'print', 'reducedMotion'],
    );
  });
});

describe('createViewportMock', () => {
  const mock = createViewportMock({ width: 1280, height: 800 });

  afterEach(() => mock.uninstall());

  it('evaluates classic and range media query syntax', () => {
    const size = { width: 800, height: 600 };
    expect(evaluateMediaQuery('(max-width: 850px)', size)).toBe(true);
    expect(evaluateMediaQuery('(min-width: 801px)', size)).toBe(false);
    expect(evaluateMediaQuery('(width <= 850px)', size)).toBe(true);
    expect(evaluateMediaQuery('(width > 800px)', size)).toBe(false);
    expect(evaluateMediaQuery('(600px <= width <= 900px)', size)).toBe(true);
    expect(evaluateMediaQuery('(min-width: 600px) and (max-width: 700px)', size)).toBe(false);
    expect(evaluateMediaQuery('(max-width: 100px), (orientation: landscape)', size)).toBe(true);
    expect(evaluateMediaQuery('(orientation: portrait)', size)).toBe(false);
    expect(evaluateMediaQuery('not (max-width: 100px)', size)).toBe(true);
    expect(evaluateMediaQuery('print', size)).toBe(false);
    expect(evaluateMediaQuery('screen and (min-width: 1px)', size)).toBe(true);
    expect(evaluateMediaQuery('(aspect-ratio: 4/3)', size)).toBe(true);
  });

  it('evaluates user-preference features and lets a test change them', () => {
    const size = { width: 800, height: 600 };
    expect(evaluateMediaQuery('(prefers-color-scheme: dark)', size)).toBe(false);
    expect(evaluateMediaQuery('(prefers-color-scheme: dark)', size, { 'prefers-color-scheme': 'dark' })).toBe(true);
    expect(evaluateMediaQuery('(hover: hover)', size)).toBe(true);
    expect(evaluateMediaQuery('(hover: none)', size)).toBe(false);
    expect(evaluateMediaQuery('(pointer: coarse)', size, { pointer: 'coarse' })).toBe(true);
  });

  it('drives a responsive state: setViewport flips the booleans and fires per-key listeners', () => {
    mock.install();
    const state = createResponsiveState(config);
    expect(state.getState()).toEqual({ mobile: false, tablet: false, desktop: true });

    const seen: boolean[] = [];
    state.on('mobile', (matches) => seen.push(matches));
    mock.setViewport({ width: 500 });
    expect(state.getState()).toEqual({ mobile: true, tablet: true, desktop: false });
    mock.setViewport({ width: 800 });
    expect(state.getState()).toEqual({ mobile: false, tablet: true, desktop: false });
    expect(seen).toEqual([false, true, false]);
    state.destroy();
  });

  it('follows setFeature for preference queries and restores the environment on uninstall', () => {
    mock.install();
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const changes: boolean[] = [];
    dark.addEventListener('change', (event) => changes.push(event.matches));
    expect(dark.matches).toBe(false);
    mock.setFeature('prefers-color-scheme', 'dark');
    expect(dark.matches).toBe(true);
    expect(changes).toEqual([true]);
    expect(mock.getViewport()).toEqual({ width: 1280, height: 800 });
    mock.uninstall();
    expect(typeof window.matchMedia).not.toBe('function');
  });
});
