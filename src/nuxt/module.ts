import { addImports, addPluginTemplate, addTemplate, defineNuxtModule } from '@nuxt/kit';
import type { NuxtModule } from '@nuxt/schema';
import { ResponsiveConfig } from '../responsive.enum';
import type { MediaQueryConfig } from '../responsive.enum';
import type { SetConfigOptions } from '../base-state';
import type { DeviceClass, SsrHint } from '../ssr-hints';
import { VIEWPORT_COOKIE } from '../ssr-hints';
import type { ViewportSize } from '../size';
import { toCustomMedia, toScssModule } from '../css';

export interface ModuleOptions {
  breakpoints?: Record<string, MediaQueryConfig>;
  order?: string[];
  debounce?: number;
  ssrState?: Record<string, boolean>;
  hydration?: 'immediate' | 'deferred';
  ssrHints?: SsrHint[];
  ssrDevices?: Partial<Record<DeviceClass, ViewportSize>>;
  cookie?: string;
  devBadge?: boolean;
  css?: {
    scss?: boolean;
    customMedia?: boolean;
  };
}

declare module '@nuxt/schema' {
  interface NuxtConfig {
    responsive?: ModuleOptions;
  }
  interface NuxtOptions {
    responsive?: ModuleOptions;
  }
}

function pickSettings(options: ModuleOptions): SetConfigOptions & { hydration: 'immediate' | 'deferred' } {
  const settings: SetConfigOptions & { hydration: 'immediate' | 'deferred' } = {
    hydration: options.hydration ?? 'deferred',
  };
  if (options.order !== undefined) settings.order = options.order;
  if (options.debounce !== undefined) settings.debounce = options.debounce;
  if (options.ssrState !== undefined) settings.ssrState = options.ssrState;
  return settings;
}

function json(value: unknown, indent = 0): string {
  return JSON.stringify(value, null, indent === 0 ? undefined : 2);
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
    const hints = options.ssrHints ?? [];
    const cookieName = options.cookie ?? VIEWPORT_COOKIE;

    nuxt.options.build.transpile.push('responsive-media');

    const composables = addTemplate({
      filename: 'responsive-media/index.ts',
      write: true,
      getContents: () =>
        [
          "import { defineResponsive } from 'responsive-media/vue';",
          '',
          'export const { useResponsive, useBreakpoints, useResponsiveValue, commitHydration, plugin } = defineResponsive(',
          `  ${json(breakpoints, 2).replace(/\n/g, '\n  ')},`,
          `  ${json(settings)},`,
          ');',
          '',
        ].join('\n'),
    });

    addImports([
      { name: 'useResponsive', from: composables.dst },
      { name: 'useBreakpoints', from: composables.dst },
      { name: 'useResponsiveValue', from: composables.dst },
      { name: 'useMediaQuery', from: 'responsive-media/vue' },
      { name: 'useContainerState', from: 'responsive-media/vue' },
      { name: 'useUserPreferences', from: 'responsive-media/vue' },
      { name: 'useViewportSize', from: 'responsive-media/vue' },
    ]);

    addPluginTemplate({
      filename: 'responsive-media.plugin.ts',
      getContents: () =>
        [
          "import { defineNuxtPlugin, useCookie, useRequestHeaders } from '#imports';",
          "import { resolveSsrState, serializeViewportCookie } from 'responsive-media';",
          `import { plugin, commitHydration } from ${JSON.stringify(composables.dst)};`,
          '',
          `const breakpoints = ${json(breakpoints)};`,
          `const hints = ${json(hints)};`,
          `const devices = ${json(options.ssrDevices ?? {})};`,
          `const fallback = ${json(options.ssrState ?? {})};`,
          `const cookieName = ${JSON.stringify(cookieName)};`,
          '',
          'export default defineNuxtPlugin((nuxtApp) => {',
          '  let ssrState: Record<string, boolean> | undefined;',
          '',
          '  if (hints.length > 0 && import.meta.server) {',
          '    const cookie = useCookie<string | null>(cookieName);',
          "    const headers = useRequestHeaders(['user-agent']);",
          '    ssrState = resolveSsrState(',
          '      breakpoints,',
          "      { cookie: cookie.value, userAgent: headers['user-agent'] },",
          '      { hints, devices, fallback },',
          '    );',
          '    nuxtApp.payload.responsive = ssrState;',
          '  } else if (hints.length > 0) {',
          '    ssrState = nuxtApp.payload.responsive as Record<string, boolean> | undefined;',
          '  }',
          '',
          '  nuxtApp.vueApp.use(plugin, {',
          '    ssrState,',
          '    hydrating: import.meta.client ? nuxtApp.isHydrating : undefined,',
          "    commit: 'manual',",
          '  });',
          "  nuxtApp.hook('app:suspense:resolve', () => commitHydration());",
          '',
          "  if (import.meta.client && hints.includes('cookie')) {",
          '    const cookie = useCookie<string | null>(cookieName, { maxAge: 60 * 60 * 24 * 365, sameSite: \'lax\', path: \'/\' });',
          '    const write = () => {',
          '      cookie.value = serializeViewportCookie({ width: window.innerWidth, height: window.innerHeight });',
          '    };',
          "    nuxtApp.hook('app:mounted', () => {",
          '      write();',
          '      let timer: ReturnType<typeof setTimeout> | undefined;',
          "      window.addEventListener('resize', () => {",
          '        clearTimeout(timer);',
          '        timer = setTimeout(write, 300);',
          '      });',
          '    });',
          '  }',
          '});',
          '',
        ].join('\n'),
    });

    if (options.devBadge && nuxt.options.dev) {
      addPluginTemplate({
        filename: 'responsive-media.devbadge.ts',
        mode: 'client',
        getContents: () =>
          [
            "import { defineNuxtPlugin } from '#imports';",
            "import { responsiveState } from 'responsive-media';",
            `import ${JSON.stringify(composables.dst)};`,
            '',
            'export default defineNuxtPlugin((nuxtApp) => {',
            "  nuxtApp.hook('app:mounted', () => {",
            "    const badge = document.createElement('div');",
            "    badge.setAttribute('data-responsive-badge', '');",
            '    Object.assign(badge.style, {',
            "      position: 'fixed',",
            "      right: '8px',",
            "      bottom: '8px',",
            "      zIndex: '2147483647',",
            "      padding: '4px 8px',",
            "      font: '12px/1.2 ui-monospace, monospace',",
            "      color: '#fff',",
            "      background: 'rgba(17, 24, 39, 0.85)',",
            "      borderRadius: '6px',",
            "      pointerEvents: 'none',",
            '    });',
            '    const render = () => {',
            "      badge.textContent = (responsiveState.current ?? '-') + ' \\u00b7 ' + window.innerWidth + 'px';",
            '    };',
            '    responsiveState.subscribe(render);',
            "    window.addEventListener('resize', render);",
            '    document.body.appendChild(badge);',
            '  });',
            '});',
            '',
          ].join('\n'),
      });
    }

    if (options.css?.scss) {
      addTemplate({
        filename: 'responsive-media/queries.scss',
        write: true,
        getContents: () => toScssModule(breakpoints),
      });
    }

    if (options.css?.customMedia) {
      addTemplate({
        filename: 'responsive-media/custom-media.css',
        write: true,
        getContents: () => `${toCustomMedia(breakpoints)}\n`,
      });
    }
  },
});

export default responsiveModule;
