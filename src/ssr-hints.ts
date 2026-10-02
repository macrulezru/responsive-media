import type { MediaQueryConfig } from './responsive.enum';
import type { ResponsiveState } from './base-state';
import { statesFromSize } from './size';
import type { ViewportSize } from './size';

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';
export type SsrHint = 'cookie' | 'user-agent';

export const VIEWPORT_COOKIE = 'responsive-viewport';

export const DEFAULT_SSR_DEVICES: Record<DeviceClass, ViewportSize> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1440, height: 900 },
};

const TABLET_PATTERN = /iPad|Tablet|PlayBook|Silk|Kindle|Android(?!.*Mobile)/i;
const MOBILE_PATTERN = /Mobi|iPhone|iPod|Windows Phone|BlackBerry/i;
const COOKIE_PATTERN = /^(\d{2,5})x(\d{2,5})$/;

export function detectDevice(userAgent?: string | null): DeviceClass | null {
  if (!userAgent) return null;
  if (TABLET_PATTERN.test(userAgent)) return 'tablet';
  if (MOBILE_PATTERN.test(userAgent)) return 'mobile';
  return 'desktop';
}

export function serializeViewportCookie(size: ViewportSize): string {
  return `${Math.round(size.width)}x${Math.round(size.height)}`;
}

export function parseViewportCookie(value?: string | null): ViewportSize | null {
  const match = COOKIE_PATTERN.exec(value ?? '');
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

export interface SsrHintInput {
  cookie?: string | null;
  userAgent?: string | null;
}

export interface ResolveSsrStateOptions {
  hints?: SsrHint[];
  devices?: Partial<Record<DeviceClass, ViewportSize>>;
  fallback?: Record<string, boolean>;
}

export function resolveSsrState(
  config: Record<string, MediaQueryConfig>,
  input: SsrHintInput,
  options: ResolveSsrStateOptions = {},
): ResponsiveState {
  const hints = options.hints ?? ['cookie', 'user-agent'];
  const devices = { ...DEFAULT_SSR_DEVICES, ...options.devices };

  for (const hint of hints) {
    if (hint === 'cookie') {
      const size = parseViewportCookie(input.cookie);
      if (size) return statesFromSize(config, size);
    } else if (hint === 'user-agent') {
      const device = detectDevice(input.userAgent);
      if (device) return statesFromSize(config, devices[device]);
    }
  }

  return Object.keys(config).reduce<ResponsiveState>((acc, key) => {
    acc[key] = options.fallback?.[key] ?? false;
    return acc;
  }, {});
}
