import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createViewportMock } from '../src/testing';
import { defineResponsive } from '../src/vue-responsive';

const addImports = vi.fn();
const addTemplate = vi.fn();
const addPluginTemplate = vi.fn();

vi.mock('@nuxt/kit', () => ({
  addImports,
  addTemplate,
  addPluginTemplate,
  defineNuxtModule: <T extends Record<string, unknown>>(definition: {
    defaults: T;
    setup: (options: T, nuxt: unknown) => void;
  }) => {
    return (inlineOptions: Partial<T>, nuxt: unknown) =>
      definition.setup({ ...definition.defaults, ...inlineOptions }, nuxt);
  },
}));

const DST = '/project/.nuxt/responsive-media/index.ts';

interface Template {
  filename: string;
  mode?: string;
  getContents: () => string;
}

function createMockNuxt(dev = false) {
  return { options: { dev, build: { transpile: [] as string[] } } };
}

async function runModule(options: Record<string, unknown> = {}, dev = false) {
  const { default: responsiveModule } = await import('../src/nuxt/module');
  const nuxt = createMockNuxt(dev);
  (responsiveModule as unknown as (o: unknown, n: unknown) => void)(options, nuxt);
  const templates = addTemplate.mock.calls.map((call) => call[0] as Template);
  const plugins = addPluginTemplate.mock.calls.map((call) => call[0] as Template);
  const composables = templates.find((t) => t.filename === 'responsive-media/index.ts')!;
  const plugin = plugins.find((t) => t.filename === 'responsive-media.plugin.ts')!;
  return { nuxt, templates, plugins, composables, plugin, contents: composables.getContents(), pluginContents: plugin.getContents() };
}

beforeEach(() => {
  addImports.mockClear();
  addPluginTemplate.mockClear();
  addTemplate.mockReset();
  addTemplate.mockImplementation((template: Template) => ({ dst: `/project/.nuxt/${template.filename}` }));
});

describe('responsive-media/nuxt module', () => {
  it('generates a typed composables file around defineResponsive, with the default breakpoints', async () => {
    const { composables, contents } = await runModule();
    expect(composables.filename).toBe('responsive-media/index.ts');
    expect(contents).toContain("import { defineResponsive } from 'responsive-media/vue';");
    expect(contents).toContain(
      'export const { useResponsive, useBreakpoints, useResponsiveValue, commitHydration, plugin } = defineResponsive(',
    );
    expect(contents).toContain('"mobile"');
    expect(contents).toContain('"tablet"');
    expect(contents).toContain('"desktop"');
    expect(contents).toContain('"max-width"');
    expect(contents).toContain('{"hydration":"deferred"},');
  });

  it('writes custom breakpoints and the settings it was given', async () => {
    const { contents } = await runModule({
      breakpoints: { sm: [{ type: 'max-width', value: 640 }], smallTablet: [{ type: 'max-width', value: 850 }] },
      order: ['sm', 'smallTablet'],
      debounce: 50,
      ssrState: { smallTablet: false, sm: false },
      hydration: 'immediate',
    });
    expect(contents).toContain('"smallTablet"');
    expect(contents).toContain('850');
    expect(contents).not.toContain('"mobile"');
    expect(contents).toContain('"hydration":"immediate"');
    expect(contents).toContain('"order":["sm","smallTablet"]');
    expect(contents).toContain('"debounce":50');
    expect(contents).toContain('"ssrState":{"smallTablet":false,"sm":false}');
  });

  it('produces code that actually runs: the config reaches the shared state', async () => {
    const mock = createViewportMock({ width: 800 });
    mock.install();
    const { contents } = await runModule({
      breakpoints: { smallTablet: [{ type: 'max-width', value: 850 }], desktop: [{ type: 'min-width', value: 851 }] },
    });
    const body = contents
      .replace(/^import .*$/m, '')
      .replace('export const { useResponsive, useBreakpoints, useResponsiveValue, commitHydration, plugin } =', 'const hooks =');
    const hooks = new Function('defineResponsive', `${body}\nreturn hooks;`)(defineResponsive);
    expect(Object.keys(hooks).sort()).toEqual(['commitHydration', 'plugin', 'useBreakpoints', 'useResponsive', 'useResponsiveValue']);
    const { responsiveState } = await import('../src/create-responsive');
    expect(responsiveState.getState()).toEqual({ smallTablet: true, desktop: false });
    mock.uninstall();
  });

  it('auto-imports the typed hooks from the generated file and the other composables from the Vue entry', async () => {
    await runModule();
    expect(addImports).toHaveBeenCalledWith([
      { name: 'useResponsive', from: DST },
      { name: 'useBreakpoints', from: DST },
      { name: 'useResponsiveValue', from: DST },
      { name: 'useMediaQuery', from: 'responsive-media/vue' },
      { name: 'useContainerState', from: 'responsive-media/vue' },
      { name: 'useUserPreferences', from: 'responsive-media/vue' },
      { name: 'useViewportSize', from: 'responsive-media/vue' },
    ]);
  });

  it('transpiles the package so the server build can load its extensionless ESM files', async () => {
    const { nuxt } = await runModule();
    expect(nuxt.options.build.transpile).toContain('responsive-media');
  });
});

describe('generated plugin', () => {
  it('installs the plugin object with the server snapshot and the hydration flag', async () => {
    const { pluginContents } = await runModule();
    expect(pluginContents).toContain("import { defineNuxtPlugin, useCookie, useRequestHeaders } from '#imports';");
    expect(pluginContents).toContain(`import { plugin, commitHydration } from ${JSON.stringify(DST)};`);
    expect(pluginContents).toContain('nuxtApp.vueApp.use(plugin, {');
    expect(pluginContents).toContain("commit: 'manual',");
    expect(pluginContents).toContain("nuxtApp.hook('app:suspense:resolve', () => commitHydration());");
    expect(pluginContents).toContain('nuxtApp.isHydrating');
  });

  it('has no request hints by default, so it never reads cookies or headers', async () => {
    const { pluginContents } = await runModule();
    expect(pluginContents).toContain('const hints = [];');
    expect(pluginContents).toContain('if (hints.length > 0 && import.meta.server)');
  });

  it('writes the hints, device sizes, fallback and cookie name it was given', async () => {
    const { pluginContents } = await runModule({
      ssrHints: ['cookie', 'user-agent'],
      ssrDevices: { mobile: { width: 360, height: 800 } },
      ssrState: { desktop: true },
      cookie: 'vp',
    });
    expect(pluginContents).toContain('const hints = ["cookie","user-agent"];');
    expect(pluginContents).toContain('"mobile":{"width":360,"height":800}');
    expect(pluginContents).toContain('const fallback = {"desktop":true};');
    expect(pluginContents).toContain('const cookieName = "vp";');
    expect(pluginContents).toContain('nuxtApp.payload.responsive = ssrState;');
  });

  it('generates valid TypeScript-free JavaScript that resolves the hints on the server and writes the cookie on the client', async () => {
    const { pluginContents } = await runModule({
      breakpoints: { mobile: [{ type: 'max-width', value: 600 }], desktop: [{ type: 'min-width', value: 601 }] },
      ssrHints: ['cookie', 'user-agent'],
    });
    const ts = await import('typescript');
    const js = ts.transpileModule(pluginContents, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    }).outputText;

    const resolveSsrState = vi.fn(() => ({ mobile: true, desktop: false }));
    const serializeViewportCookie = vi.fn(() => '500x800');
    const use = vi.fn();
    const commitHydration = vi.fn();
    const hooks: Record<string, () => void> = {};
    const nuxtApp = {
      payload: {} as Record<string, unknown>,
      isHydrating: false,
      vueApp: { use },
      hook: (name: string, callback: () => void) => {
        hooks[name] = callback;
      },
    };
    const cookie = { value: 'abc' as string | null };
    const useCookie = vi.fn(() => cookie);
    const useRequestHeaders = vi.fn(() => ({ 'user-agent': 'UA' }));
    const defineNuxtPlugin = (setup: (app: typeof nuxtApp) => void) => setup;

    const body = js
      .replace(/^import .*$/gm, '')
      .replace('export default', 'const setup =')
      .replace(/import\.meta\.server/g, 'IS_SERVER')
      .replace(/import\.meta\.client/g, 'IS_CLIENT');

    const run = (server: boolean) => {
      const factory = new Function(
        'defineNuxtPlugin',
        'useCookie',
        'useRequestHeaders',
        'resolveSsrState',
        'serializeViewportCookie',
        'plugin',
        'commitHydration',
        'IS_SERVER',
        'IS_CLIENT',
        `${body}\nreturn setup;`,
      );
      const setup = factory(
        defineNuxtPlugin,
        useCookie,
        useRequestHeaders,
        resolveSsrState,
        serializeViewportCookie,
        { install: vi.fn() },
        commitHydration,
        server,
        !server,
      );
      setup(nuxtApp);
    };

    run(true);
    expect(resolveSsrState).toHaveBeenCalledWith(
      expect.any(Object),
      { cookie: 'abc', userAgent: 'UA' },
      expect.objectContaining({ hints: ['cookie', 'user-agent'] }),
    );
    expect(nuxtApp.payload.responsive).toEqual({ mobile: true, desktop: false });
    expect(use).toHaveBeenLastCalledWith(expect.anything(), {
      ssrState: { mobile: true, desktop: false },
      hydrating: undefined,
      commit: 'manual',
    });

    run(false);
    expect(use).toHaveBeenLastCalledWith(expect.anything(), {
      ssrState: { mobile: true, desktop: false },
      hydrating: false,
      commit: 'manual',
    });
    expect(typeof hooks['app:mounted']).toBe('function');
    expect(commitHydration).not.toHaveBeenCalled();
    hooks['app:suspense:resolve']();
    expect(commitHydration).toHaveBeenCalledTimes(1);
    Object.assign(window, { innerWidth: 500, innerHeight: 800 });
    hooks['app:mounted']();
    expect(cookie.value).toBe('500x800');
  });
});

describe('optional generated files', () => {
  it('adds the SCSS module and the custom-media file only when asked', async () => {
    const none = await runModule();
    expect(none.templates.map((t) => t.filename)).toEqual(['responsive-media/index.ts']);

    addTemplate.mockClear();
    addPluginTemplate.mockClear();
    const both = await runModule({ css: { scss: true, customMedia: true } });
    const scss = both.templates.find((t) => t.filename === 'responsive-media/queries.scss')!;
    const custom = both.templates.find((t) => t.filename === 'responsive-media/custom-media.css')!;
    expect(scss.getContents()).toContain('@mixin media($key) {');
    expect(scss.getContents()).toContain('"mobile": "(max-width: 600px)"');
    expect(custom.getContents()).toContain('@custom-media --mobile (max-width: 600px);');
  });

  it('adds the dev badge only in dev mode and only when asked', async () => {
    const off = await runModule({ devBadge: true }, false);
    expect(off.plugins.map((p) => p.filename)).toEqual(['responsive-media.plugin.ts']);

    addTemplate.mockClear();
    addPluginTemplate.mockClear();
    const asked = await runModule({}, true);
    expect(asked.plugins.map((p) => p.filename)).toEqual(['responsive-media.plugin.ts']);

    addTemplate.mockClear();
    addPluginTemplate.mockClear();
    const on = await runModule({ devBadge: true }, true);
    const badge = on.plugins.find((p) => p.filename === 'responsive-media.devbadge.ts')!;
    expect(badge.mode).toBe('client');
    expect(badge.getContents()).toContain('data-responsive-badge');
    expect(badge.getContents()).toContain('responsiveState.current');
  });
});
