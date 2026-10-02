import { addImports, addPluginTemplate, addTemplate, defineNuxtModule } from '@nuxt/kit';
import type { NuxtModule } from '@nuxt/schema';
import { ResponsiveConfig } from '../responsive.enum';
import type { MediaQueryConfig } from '../responsive.enum';
import type { SetConfigOptions } from '../base-state';

export interface ModuleOptions {
  breakpoints?: Record<string, MediaQueryConfig>;
  order?: string[];
  debounce?: number;
  ssrState?: Record<string, boolean>;
}

function pickSettings(options: ModuleOptions): SetConfigOptions {
  const settings: SetConfigOptions = {};
  if (options.order !== undefined) settings.order = options.order;
  if (options.debounce !== undefined) settings.debounce = options.debounce;
  if (options.ssrState !== undefined) settings.ssrState = options.ssrState;
  return settings;
}

const responsiveModule: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'responsive-media',
    configKey: 'responsive',
    compatibility: { nuxt: '>=3.9.0' },
  },
  defaults: {},
  setup(options, nuxt) {
    const breakpoints = options.breakpoints ?? ResponsiveConfig;
    const settings = pickSettings(options);

    nuxt.options.build.transpile.push('responsive-media');

    const composables = addTemplate({
      filename: 'responsive-media/index.ts',
      write: true,
      getContents: () =>
        [
          "import { defineResponsive } from 'responsive-media/vue';",
          '',
          'export const { useResponsive, useBreakpoints, plugin } = defineResponsive(',
          `  ${JSON.stringify(breakpoints, null, 2).replace(/\n/g, '\n  ')},`,
          `  ${JSON.stringify(settings)},`,
          ');',
          '',
        ].join('\n'),
    });

    addImports([
      { name: 'useResponsive', from: composables.dst },
      { name: 'useBreakpoints', from: composables.dst },
      { name: 'useMediaQuery', from: 'responsive-media/vue' },
      { name: 'useContainerState', from: 'responsive-media/vue' },
    ]);

    addPluginTemplate({
      filename: 'responsive-media.plugin.ts',
      getContents: () =>
        [
          "import { defineNuxtPlugin } from '#imports';",
          `import { plugin } from ${JSON.stringify(composables.dst)};`,
          '',
          'export default defineNuxtPlugin((nuxtApp) => {',
          '  nuxtApp.vueApp.use(plugin);',
          '});',
          '',
        ].join('\n'),
    });
  },
});

export default responsiveModule;
