import type { App } from '@vue/runtime-core';
import type { MediaQueryConfig } from './create-responsive';
export declare function useResponsive(): any;
type ResponsiveConfigType = Record<string, MediaQueryConfig>;
export declare const ResponsivePlugin: {
    install(app: App, config?: ResponsiveConfigType): void;
};
export {};
