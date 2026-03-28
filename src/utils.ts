export const isSSR          = (): boolean => typeof window === 'undefined';
export const hasMatchMedia  = (): boolean => !isSSR() && typeof window.matchMedia === 'function';
export const hasResizeObserver = (): boolean => !isSSR() && typeof ResizeObserver === 'function';
