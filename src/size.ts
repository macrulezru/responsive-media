import type { MediaQueryConfig } from './responsive.enum';
import type { ResponsiveState } from './base-state';
import { evaluateConditions } from './container-state';

export interface ViewportSize {
  width: number;
  height: number;
}

export function statesFromSize(
  config: Record<string, MediaQueryConfig>,
  size: ViewportSize,
): ResponsiveState {
  return Object.keys(config).reduce<ResponsiveState>((acc, key) => {
    acc[key] = evaluateConditions(config[key], size.width, size.height);
    return acc;
  }, {});
}
