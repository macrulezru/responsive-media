/**
 * Default breakpoint config. Mutually exclusive:
 * - mobile:  ≤ 600px
 * - tablet:  601px – 960px
 * - desktop: ≥ 961px
 */
export const ResponsiveConfig = {
    mobile: [{ type: 'max-width', value: 600 }],
    tablet: [{ type: 'min-width', value: 601 }, { type: 'max-width', value: 960 }],
    desktop: [{ type: 'min-width', value: 961 }],
};
