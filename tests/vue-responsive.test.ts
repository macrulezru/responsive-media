import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp, reactive } from 'vue';
import type { App } from 'vue';
import { createMatchMediaMock } from './matchMedia.mock';
import {
  useBreakpoints,
  useMediaQuery,
  useResponsive,
  ResponsivePlugin,
  RESPONSIVE_KEY,
} from '../src/vue-responsive';
import { setResponsiveConfig } from '../src/create-responsive';

// Previously untested adapter (see want-fix.md gotcha 11) — these tests focus
// on the behavior actually fixed here (DI in useBreakpoints, the isAbove
// bounds guard, and useMediaQuery's listener-leak escape hatch) rather than
// attempting full coverage of every composable.

const mock = createMatchMediaMock();

beforeEach(() => {
  mock.install();
  mock.reset();
});

afterEach(() => {
  mock.uninstall();
});

/**
 * Mounts a real, minimal Vue app so inject()/onUnmounted()/getCurrentInstance()
 * all behave exactly as they would in a real app — no @vue/test-utils needed
 * for composable-level testing. `provide` runs before mount, `app.unmount()`
 * triggers onUnmounted for leak-cleanup assertions.
 */
function mountWithSetup<T>(
  setup: () => T,
  options: { provide?: (app: App) => void } = {},
): { app: App; result: T } {
  let result!: T;
  const app = createApp({
    setup() {
      result = setup();
      return () => null;
    },
  });
  options.provide?.(app);
  app.mount(document.createElement('div'));
  return { app, result };
}

describe('useBreakpoints — DI', () => {
  it('honors a custom state provided via provide(RESPONSIVE_KEY, ...), instead of always reading the global default', () => {
    // Regression: useBreakpoints() used to call ensureVueState() directly,
    // ignoring any injected state entirely — unlike useResponsive(), which
    // already checked inject() first.
    const customState = reactive({ mobile: true, desktop: false });
    const { result } = mountWithSetup(() => useBreakpoints(), {
      provide: (app) => app.provide(RESPONSIVE_KEY, customState),
    });

    expect(result.current.value).toBe('mobile');
  });

  it('reacts to changes on the injected custom state (order falls back to key insertion order)', () => {
    const customState = reactive({ mobile: true, desktop: false });
    const { result } = mountWithSetup(() => useBreakpoints(), {
      provide: (app) => app.provide(RESPONSIVE_KEY, customState),
    });

    expect(result.current.value).toBe('mobile');
    customState.mobile = false;
    customState.desktop = true;
    expect(result.current.value).toBe('desktop');
  });
});

describe('useBreakpoints — isAbove bounds guard', () => {
  it('returns false for an unrecognized key instead of true for any active breakpoint', () => {
    // Regression: this file's own isAbove() reimplementation had the exact
    // same missing bounds guard as base-state.ts's — ord.indexOf('typo') is
    // -1, and any real breakpoint index is > -1.
    const customState = reactive({ sm: false, md: false, lg: true });
    const { result } = mountWithSetup(() => useBreakpoints(), {
      provide: (app) => app.provide(RESPONSIVE_KEY, customState),
    });

    expect(result.isAbove('typo')).toBe(false);
    expect(result.isAbove('sm')).toBe(true); // lg really is above sm
  });
});

describe('useMediaQuery — listener cleanup', () => {
  it('auto-cleans up its matchMedia listener on unmount when called inside a component', () => {
    const query = '(min-width: 999px)';
    const { app } = mountWithSetup(() => useMediaQuery(query));
    expect(mock.listenerCount(query)).toBe(1);

    app.unmount();
    expect(mock.listenerCount(query)).toBe(0);
  });

  it('exposes .stop() for manual cleanup when called outside a component instance', () => {
    // Regression: outside a component, `off` was previously captured locally
    // and never exposed — the matchMedia listener leaked for the page's
    // lifetime, since onUnmounted() never registered (getCurrentInstance()
    // is null here, same as inside a Pinia store or a plain factory).
    const query = '(min-width: 888px)';
    const matches = useMediaQuery(query);
    expect(mock.listenerCount(query)).toBe(1);

    matches.stop();
    expect(mock.listenerCount(query)).toBe(0);
  });
});

describe('ResponsivePlugin + useResponsive', () => {
  it('provides the global state to useResponsive() end-to-end', () => {
    setResponsiveConfig({ vue_e2e_key: [{ type: 'max-width', value: 600 }] });
    mock.setMatch('(max-width: 600px)', true);

    const { result } = mountWithSetup(() => useResponsive(), {
      provide: (app) => app.use(ResponsivePlugin),
    });

    expect(result.vue_e2e_key).toBe(true);
  });
});
