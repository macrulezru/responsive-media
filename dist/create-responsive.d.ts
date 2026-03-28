import { type MediaQueryConfig } from './responsive.enum';
import { BaseResponsiveState, type ResponsiveState, type SetConfigOptions } from './base-state';
export type { MediaQueryConfig, ResponsiveState, SetConfigOptions };
export { BaseResponsiveState };
export declare function buildMediaQuery(conditions: MediaQueryConfig): string;
export declare class ReactiveResponsiveState extends BaseResponsiveState {
    private queries;
    private handlers;
    constructor(config?: Record<string, MediaQueryConfig>, options?: SetConfigOptions);
    protected setupSources(config: Record<string, MediaQueryConfig>): void;
    protected cleanupSources(): void;
}
export declare const responsiveState: ReactiveResponsiveState;
/**
 * Creates an isolated `ReactiveResponsiveState` instance — useful for tests,
 * SSR (per-request instances), or multiple independent responsive contexts.
 *
 * @example
 * const layoutState = createResponsiveState(TailwindPreset, {
 *   order: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'],
 * });
 * const themeState = createResponsiveState(AccessibilityPreset);
 */
export declare function createResponsiveState(config?: Record<string, MediaQueryConfig>, options?: SetConfigOptions): ReactiveResponsiveState;
/**
 * Converts a `MediaQueryConfig` array to a CSS media query string.
 * Useful for CSS-in-JS, `@container` rules, or debugging.
 *
 * @example
 * toMediaQueryString([{ type: 'min-width', value: 768 }, { type: 'max-width', value: 1024 }])
 * // → "(min-width: 768px) and (max-width: 1024px)"
 *
 * toMediaQueryString([[{ type: 'max-width', value: 600 }], [{ type: 'orientation', value: 'portrait' }]])
 * // → "(max-width: 600px), (orientation: portrait)"
 */
export declare function toMediaQueryString(conditions: MediaQueryConfig): string;
export declare function getResponsiveState<T extends Record<string, boolean> = ResponsiveState>(): T;
export declare function getResponsiveMediaQueries(): Record<string, string>;
export declare function setResponsiveConfig(config: Record<string, MediaQueryConfig>, options?: SetConfigOptions): void;
/**
 * Returns the first value in `map` whose key is `true` in `state`,
 * or `fallback` if none match. Priority follows `map` insertion order.
 *
 * @example
 * const cols  = match(state, { mobile: 1, tablet: 2, desktop: 4 });
 * const View  = match(state, { mobile: MobileMenu, desktop: DesktopNav });
 * const label = match(state, { sm: 'Compact', lg: 'Full' }, 'Default');
 */
export declare function match<T>(state: Record<string, boolean>, map: Record<string, T>, fallback?: T): T | undefined;
