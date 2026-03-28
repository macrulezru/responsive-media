import type { MediaQueryConfig } from './responsive.enum';
import { BaseResponsiveState, type SetConfigOptions } from './base-state';
export declare class ContainerState extends BaseResponsiveState {
    private element;
    private observer;
    private configSnapshot;
    constructor(element: Element, config: Record<string, MediaQueryConfig>, options?: SetConfigOptions);
    protected setupSources(config: Record<string, MediaQueryConfig>): void;
    protected cleanupSources(): void;
}
/**
 * Creates a `ContainerState` that tracks an element's dimensions via
 * `ResizeObserver` and evaluates breakpoint conditions in JavaScript.
 *
 * The API is identical to `ReactiveResponsiveState` — all subscription
 * methods (`subscribe`, `on`, `onEnter`, `onLeave`, `waitFor`, etc.) work
 * the same way.
 *
 * The `getMediaQueries()` method returns CSS `@container` compatible strings
 * that can be used in stylesheets alongside the JS reactive state.
 *
 * @example
 * const card = document.querySelector('.card')!;
 *
 * const cardState = createContainerState(card, {
 *   compact: [{ type: 'max-width', value: 300 }],
 *   wide:    [{ type: 'min-width', value: 600 }],
 * });
 *
 * cardState.on('compact', (v) => card.classList.toggle('card--compact', v));
 * cardState.syncCSSVars({ prefix: '--card-' });
 *
 * // Cleanup when no longer needed:
 * cardState.destroy();
 */
export declare function createContainerState(element: Element, config: Record<string, MediaQueryConfig>, options?: SetConfigOptions): ContainerState;
