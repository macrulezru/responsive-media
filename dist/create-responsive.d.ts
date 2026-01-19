import { type Breakpoint, type MediaQueryConfig } from './responsive.enum';
export type { MediaQueryConfig };
type ResponsiveState = Record<Breakpoint, boolean>;
type ResponsiveListener = (state: ResponsiveState) => void;
declare class ReactiveResponsiveState {
    private state;
    private listeners;
    proxy: ResponsiveState;
    private queries;
    private mediaQueries;
    constructor();
    private applyConfig;
    getMediaQueries(): Record<string, string>;
    setConfig(config: Record<string, MediaQueryConfig>): void;
    subscribe(listener: ResponsiveListener): () => boolean;
    private notify;
}
export declare function getResponsiveMediaQueries(): Record<string, string>;
export declare const responsiveState: ReactiveResponsiveState;
export declare function setResponsiveConfig(config: Record<string, MediaQueryConfig>): void;
