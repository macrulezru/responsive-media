import type { MediaQueryConfig } from './responsive.enum';

/**
 * Tailwind CSS v3/v4 breakpoints — mutually exclusive ranges.
 *
 * | Key  | Range              |
 * |------|--------------------|
 * | xs   | ≤ 639px            |
 * | sm   | 640 – 767px        |
 * | md   | 768 – 1023px       |
 * | lg   | 1024 – 1279px      |
 * | xl   | 1280 – 1535px      |
 * | 2xl  | ≥ 1536px           |
 */
export const TailwindPreset: Record<string, MediaQueryConfig> = {
  xs:    [{ type: 'max-width', value: 639 }],
  sm:    [{ type: 'min-width', value: 640 },  { type: 'max-width', value: 767 }],
  md:    [{ type: 'min-width', value: 768 },  { type: 'max-width', value: 1023 }],
  lg:    [{ type: 'min-width', value: 1024 }, { type: 'max-width', value: 1279 }],
  xl:    [{ type: 'min-width', value: 1280 }, { type: 'max-width', value: 1535 }],
  '2xl': [{ type: 'min-width', value: 1536 }],
};

/** Ordered key array matching `TailwindPreset` — pass as `order` option. */
export const TailwindOrder = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const;

/**
 * Bootstrap 5 breakpoints — mutually exclusive ranges.
 *
 * | Key  | Range              |
 * |------|--------------------|
 * | xs   | ≤ 575px            |
 * | sm   | 576 – 767px        |
 * | md   | 768 – 991px        |
 * | lg   | 992 – 1199px       |
 * | xl   | 1200 – 1399px      |
 * | xxl  | ≥ 1400px           |
 */
export const BootstrapPreset: Record<string, MediaQueryConfig> = {
  xs:  [{ type: 'max-width', value: 575 }],
  sm:  [{ type: 'min-width', value: 576 },  { type: 'max-width', value: 767 }],
  md:  [{ type: 'min-width', value: 768 },  { type: 'max-width', value: 991 }],
  lg:  [{ type: 'min-width', value: 992 },  { type: 'max-width', value: 1199 }],
  xl:  [{ type: 'min-width', value: 1200 }, { type: 'max-width', value: 1399 }],
  xxl: [{ type: 'min-width', value: 1400 }],
};

/** Ordered key array matching `BootstrapPreset` — pass as `order` option. */
export const BootstrapOrder = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const;

/**
 * Accessibility & user-preference media queries.
 * Keys are mutually independent — multiple can be `true` at the same time.
 *
 * | Key            | Matches when …                              |
 * |----------------|---------------------------------------------|
 * | dark           | `prefers-color-scheme: dark`                |
 * | light          | `prefers-color-scheme: light`               |
 * | reducedMotion  | `prefers-reduced-motion: reduce`            |
 * | highContrast   | `prefers-contrast: more`                    |
 * | lowContrast    | `prefers-contrast: less`                    |
 * | noHover        | `hover: none` (touch / stylus devices)      |
 * | coarsePointer  | `pointer: coarse` (finger-sized input)      |
 * | forcedColors   | `forced-colors: active` (Windows HCM)      |
 * | print          | `print` media type                          |
 */
export const AccessibilityPreset: Record<string, MediaQueryConfig> = {
  dark:          [{ type: 'prefers-color-scheme',  value: 'dark' }],
  light:         [{ type: 'prefers-color-scheme',  value: 'light' }],
  reducedMotion: [{ type: 'prefers-reduced-motion', value: 'reduce' }],
  highContrast:  [{ type: 'prefers-contrast',       value: 'more' }],
  lowContrast:   [{ type: 'prefers-contrast',       value: 'less' }],
  noHover:       [{ type: 'hover',                  value: 'none' }],
  coarsePointer: [{ type: 'pointer',                value: 'coarse' }],
  forcedColors:  [{ type: 'forced-colors',          value: 'active' }],
  print:         [{ type: 'raw',                    value: 'print' }],
};
