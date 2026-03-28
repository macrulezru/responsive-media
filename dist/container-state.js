import { BaseResponsiveState } from './base-state';
import { buildMediaQuery } from './create-responsive';
import { hasResizeObserver } from './utils';
// ---------------------------------------------------------------------------
// Condition evaluator (JS-side, no matchMedia)
// ---------------------------------------------------------------------------
function evaluateSingle(cond, w, h) {
    const val = typeof cond.value === 'number' ? cond.value : parseFloat(String(cond.value));
    switch (cond.type) {
        case 'max-width': return w <= val;
        case 'min-width': return w >= val;
        case 'max-height': return h <= val;
        case 'min-height': return h >= val;
        case 'orientation': return cond.value === 'landscape' ? w > h : w <= h;
        case 'aspect-ratio': {
            const [rw, rh] = String(cond.value).split('/').map(Number);
            return rh ? Math.abs(w / h - rw / rh) < 0.01 : false;
        }
        default: return false;
    }
}
function evaluateConditions(conditions, w, h) {
    if (Array.isArray(conditions[0])) {
        // OR mode — any group must fully match
        return conditions.some(group => group.every(c => evaluateSingle(c, w, h)));
    }
    // AND mode — all conditions must match
    return conditions.every(c => evaluateSingle(c, w, h));
}
// ---------------------------------------------------------------------------
// ContainerState — ResizeObserver-based
// ---------------------------------------------------------------------------
export class ContainerState extends BaseResponsiveState {
    constructor(element, config, options) {
        super();
        this.observer = null;
        this.configSnapshot = {};
        this.element = element;
        if ((options === null || options === void 0 ? void 0 : options.debounce) !== undefined)
            this.debounceMs = options.debounce;
        if ((options === null || options === void 0 ? void 0 : options.order) !== undefined)
            this.order = options.order;
        this.applyConfig(config);
    }
    setupSources(config) {
        this.configSnapshot = config;
        // Generate CSS @container-compatible strings for each breakpoint
        Object.entries(config).forEach(([key, conditions]) => {
            this.mediaQueries[key] = buildMediaQuery(conditions);
        });
        if (!hasResizeObserver()) {
            // SSR or unsupported — default to false
            Object.keys(config).forEach(key => { this.state[key] = false; });
            return;
        }
        // Synchronous initial evaluation using the element's current size
        const rect = this.element.getBoundingClientRect();
        Object.entries(config).forEach(([key, conditions]) => {
            this.state[key] = evaluateConditions(conditions, rect.width, rect.height);
        });
        this.observer = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            Object.entries(this.configSnapshot).forEach(([key, conditions]) => {
                this.proxy[key] = evaluateConditions(conditions, width, height);
            });
        });
        this.observer.observe(this.element);
    }
    cleanupSources() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.configSnapshot = {};
    }
}
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
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
export function createContainerState(element, config, options) {
    return new ContainerState(element, config, options);
}
