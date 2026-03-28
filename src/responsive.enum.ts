export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export interface MediaQueryCondition {
  type:
    | 'width'
    | 'min-width'
    | 'max-width'
    | 'height'
    | 'min-height'
    | 'max-height'
    | 'aspect-ratio'
    | 'min-aspect-ratio'
    | 'max-aspect-ratio'
    | 'orientation'
    | 'resolution'
    | 'min-resolution'
    | 'max-resolution'
    | 'color'
    | 'min-color'
    | 'max-color'
    | 'color-index'
    | 'min-color-index'
    | 'max-color-index'
    | 'monochrome'
    | 'min-monochrome'
    | 'max-monochrome'
    | 'scan'
    | 'grid'
    | 'prefers-color-scheme'
    | 'prefers-reduced-motion'
    | 'prefers-contrast'
    | 'hover'
    | 'any-hover'
    | 'pointer'
    | 'any-pointer'
    | 'forced-colors'
    | 'display-mode'
    | 'update'
    /**
     * Inserts the value verbatim into the media query string without wrapping
     * it in parentheses. Use for media types (`print`, `screen`, `all`) or
     * any raw token not covered by the typed conditions above.
     *
     * @example
     * // Match only print media
     * { type: 'raw', value: 'print' }
     * // → window.matchMedia('print')
     *
     * @example
     * // Restrict a condition to screen media
     * [{ type: 'raw', value: 'screen' }, { type: 'max-width', value: 600 }]
     * // → window.matchMedia('screen and (max-width: 600px)')
     */
    | 'raw';
  value: number | string;
}

/**
 * A flat array of conditions joined with `and`.
 * Example: [min-width: 600, max-width: 960] → (min-width: 600px) and (max-width: 960px)
 */
export type MediaQueryAndGroup = MediaQueryCondition[];

/**
 * A config entry for a single breakpoint.
 *
 * - Flat array  → all conditions joined with `and`
 * - Nested array → inner arrays joined with `and`, outer arrays joined with `,` (or)
 *
 * @example AND only
 * [{ type: 'min-width', value: 601 }, { type: 'max-width', value: 960 }]
 *
 * @example OR between groups
 * [
 *   [{ type: 'max-width', value: 600 }],
 *   [{ type: 'orientation', value: 'portrait' }, { type: 'max-width', value: 1024 }],
 * ]
 */
export type MediaQueryConfig = MediaQueryCondition[] | MediaQueryCondition[][];

/**
 * Derives a boolean-state shape from a breakpoint config object.
 *
 * @example
 * const config = {
 *   sm: [{ type: 'max-width', value: 640 }],
 *   lg: [{ type: 'min-width', value: 1024 }],
 * } satisfies Record<string, MediaQueryConfig>;
 *
 * type MyState = ConfigToState<typeof config>; // { sm: boolean; lg: boolean }
 */
export type ConfigToState<T extends Record<string, MediaQueryConfig>> = {
  [K in keyof T]: boolean;
};

/**
 * Default breakpoint config. Mutually exclusive:
 * - mobile:  ≤ 600px
 * - tablet:  601px – 960px
 * - desktop: ≥ 961px
 */
export const ResponsiveConfig: Record<Breakpoint, MediaQueryConfig> = {
  mobile:  [{ type: 'max-width', value: 600 }],
  tablet:  [{ type: 'min-width', value: 601 }, { type: 'max-width', value: 960 }],
  desktop: [{ type: 'min-width', value: 961 }],
} as const;
