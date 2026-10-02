import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMatchMediaMock } from './matchMedia.mock';
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

function createMockNuxt() {
  return { options: { build: { transpile: [] as string[] } } };
}

async function runModule(options: Record<string, unknown> = {}) {
  const { default: responsiveModule } = await import('../src/nuxt/module');
  const nuxt = createMockNuxt();
  (responsiveModule as unknown as (o: unknown, n: unknown) => void)(options, nuxt);
  const template = addTemplate.mock.calls[0]![0] as { filename: string; getContents: () => string };
  const plugin = addPluginTemplate.mock.calls[0]![0] as { filename: string; getContents: () => string };
  return { nuxt, template, plugin, contents: template.getContents(), pluginContents: plugin.getContents() };
}

beforeEach(() => {
  addImports.mockClear();
  addPluginTemplate.mockClear();
  addTemplate.mockReset();
  addTemplate.mockReturnValue({ dst: DST });
});

describe('responsive-media/nuxt module', () => {
  it('generates a typed composables file around defineResponsive, with the default breakpoints', async () => {
    const { template, contents } = await runModule();
    expect(template.filename).toBe('responsive-media/index.ts');
    expect(contents).toContain("import { defineResponsive } from 'responsive-media/vue';");
    expect(contents).toContain('export const { useResponsive, useBreakpoints, plugin } = defineResponsive(');
    expect(contents).toContain('"mobile"');
    expect(contents).toContain('"tablet"');
    expect(contents).toContain('"desktop"');
    expect(contents).toContain('"max-width"');
    expect(contents).toContain('{},');
  });

  it('writes custom breakpoints and the settings it was given', async () => {
    const { contents } = await runModule({
      breakpoints: { sm: [{ type: 'max-width', value: 640 }], smallTablet: [{ type: 'max-width', value: 850 }] },
      order: ['sm', 'smallTablet'],
      debounce: 50,
      ssrState: { smallTablet: false, sm: false },
    });
    expect(contents).toContain('"smallTablet"');
    expect(contents).toContain('850');
    expect(contents).not.toContain('"mobile"');
    expect(contents).toContain('"order":["sm","smallTablet"]');
    expect(contents).toContain('"debounce":50');
    expect(contents).toContain('"ssrState":{"smallTablet":false,"sm":false}');
  });

  it('produces code that actually runs: the config reaches the shared state', async () => {
    const mock = createMatchMediaMock();
    mock.install();
    mock.reset();
    mock.setMatch('(max-width: 850px)', true);
    const { contents } = await runModule({
      breakpoints: { smallTablet: [{ type: 'max-width', value: 850 }], desktop: [{ type: 'min-width', value: 851 }] },
    });
    const body = contents
      .replace(/^import .*$/m, '')
      .replace('export const { useResponsive, useBreakpoints, plugin } =', 'const hooks =');
    const hooks = new Function('defineResponsive', `${body}\nreturn hooks;`)(defineResponsive);
    expect(Object.keys(hooks).sort()).toEqual(['plugin', 'useBreakpoints', 'useResponsive']);
    const { responsiveState } = await import('../src/create-responsive');
    expect(responsiveState.getState()).toEqual({ smallTablet: true, desktop: false });
    mock.uninstall();
  });

  it('auto-imports the typed hooks from the generated file and the other composables from the Vue entry', async () => {
    await runModule();
    expect(addImports).toHaveBeenCalledWith([
      { name: 'useResponsive', from: DST },
      { name: 'useBreakpoints', from: DST },
      { name: 'useMediaQuery', from: 'responsive-media/vue' },
      { name: 'useContainerState', from: 'responsive-media/vue' },
    ]);
  });

  it('adds one plugin that installs the generated plugin object on the Vue app', async () => {
    const { plugin, pluginContents } = await runModule();
    expect(addPluginTemplate).toHaveBeenCalledTimes(1);
    expect(plugin.filename).toBe('responsive-media.plugin.ts');
    expect(pluginContents).toContain("import { defineNuxtPlugin } from '#imports';");
    expect(pluginContents).toContain(`import { plugin } from ${JSON.stringify(DST)};`);
    expect(pluginContents).toContain('nuxtApp.vueApp.use(plugin);');
  });

  it('transpiles the package so the server build can load its extensionless ESM files', async () => {
    const { nuxt } = await runModule();
    expect(nuxt.options.build.transpile).toContain('responsive-media');
  });
});
