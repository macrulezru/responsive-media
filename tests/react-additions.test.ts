import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { renderHook, cleanup, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { createViewportMock } from '../src/testing';
import { defineResponsive, useResponsive, useResponsiveValue, useViewportSize } from '../src/react-responsive';
import { setResponsiveConfig } from '../src/create-responsive';

const mock = createViewportMock({ width: 1280, height: 800 });

beforeEach(() => mock.install());

afterEach(() => {
  cleanup();
  mock.uninstall();
});

describe('useResponsiveValue (React)', () => {
  it('returns the value of the first active key in the map order, a fallback otherwise', () => {
    const hooks = defineResponsive({
      mobile: [{ type: 'max-width', value: 600 }],
      tablet: [{ type: 'max-width', value: 960 }],
      desktop: [{ type: 'min-width', value: 961 }],
    });
    const { result } = renderHook(() => ({
      columns: hooks.useResponsiveValue({ mobile: 1, tablet: 2, desktop: 4 }),
      label: hooks.useResponsiveValue({ mobile: 'small' }, 'large'),
    }));
    expect(result.current).toEqual({ columns: 4, label: 'large' });

    act(() => mock.setViewport({ width: 800 }));
    expect(result.current).toEqual({ columns: 2, label: 'large' });

    act(() => mock.setViewport({ width: 500 }));
    expect(result.current).toEqual({ columns: 1, label: 'small' });
  });

  it('is exported as a plain hook over the shared state', () => {
    setResponsiveConfig({ sm: [{ type: 'max-width', value: 700 }], lg: [{ type: 'min-width', value: 701 }] });
    const { result } = renderHook(() => useResponsiveValue({ sm: 'S', lg: 'L' }));
    expect(result.current).toBe('L');
  });
});

describe('useViewportSize (React)', () => {
  it('follows the window size and stays referentially stable between renders', () => {
    const { result, rerender } = renderHook(() => useViewportSize({ throttle: 0 }));
    expect(result.current).toEqual({ width: 1280, height: 800 });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);

    act(() => mock.setViewport({ width: 900, height: 700 }));
    expect(result.current).toEqual({ width: 900, height: 700 });
  });
});

describe('useUserPreferences (React)', () => {
  it('follows the accessibility media features', async () => {
    vi.resetModules();
    const fresh = await import('../src/react-responsive');
    const { result } = renderHook(() => fresh.useUserPreferences());
    expect(result.current.dark).toBe(false);

    act(() => mock.setFeature('prefers-color-scheme', 'dark'));
    expect(result.current.dark).toBe(true);
    expect(result.current.light).toBe(false);
  });
});

describe('hydration (React)', () => {
  const config = {
    mobile: [{ type: 'max-width' as const, value: 600 }],
    desktop: [{ type: 'min-width' as const, value: 601 }],
  };

  function Layout() {
    const state = useResponsive<{ mobile: boolean; desktop: boolean }>();
    return createElement('main', null, state.mobile ? 'mobile layout' : 'desktop layout');
  }

  it('hydrates the server state first and switches to the real one without a recoverable error', async () => {
    mock.uninstall();
    defineResponsive(config, { ssrState: { desktop: true } });
    const html = renderToString(createElement(Layout));
    expect(html).toContain('desktop layout');

    mock.install();
    mock.setViewport({ width: 500 });
    defineResponsive(config, { ssrState: { desktop: true } });

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    const errors: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, createElement(Layout), { onRecoverableError: (error) => errors.push(error) });
    });

    expect(errors).toEqual([]);
    expect(container.textContent).toBe('mobile layout');
    container.remove();
  });
});
