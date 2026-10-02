import type { MediaQueryConfig } from './responsive.enum';
import type { ResponsiveState, SetConfigOptions } from './base-state';
import { ReactiveResponsiveState } from './viewport-state';

export const responsiveState = new ReactiveResponsiveState();

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

