export const isSSR = () => typeof window === 'undefined';
export const hasMatchMedia = () => !isSSR() && typeof window.matchMedia === 'function';
export const hasResizeObserver = () => !isSSR() && typeof ResizeObserver === 'function';
