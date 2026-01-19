

import { inject, readonly, reactive } from '@vue/runtime-core';
import type { App } from '@vue/runtime-core';
import { responsiveState, setResponsiveConfig } from './create-responsive';
import type { MediaQueryConfig } from './create-responsive';


const RESPONSIVE_KEY = Symbol('responsiveState');
let vueReactiveState: any = null;

export function useResponsive() {
  // Получаем реактивный объект из provide/inject или создаём локально
  const injected = inject(RESPONSIVE_KEY);
  if (injected) return injected;
  if (!vueReactiveState) {
    vueReactiveState = readonly(reactive({ ...responsiveState.proxy }));
    // Синхронизируем с изменениями responsiveState
    responsiveState.subscribe((state) => {
      Object.keys(state).forEach(key => {
        // @ts-ignore
        vueReactiveState[key] = state[key];
      });
    });
  }
  return vueReactiveState;
}

type ResponsiveConfigType = Record<string, MediaQueryConfig>;

export const ResponsivePlugin = {
  install(app: App, config?: ResponsiveConfigType) {
    if (config) {
      setResponsiveConfig(config);
    }
    if (!vueReactiveState) {
      vueReactiveState = readonly(reactive({ ...responsiveState.proxy }));
      responsiveState.subscribe((state) => {
        Object.keys(state).forEach(key => {
          // @ts-ignore
          vueReactiveState[key] = state[key];
        });
      });
    }
    app.provide(RESPONSIVE_KEY, vueReactiveState);
  },
};
