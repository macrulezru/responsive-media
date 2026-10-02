import { describe, it, expect, beforeEach, afterEach, expectTypeOf } from 'vitest';
import { createApp, inject, shallowRef } from 'vue';
import type { App } from 'vue';
import { renderHook, cleanup, act } from '@testing-library/react';
import { createMatchMediaMock } from './matchMedia.mock';
import { defineResponsive as defineVueResponsive, useContainerState as useVueContainerState, RESPONSIVE_KEY } from '../src/vue-responsive';
import { defineResponsive as defineReactResponsive, useContainerState as useReactContainerState } from '../src/react-responsive';

const mock = createMatchMediaMock();

beforeEach(() => {
  mock.install();
  mock.reset();
});

afterEach(() => {
  cleanup();
  mock.uninstall();
});

function mountWithSetup<T>(setup: () => T, provide?: (app: App) => void): { app: App; result: T } {
  let result!: T;
  const app = createApp({
    setup() {
      result = setup();
      return () => null;
    },
  });
  provide?.(app);
  app.mount(document.createElement('div'));
  return { app, result };
}

describe('defineResponsive (Vue)', () => {
  it('applies the config to the shared state and returns hooks that read it', () => {
    mock.setMatch('(max-width: 640px)', true);
    const hooks = defineVueResponsive({
      sm: [{ type: 'max-width', value: 640 }],
      lg: [{ type: 'min-width', value: 1024 }],
    });

    const { result } = mountWithSetup(() => hooks.useResponsive());
    expect(result.sm).toBe(true);
    expect(result.lg).toBe(false);

    mock.setMatch('(min-width: 1024px)', true);
    expect(result.lg).toBe(true);
  });

  it('passes ssr-independent options through, so the order drives useBreakpoints', () => {
    mock.setMatch('(min-width: 1024px)', true);
    const hooks = defineVueResponsive(
      {
        lg: [{ type: 'min-width', value: 1024 }],
        sm: [{ type: 'max-width', value: 640 }],
      },
      { order: ['sm', 'lg'] },
    );

    const { result } = mountWithSetup(() => hooks.useBreakpoints());
    expect(result.current.value).toBe('lg');
    expect(result.isAbove('sm')).toBe(true);
    expect(result.isBelow('sm')).toBe(false);
  });

  it('keeps honoring the configured order when the plugin provides the state', () => {
    mock.setMatch('(max-width: 960px)', true);
    mock.setMatch('(max-width: 850px)', true);
    const hooks = defineVueResponsive(
      {
        tablet: [{ type: 'max-width', value: 960 }],
        smallTablet: [{ type: 'max-width', value: 850 }],
      },
      { order: ['smallTablet', 'tablet'] },
    );
    let current: string | null = null;
    const app = createApp({
      setup() {
        current = hooks.useBreakpoints().current.value;
        return () => null;
      },
    });
    app.use(hooks.plugin);
    app.mount(document.createElement('div'));
    expect(current).toBe('smallTablet');
  });

  it('exposes a plugin that provides the same reactive state under RESPONSIVE_KEY', () => {
    const hooks = defineVueResponsive({ only: [{ type: 'min-width', value: 1 }] });
    let injected: unknown;
    let used: unknown;
    const app = createApp({
      setup() {
        injected = inject(RESPONSIVE_KEY);
        used = hooks.useResponsive();
        return () => null;
      },
    });
    app.use(hooks.plugin);
    app.mount(document.createElement('div'));
    expect(injected).toBeDefined();
    expect(injected).toBe(used);
  });

  it('types the state and the breakpoint keys from the config', () => {
    const hooks = defineVueResponsive({
      sm: [{ type: 'max-width', value: 640 }],
      lg: [{ type: 'min-width', value: 1024 }],
    });
    expectTypeOf(hooks.useResponsive()).toEqualTypeOf<{ sm: boolean; lg: boolean }>();
    expectTypeOf<Parameters<ReturnType<typeof hooks.useBreakpoints>['isAbove']>[0]>().toEqualTypeOf<'sm' | 'lg'>();
  });
});

describe('defineResponsive (React)', () => {
  it('applies the config and returns hooks that read and follow it', () => {
    mock.setMatch('(max-width: 640px)', true);
    const hooks = defineReactResponsive({
      sm: [{ type: 'max-width', value: 640 }],
      lg: [{ type: 'min-width', value: 1024 }],
    });

    const { result } = renderHook(() => hooks.useResponsive());
    expect(result.current).toEqual({ sm: true, lg: false });

    act(() => mock.setMatch('(min-width: 1024px)', true));
    expect(result.current.lg).toBe(true);
  });

  it('types the state and the breakpoint keys from the config', () => {
    const hooks = defineReactResponsive({
      sm: [{ type: 'max-width', value: 640 }],
      lg: [{ type: 'min-width', value: 1024 }],
    });
    const { result } = renderHook(() => ({ state: hooks.useResponsive(), breakpoints: hooks.useBreakpoints() }));
    expectTypeOf(result.current.state).toEqualTypeOf<{ sm: boolean; lg: boolean }>();
    expectTypeOf(result.current.breakpoints.current).toEqualTypeOf<'sm' | 'lg' | null>();
  });
});

describe('useContainerState infers its keys from the config', () => {
  it('in Vue', () => {
    const el = shallowRef<Element | null>(null);
    const state = useVueContainerState(el, {
      compact: [{ type: 'max-width', value: 300 }],
      wide: [{ type: 'min-width', value: 600 }],
    });
    expectTypeOf(state).toEqualTypeOf<{ compact: boolean; wide: boolean }>();
  });

  it('in React', () => {
    const { result } = renderHook(() =>
      useReactContainerState({ current: null }, {
        compact: [{ type: 'max-width', value: 300 }],
        wide: [{ type: 'min-width', value: 600 }],
      }),
    );
    expectTypeOf(result.current).toEqualTypeOf<{ compact: boolean; wide: boolean }>();
  });
});
