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
export declare const TailwindPreset: Record<string, MediaQueryConfig>;
/** Ordered key array matching `TailwindPreset` — pass as `order` option. */
export declare const TailwindOrder: readonly ["xs", "sm", "md", "lg", "xl", "2xl"];
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
export declare const BootstrapPreset: Record<string, MediaQueryConfig>;
/** Ordered key array matching `BootstrapPreset` — pass as `order` option. */
export declare const BootstrapOrder: readonly ["xs", "sm", "md", "lg", "xl", "xxl"];
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
export declare const AccessibilityPreset: Record<string, MediaQueryConfig>;
