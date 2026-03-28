import type { MediaQueryConfig, MediaQueryCondition } from './responsive.enum';
import { BaseResponsiveState, type SetConfigOptions } from './base-state';
import { buildMediaQuery } from './create-responsive';
import { hasResizeObserver } from './utils';

// ---------------------------------------------------------------------------
// Condition evaluator (JS-side, no matchMedia)
// ---------------------------------------------------------------------------

function evaluateSingle(cond: MediaQueryCondition, w: number, h: number): boolean {
  const val = typeof cond.value === 'number' ? cond.value : parseFloat(String(cond.value));
  switch (cond.type) {
    case 'max-width':    return w <= val;
    case 'min-width':    return w >= val;
    case 'max-height':   return h <= val;
    case 'min-height':   return h >= val;
    case 'orientation':  return cond.value === 'landscape' ? w > h : w <= h;
    case 'aspect-ratio': {
      const [rw, rh] = String(cond.value).split('/').map(Number);
      return rh ? Math.abs(w / h - rw / rh) < 0.01 : false;
    }
    default: return false;
  }
}

function evaluateConditions(
  conditions: MediaQueryConfig,
  w: number,
  h: number,
): boolean {
  if (Array.isArray(conditions[0])) {
    // OR mode — any group must fully match
    return (conditions as MediaQueryCondition[][]).some(group =>
      group.every(c => evaluateSingle(c, w, h)),
    );
  }
  // AND mode — all conditions must match
  return (conditions as MediaQueryCondition[]).every(c => evaluateSingle(c, w, h));
}

// ---------------------------------------------------------------------------
// ContainerState — ResizeObserver-based
// ---------------------------------------------------------------------------

export class ContainerState extends BaseResponsiveState {
  private element: Element;
  private observer: ResizeObserver | null = null;
  private configSnapshot: Record<string, MediaQueryConfig> = {};

  constructor(
    element: Element,
    config: Record<string, MediaQueryConfig>,
    options?: SetConfigOptions,
  ) {
    super();
    this.element = element;
    if (options?.debounce !== undefined) this.debounceMs = options.debounce;
    if (options?.order !== undefined) this.order = options.order;
    this.applyConfig(config);
  }

  protected setupSources(config: Record<string, MediaQueryConfig>): void {
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

  protected cleanupSources(): void {
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
export function createContainerState(
  element: Element,
  config: Record<string, MediaQueryConfig>,
  options?: SetConfigOptions,
): ContainerState {
  return new ContainerState(element, config, options);
}
