import { inject, reactive } from '@vue/runtime-core';
import { responsiveState, setResponsiveConfig } from './create-responsive';
const RESPONSIVE_KEY = Symbol('responsiveState');
let vueReactiveState = null;
export function useResponsive() {
    const injected = inject(RESPONSIVE_KEY);
    if (injected)
        return injected;
    if (!vueReactiveState) {
        vueReactiveState = reactive({ ...responsiveState.proxy });
        responsiveState.subscribe((state) => {
            Object.keys(state).forEach(key => {
                // @ts-ignore
                vueReactiveState[key] = state[key];
            });
        });
    }
    return vueReactiveState;
}
export const ResponsivePlugin = {
    install(app, config) {
        if (config) {
            setResponsiveConfig(config);
        }
        if (!vueReactiveState) {
            vueReactiveState = reactive({ ...responsiveState.proxy });
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
