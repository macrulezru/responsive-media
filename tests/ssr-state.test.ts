import { describe, it, expect, afterEach, vi } from 'vitest';
import { createMatchMediaMock } from './matchMedia.mock';
import { createResponsiveState } from '../src/create-responsive';
import { createContainerState } from '../src/container-state';
import type { MediaQueryConfig } from '../src/create-responsive';

const config: Record<string, MediaQueryConfig> = {
  mobile: [{ type: 'max-width', value: 600 }],
  tablet: [{ type: 'max-width', value: 960 }],
  desktop: [{ type: 'min-width', value: 961 }],
};

function removeMatchMedia() {
  Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: undefined });
}

afterEach(() => {
  vi.unstubAllGlobals();
  removeMatchMedia();
});

describe('ssrState — viewport state', () => {
  it('keeps every key false without matchMedia when no ssrState is given', () => {
    removeMatchMedia();
    const state = createResponsiveState(config);
    expect(state.getState()).toEqual({ mobile: false, tablet: false, desktop: false });
  });

  it('seeds the listed keys without matchMedia, and leaves the others false', () => {
    removeMatchMedia();
    const state = createResponsiveState(config, { ssrState: { desktop: true } });
    expect(state.getState()).toEqual({ mobile: false, tablet: false, desktop: true });
    expect(state.current).toBe('desktop');
  });

  it('ignores keys that are not in the config', () => {
    removeMatchMedia();
    const state = createResponsiveState(config, { ssrState: { desktop: true, phablet: true } });
    expect(Object.keys(state.getState())).toEqual(['mobile', 'tablet', 'desktop']);
  });

  it('applies ssrState passed to setConfig()', () => {
    removeMatchMedia();
    const state = createResponsiveState(config);
    state.setConfig(config, { ssrState: { mobile: true, tablet: true } });
    expect(state.getState()).toEqual({ mobile: true, tablet: true, desktop: false });
  });

  it('notifies subscribers with the seeded snapshot', () => {
    removeMatchMedia();
    const state = createResponsiveState(config, { ssrState: { desktop: true } });
    const seen: Record<string, boolean>[] = [];
    state.subscribe((s) => seen.push({ ...s }));
    expect(seen[0]).toEqual({ mobile: false, tablet: false, desktop: true });
  });

  it('is ignored once matchMedia is available — the real query wins', () => {
    const mock = createMatchMediaMock();
    mock.install();
    mock.reset();
    mock.setMatch('(min-width: 961px)', false);
    const state = createResponsiveState(config, { ssrState: { desktop: true } });
    expect(state.getState().desktop).toBe(false);
    mock.setMatch('(max-width: 600px)', true);
    expect(state.getState().mobile).toBe(true);
  });
});

describe('ssrState — container state', () => {
  const containerConfig: Record<string, MediaQueryConfig> = {
    compact: [{ type: 'max-width', value: 300 }],
    wide: [{ type: 'min-width', value: 600 }],
  };

  it('seeds the listed keys without ResizeObserver', () => {
    const el = document.createElement('div');
    const state = createContainerState(el, containerConfig, { ssrState: { wide: true } });
    expect(state.getState()).toEqual({ compact: false, wide: true });
  });

  it('keeps every key false without ResizeObserver and without ssrState', () => {
    const el = document.createElement('div');
    const state = createContainerState(el, containerConfig);
    expect(state.getState()).toEqual({ compact: false, wide: false });
  });

  it('is ignored once ResizeObserver is available', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      },
    );
    const el = document.createElement('div');
    el.getBoundingClientRect = () => new DOMRect(0, 0, 100, 40);
    const state = createContainerState(el, containerConfig, { ssrState: { wide: true } });
    expect(state.getState()).toEqual({ compact: true, wide: false });
  });
});
