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
    | 'grid';
  value: number | string;
}

export type MediaQueryConfig = MediaQueryCondition[];

export const ResponsiveConfig: Record<Breakpoint, MediaQueryConfig> = {
  mobile: [
    { type: 'max-width', value: 600 },
  ],
  tablet: [
    { type: 'max-width', value: 960 },
  ],
  desktop: [
    { type: 'min-width', value: 961 },
  ],
} as const;
