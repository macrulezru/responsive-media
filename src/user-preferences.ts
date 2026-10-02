import { AccessibilityPreset } from './presets';
import { createResponsiveState } from './viewport-state';
import type { ReactiveResponsiveState } from './viewport-state';

export interface UserPreferences {
  dark: boolean;
  light: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  lowContrast: boolean;
  noHover: boolean;
  coarsePointer: boolean;
  forcedColors: boolean;
  print: boolean;
}

let instance: ReactiveResponsiveState | null = null;

export function getUserPreferencesState(): ReactiveResponsiveState {
  if (instance === null) instance = createResponsiveState(AccessibilityPreset);
  return instance;
}
