import { ResponsiveConfig } from './responsive.enum';
import { BaseResponsiveState } from './base-state';
import { hasMatchMedia } from './utils';
export { BaseResponsiveState };
// ---------------------------------------------------------------------------
// Media query string builder (also used by ContainerState for @container strings)
// ---------------------------------------------------------------------------
const PIXEL_TYPES = new Set([
    'width', 'min-width', 'max-width',
    'height', 'min-height', 'max-height',
]);
function formatValue(cond) {
    if (typeof cond.value === 'number' && PIXEL_TYPES.has(cond.type)) {
        return `${cond.value}px`;
    }
    return String(cond.value);
}
function conditionToString(cond) {
    // 'raw' inserts the value verbatim (e.g. 'print', 'screen')
    return cond.type === 'raw' ? String(cond.value) : `(${cond.type}: ${formatValue(cond)})`;
}
export function buildMediaQuery(conditions) {
    if (conditions.length === 0)
        return '';
    if (Array.isArray(conditions[0])) {
        return conditions
            .map(group => group.map(conditionToString).join(' and '))
            .join(', ');
    }
    return conditions.map(conditionToString).join(' and ');
}
// ---------------------------------------------------------------------------
// ReactiveResponsiveState — viewport-based (matchMedia)
// ---------------------------------------------------------------------------
export class ReactiveResponsiveState extends BaseResponsiveState {
    constructor(config, options) {
        super();
        this.queries = {};
        this.handlers = {};
        if ((options === null || options === void 0 ? void 0 : options.debounce) !== undefined)
            this.debounceMs = options.debounce;
        if ((options === null || options === void 0 ? void 0 : options.order) !== undefined)
            this.order = options.order;
        this.applyConfig(config !== null && config !== void 0 ? config : ResponsiveConfig);
    }
    setupSources(config) {
        Object.entries(config).forEach(([key, conditions]) => {
            const mq = buildMediaQuery(conditions);
            this.mediaQueries[key] = mq;
            if (!hasMatchMedia()) {
                this.state[key] = false;
                return;
            }
            const query = window.matchMedia(mq);
            this.queries[key] = query;
            const handler = (e) => { this.proxy[key] = e.matches; };
            this.handlers[key] = handler;
            query.addEventListener('change', handler);
            this.state[key] = query.matches;
        });
    }
    cleanupSources() {
        Object.entries(this.handlers).forEach(([key, handler]) => {
            var _a;
            (_a = this.queries[key]) === null || _a === void 0 ? void 0 : _a.removeEventListener('change', handler);
        });
        this.queries = {};
        this.handlers = {};
    }
}
// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
export const responsiveState = new ReactiveResponsiveState();
// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------
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
export function createResponsiveState(config, options) {
    return new ReactiveResponsiveState(config, options);
}
// ---------------------------------------------------------------------------
// Standalone helpers
// ---------------------------------------------------------------------------
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
export function toMediaQueryString(conditions) {
    return buildMediaQuery(conditions);
}
export function getResponsiveState() {
    return responsiveState.getState();
}
export function getResponsiveMediaQueries() {
    return responsiveState.getMediaQueries();
}
export function setResponsiveConfig(config, options) {
    responsiveState.setConfig(config, options);
}
/**
 * Returns the first value in `map` whose key is `true` in `state`,
 * or `fallback` if none match. Priority follows `map` insertion order.
 *
 * @example
 * const cols  = match(state, { mobile: 1, tablet: 2, desktop: 4 });
 * const View  = match(state, { mobile: MobileMenu, desktop: DesktopNav });
 * const label = match(state, { sm: 'Compact', lg: 'Full' }, 'Default');
 */
export function match(state, map, fallback) {
    for (const [key, value] of Object.entries(map)) {
        if (state[key])
            return value;
    }
    return fallback;
}
