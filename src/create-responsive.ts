import { ResponsiveConfig, type MediaQueryConfig, type MediaQueryCondition } from './responsive.enum';
import { BaseResponsiveState, type ResponsiveState, type SetConfigOptions } from './base-state';
import { hasMatchMedia } from './utils';

export type { MediaQueryConfig, ResponsiveState, SetConfigOptions };
export { BaseResponsiveState };

// ---------------------------------------------------------------------------
// Media query string builder (also used by ContainerState for @container strings)
// ---------------------------------------------------------------------------

const PIXEL_TYPES = new Set([
  'width', 'min-width', 'max-width',
  'height', 'min-height', 'max-height',
]);

function formatValue(cond: MediaQueryCondition): string {
  if (typeof cond.value === 'number' && PIXEL_TYPES.has(cond.type)) {
    return `${cond.value}px`;
  }
  return String(cond.value);
}

function conditionToString(cond: MediaQueryCondition): string {
  // 'raw' inserts the value verbatim (e.g. 'print', 'screen')
  return cond.type === 'raw' ? String(cond.value) : `(${cond.type}: ${formatValue(cond)})`;
}

export function buildMediaQuery(conditions: MediaQueryConfig): string {
  if (conditions.length === 0) return '';
  if (Array.isArray(conditions[0])) {
    return (conditions as MediaQueryCondition[][])
      .map(group => group.map(conditionToString).join(' and '))
      .join(', ');
  }
  return (conditions as MediaQueryCondition[]).map(conditionToString).join(' and ');
}

// ---------------------------------------------------------------------------
// ReactiveResponsiveState — viewport-based (matchMedia)
// ---------------------------------------------------------------------------

export class ReactiveResponsiveState extends BaseResponsiveState {
  private queries: Record<string, MediaQueryList> = {};
  private handlers: Record<string, (e: MediaQueryListEvent) => void> = {};

  constructor(
    config?: Record<string, MediaQueryConfig>,
    options?: SetConfigOptions,
  ) {
    super();
    if (options?.debounce !== undefined) this.debounceMs = options.debounce;
    if (options?.order !== undefined) this.order = options.order;
    this.applyConfig(config ?? ResponsiveConfig);
  }

  protected setupSources(config: Record<string, MediaQueryConfig>): void {
    Object.entries(config).forEach(([key, conditions]) => {
      const mq = buildMediaQuery(conditions);
      this.mediaQueries[key] = mq;

      if (!hasMatchMedia()) {
        this.state[key] = false;
        return;
      }

      const query = window.matchMedia(mq);
      this.queries[key] = query;

      const handler = (e: MediaQueryListEvent) => { this.proxy[key] = e.matches; };
      this.handlers[key] = handler;
      query.addEventListener('change', handler);
      this.state[key] = query.matches;
    });
  }

  protected cleanupSources(): void {
    Object.entries(this.handlers).forEach(([key, handler]) => {
      this.queries[key]?.removeEventListener('change', handler);
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
export function createResponsiveState(
  config?: Record<string, MediaQueryConfig>,
  options?: SetConfigOptions,
): ReactiveResponsiveState {
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
export function toMediaQueryString(conditions: MediaQueryConfig): string {
  return buildMediaQuery(conditions);
}

export function getResponsiveState<T extends Record<string, boolean> = ResponsiveState>(): T {
  return responsiveState.getState<T>();
}

export function getResponsiveMediaQueries(): Record<string, string> {
  return responsiveState.getMediaQueries();
}

export function setResponsiveConfig(
  config: Record<string, MediaQueryConfig>,
  options?: SetConfigOptions,
): void {
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
export function match<T>(
  state: Record<string, boolean>,
  map: Record<string, T>,
  fallback?: T,
): T | undefined {
  for (const [key, value] of Object.entries(map)) {
    if (state[key]) return value;
  }
  return fallback;
}
