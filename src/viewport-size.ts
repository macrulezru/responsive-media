import { isSSR } from './utils';
import type { ViewportSize } from './size';

export interface SubscribeViewportSizeOptions {
  throttle?: number;
}

export function getViewportSize(): ViewportSize {
  if (isSSR()) return { width: 0, height: 0 };
  return { width: window.innerWidth, height: window.innerHeight };
}

export function subscribeViewportSize(
  callback: (size: ViewportSize) => void,
  options: SubscribeViewportSizeOptions = {},
): () => void {
  if (isSSR()) {
    callback({ width: 0, height: 0 });
    return () => {};
  }

  const wait = options.throttle ?? 100;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = 0;

  const emit = () => {
    timer = null;
    last = Date.now();
    callback(getViewportSize());
  };

  const handler = () => {
    if (wait <= 0) {
      emit();
      return;
    }
    const remaining = wait - (Date.now() - last);
    if (remaining <= 0) {
      if (timer !== null) clearTimeout(timer);
      emit();
    } else if (timer === null) {
      timer = setTimeout(emit, remaining);
    }
  };

  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', handler);
  callback(getViewportSize());

  return () => {
    window.removeEventListener('resize', handler);
    window.removeEventListener('orientationchange', handler);
    if (timer !== null) clearTimeout(timer);
  };
}
