import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createApp, createSSRApp, defineComponent, h, nextTick, ref } from 'vue';
import type { App } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createViewportMock } from '../src/testing';
import {
  defineResponsive,
  useMediaQuery,
  useResponsiveValue,
  useUserPreferences,
  useViewportSize,
  useResponsive,
} from '../src/vue-responsive';
import { setResponsiveConfig } from '../src/create-responsive';

const mock = createViewportMock({ width: 1280, height: 800 });

beforeEach(() => mock.install());
afterEach(() => mock.uninstall());

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

describe('useMediaQuery with a reactive query', () => {
  it('re-subscribes when a ref changes and keeps a plain string working', () => {
    const query = ref('(max-width: 600px)');
    const { result, app } = mountWithSetup(() => useMediaQuery(query));
    expect(result.value).toBe(false);

    query.value = '(min-width: 1000px)';
    return nextTick().then(() => {
      expect(result.value).toBe(true);
      mock.setViewport({ width: 800 });
      expect(result.value).toBe(false);
      app.unmount();
    });
  });

  it('accepts a getter and follows what it reads', async () => {
    const breakpoint = ref(1000);
    const { result } = mountWithSetup(() => useMediaQuery(() => `(min-width: ${breakpoint.value}px)`));
    expect(result.value).toBe(true);
    breakpoint.value = 1500;
    await nextTick();
    expect(result.value).toBe(false);
  });

  it('drops the previous listener when the query changes and on stop()', async () => {
    const query = ref('(max-width: 600px)');
    const spy = vi.spyOn(window, 'matchMedia');
    const { result } = mountWithSetup(() => useMediaQuery(query));
    expect(spy).toHaveBeenCalledTimes(1);
    query.value = '(max-width: 700px)';
    await nextTick();
    expect(spy).toHaveBeenCalledTimes(2);

    result.stop();
    query.value = '(max-width: 800px)';
    await nextTick();
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});

describe('useResponsiveValue', () => {
  it('returns the value of the first active key in the map order, a fallback otherwise', async () => {
    const hooks = defineResponsive({
      mobile: [{ type: 'max-width', value: 600 }],
      tablet: [{ type: 'max-width', value: 960 }],
      desktop: [{ type: 'min-width', value: 961 }],
    });
    const { result } = mountWithSetup(() => ({
      columns: hooks.useResponsiveValue({ mobile: 1, tablet: 2, desktop: 4 }),
      label: hooks.useResponsiveValue({ mobile: 'small' }, 'large'),
    }));
    expect(result.columns.value).toBe(4);
    expect(result.label.value).toBe('large');

    mock.setViewport({ width: 800 });
    expect(result.columns.value).toBe(2);
    expect(result.label.value).toBe('large');

    mock.setViewport({ width: 500 });
    expect(result.columns.value).toBe(1);
    expect(result.label.value).toBe('small');
  });

  it('works without a config of your own, over the shared state', () => {
    setResponsiveConfig({ sm: [{ type: 'max-width', value: 700 }], lg: [{ type: 'min-width', value: 701 }] });
    const { result } = mountWithSetup(() => useResponsiveValue({ sm: 'S', lg: 'L' }));
    expect(result.value).toBe('L');
    mock.setViewport({ width: 600 });
    expect(result.value).toBe('S');
  });
});

describe('useUserPreferences', () => {
  it('follows the accessibility media features', async () => {
    vi.resetModules();
    const fresh = await import('../src/vue-responsive');
    const { result } = mountWithSetup(() => fresh.useUserPreferences());
    expect(result.dark).toBe(false);
    expect(result.reducedMotion).toBe(false);

    mock.setFeature('prefers-color-scheme', 'dark');
    mock.setFeature('prefers-reduced-motion', 'reduce');
    expect(result.dark).toBe(true);
    expect(result.light).toBe(false);
    expect(result.reducedMotion).toBe(true);
    expect(fresh.useUserPreferences()).toBe(result);
  });

  it('is exported with the same name as a plain function', () => {
    expect(typeof useUserPreferences).toBe('function');
  });
});

describe('useViewportSize', () => {
  it('is reactive, throttled by option, and stoppable', () => {
    const { result } = mountWithSetup(() => useViewportSize({ throttle: 0 }));
    expect(result.width).toBe(1280);
    expect(result.height).toBe(800);

    mock.setViewport({ width: 900, height: 700 });
    expect(result.width).toBe(900);
    expect(result.height).toBe(700);

    result.stop();
    mock.setViewport({ width: 500 });
    expect(result.width).toBe(900);
  });
});

describe('deferred hydration', () => {
  const config = {
    mobile: [{ type: 'max-width' as const, value: 600 }],
    desktop: [{ type: 'min-width' as const, value: 601 }],
  };

  const Layout = defineComponent({
    setup() {
      const state = useResponsive<{ mobile: boolean; desktop: boolean }>();
      return () => h('main', state.mobile ? 'mobile layout' : 'desktop layout');
    },
  });

  async function serverHtml(hooks: ReturnType<typeof defineResponsive<typeof config>>, install?: object) {
    mock.uninstall();
    const app = createSSRApp(Layout);
    app.use(hooks.plugin, install);
    const html = await renderToString(app);
    mock.install();
    return html;
  }

  async function hydrate(html: string, mode: 'immediate' | 'deferred', seed: object) {
    mock.setViewport({ width: 500 });
    const hooks = defineResponsive(config, { hydration: mode, ssrState: { desktop: true } });
    const warnings: string[] = [];
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const app = createSSRApp(Layout);
    app.config.warnHandler = (message) => warnings.push(message);
    app.use(hooks.plugin, seed);
    app.mount(container);
    const first = container.textContent;
    await nextTick();
    await nextTick();
    return { warnings, first, last: container.textContent, container };
  }

  it('renders the server state first and switches to the real one after mounting, without a mismatch', async () => {
    const serverHooks = defineResponsive(config, { ssrState: { desktop: true } });
    const html = await serverHtml(serverHooks);
    expect(html).toContain('desktop layout');

    const result = await hydrate(html, 'deferred', {});
    expect(result.first).toBe('desktop layout');
    expect(result.last).toBe('mobile layout');
    expect(result.warnings.filter((message) => /hydration/i.test(message))).toEqual([]);
    result.container.remove();
  });

  it('keeps the old behavior with immediate hydration: the real state is used at once and Vue reports a mismatch', async () => {
    const serverHooks = defineResponsive(config, { ssrState: { desktop: true } });
    const html = await serverHtml(serverHooks);

    const result = await hydrate(html, 'immediate', {});
    expect(result.warnings.some((message) => /hydration/i.test(message))).toBe(true);
    result.container.remove();
  });

  it('uses the ssrState passed to the plugin as the server snapshot (the value the server really rendered)', async () => {
    const serverHooks = defineResponsive(config, { ssrState: { desktop: true } });
    const html = await serverHtml(serverHooks, { ssrState: { mobile: true, desktop: false } });
    expect(html).toContain('mobile layout');

    mock.setViewport({ width: 1280 });
    const hooks = defineResponsive(config, { hydration: 'deferred' });
    const warnings: string[] = [];
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const app = createSSRApp(Layout);
    app.config.warnHandler = (message) => warnings.push(message);
    app.use(hooks.plugin, { ssrState: { mobile: true, desktop: false } });
    app.mount(container);
    expect(container.textContent).toBe('mobile layout');
    await nextTick();
    await nextTick();
    expect(container.textContent).toBe('desktop layout');
    expect(warnings.filter((message) => /hydration/i.test(message))).toEqual([]);
    container.remove();
  });

  it('does not defer a client-only app: the real state is there from the first render', async () => {
    mock.setViewport({ width: 500 });
    const hooks = defineResponsive(config, { hydration: 'deferred', ssrState: { desktop: true } });
    const container = document.createElement('div');
    const app = createApp(Layout);
    app.use(hooks.plugin, { hydrating: false });
    app.mount(container);
    expect(container.textContent).toBe('mobile layout');
  });
});

describe('server render', () => {
  const config = {
    mobile: [{ type: 'max-width' as const, value: 600 }],
    desktop: [{ type: 'min-width' as const, value: 601 }],
  };

  const Probe = defineComponent({
    setup() {
      const state = useResponsive<{ mobile: boolean; desktop: boolean }>();
      return () => h('p', state.mobile ? 'M' : 'D');
    },
  });

  it('gives every app its own state, so concurrent requests with different hints do not clobber each other', async () => {
    mock.uninstall();
    const hooks = defineResponsive(config, { ssrState: { desktop: true } });

    const first = createSSRApp(Probe);
    first.use(hooks.plugin, { ssrState: { mobile: true, desktop: false } });
    const second = createSSRApp(Probe);
    second.use(hooks.plugin, { ssrState: { mobile: false, desktop: true } });

    const [a, b] = await Promise.all([renderToString(first), renderToString(second)]);
    expect(a).toContain('M');
    expect(b).toContain('D');
    mock.install();
  });

  it('honors the configured order in useBreakpoints for a per-app state', async () => {
    mock.uninstall();
    const hooks = defineResponsive(
      {
        tablet: [{ type: 'max-width' as const, value: 960 }],
        smallTablet: [{ type: 'max-width' as const, value: 850 }],
      },
      { order: ['smallTablet', 'tablet'], ssrState: { tablet: true, smallTablet: true } },
    );
    const Current = defineComponent({
      setup() {
        const { current } = hooks.useBreakpoints();
        return () => h('i', String(current.value));
      },
    });
    const app = createSSRApp(Current);
    app.use(hooks.plugin);
    expect(await renderToString(app)).toContain('smallTablet');
    mock.install();
  });
});

describe('manual hydration commit', () => {
  const config = {
    mobile: [{ type: 'max-width' as const, value: 600 }],
    desktop: [{ type: 'min-width' as const, value: 601 }],
  };

  const Layout = defineComponent({
    setup() {
      const state = useResponsive<{ mobile: boolean; desktop: boolean }>();
      return () => h('main', state.mobile ? 'mobile layout' : 'desktop layout');
    },
  });

  async function serverHtml() {
    mock.uninstall();
    const hooks = defineResponsive(config, { ssrState: { desktop: true } });
    const app = createSSRApp(Layout);
    app.use(hooks.plugin);
    const html = await renderToString(app);
    mock.install();
    return html;
  }

  function mountOver(html: string, install: object) {
    mock.setViewport({ width: 500 });
    const hooks = defineResponsive(config, { hydration: 'deferred', ssrState: { desktop: true } });
    const warnings: string[] = [];
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const app = createSSRApp(Layout);
    app.config.warnHandler = (message) => warnings.push(message);
    app.use(hooks.plugin, install);
    app.mount(container);
    return { hooks, warnings, container };
  }

  it('keeps the server state until commitHydration() is called, however many ticks pass', async () => {
    const html = await serverHtml();
    const { hooks, warnings, container } = mountOver(html, { commit: 'manual', commitTimeout: 0 });

    for (let i = 0; i < 5; i++) await nextTick();
    expect(container.textContent).toBe('desktop layout');

    hooks.commitHydration();
    await nextTick();
    expect(container.textContent).toBe('mobile layout');
    expect(warnings.filter((message) => /hydration/i.test(message))).toEqual([]);
    container.remove();
  });

  it('commits by itself after commitTimeout so a page that never reports completion is not stuck', async () => {
    vi.useFakeTimers();
    try {
      const html = await serverHtml();
      const { container } = mountOver(html, { commit: 'manual', commitTimeout: 200 });
      await nextTick();
      expect(container.textContent).toBe('desktop layout');

      vi.advanceTimersByTime(250);
      await nextTick();
      expect(container.textContent).toBe('mobile layout');
      container.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  it('commits every waiting app once, and calling it again does nothing', async () => {
    const html = await serverHtml();
    const { hooks, container } = mountOver(html, { commit: 'manual', commitTimeout: 0 });
    hooks.commitHydration();
    hooks.commitHydration();
    await nextTick();
    expect(container.textContent).toBe('mobile layout');
    expect(() => hooks.commitHydration()).not.toThrow();
    container.remove();
  });

  it('leaves the automatic mode as it was: the switch happens on the next tick', async () => {
    const html = await serverHtml();
    const { container } = mountOver(html, {});
    expect(container.textContent).toBe('desktop layout');
    await nextTick();
    await nextTick();
    expect(container.textContent).toBe('mobile layout');
    container.remove();
  });
});
