import type { ViewportSize } from './size';

export interface ViewportMockOptions {
  width?: number;
  height?: number;
  features?: Record<string, string>;
}

export interface ViewportMock {
  install(): void;
  uninstall(): void;
  setViewport(size: Partial<ViewportSize>): void;
  setFeature(name: string, value: string): void;
  getViewport(): ViewportSize;
}

const DEFAULT_FEATURES: Record<string, string> = {
  'prefers-color-scheme': 'light',
  'prefers-reduced-motion': 'no-preference',
  'prefers-contrast': 'no-preference',
  hover: 'hover',
  'any-hover': 'hover',
  pointer: 'fine',
  'any-pointer': 'fine',
  'forced-colors': 'none',
  'display-mode': 'browser',
  update: 'fast',
  scan: 'progressive',
  grid: '0',
  resolution: '1dppx',
  'media-type': 'screen',
};

const RANGE_OPERATORS = ['<=', '>=', '<', '>', '='];

interface Context {
  size: ViewportSize;
  features: Record<string, string>;
}

function toNumber(value: string): number {
  const trimmed = value.trim();
  if (trimmed.includes('/')) {
    const [a, b] = trimmed.split('/').map(Number);
    return b ? a / b : NaN;
  }
  if (/dpi$/.test(trimmed)) return parseFloat(trimmed) / 96;
  if (/dpcm$/.test(trimmed)) return (parseFloat(trimmed) * 2.54) / 96;
  return parseFloat(trimmed);
}

function numericFeature(name: string, ctx: Context): number | null {
  switch (name) {
    case 'width':
      return ctx.size.width;
    case 'height':
      return ctx.size.height;
    case 'aspect-ratio':
      return ctx.size.height ? ctx.size.width / ctx.size.height : null;
    case 'resolution':
      return toNumber(ctx.features.resolution ?? '1dppx');
    default:
      return null;
  }
}

function compare(left: number, operator: string, right: number): boolean {
  switch (operator) {
    case '<=':
      return left <= right;
    case '>=':
      return left >= right;
    case '<':
      return left < right;
    case '>':
      return left > right;
    default:
      return left === right;
  }
}

function evaluateFeature(inner: string, ctx: Context): boolean {
  const text = inner.trim();

  const range = new RegExp(`^(.+?)\\s*(${RANGE_OPERATORS.join('|')})\\s*(.+?)(?:\\s*(${RANGE_OPERATORS.join('|')})\\s*(.+))?$`).exec(text);
  if (range && !text.includes(':')) {
    const [, a, op1, b, op2, c] = range;
    const flip = (op: string) => ({ '<=': '>=', '>=': '<=', '<': '>', '>': '<', '=': '=' })[op] as string;
    if (op2 !== undefined && c !== undefined) {
      const actual = numericFeature(b.trim(), ctx);
      if (actual === null) return false;
      return compare(toNumber(a), op1, actual) && compare(actual, op2, toNumber(c));
    }
    const left = numericFeature(a.trim(), ctx);
    if (left !== null) return compare(left, op1, toNumber(b));
    const right = numericFeature(b.trim(), ctx);
    if (right !== null) return compare(right, flip(op1), toNumber(a));
    return false;
  }

  const colon = text.indexOf(':');
  if (colon === -1) {
    const value = ctx.features[text];
    if (value !== undefined) return value !== 'none' && value !== '0' && value !== 'no-preference';
    const numeric = numericFeature(text, ctx);
    return numeric !== null && numeric !== 0;
  }

  const rawName = text.slice(0, colon).trim();
  const value = text.slice(colon + 1).trim();
  const prefix = rawName.startsWith('min-') ? 'min' : rawName.startsWith('max-') ? 'max' : null;
  const name = prefix ? rawName.slice(4) : rawName;

  if (name === 'orientation') {
    return value === (ctx.size.height >= ctx.size.width ? 'portrait' : 'landscape');
  }

  const actual = numericFeature(name, ctx);
  if (actual !== null) {
    const target = toNumber(value);
    if (prefix === 'min') return actual >= target;
    if (prefix === 'max') return actual <= target;
    return actual === target;
  }

  return ctx.features[name] === value;
}

function evaluateGroup(group: string, ctx: Context): boolean {
  let text = group.trim();
  let negate = false;
  if (/^not\s/i.test(text)) {
    negate = true;
    text = text.replace(/^not\s+/i, '');
  }
  text = text.replace(/^only\s+/i, '');

  const parts = text.split(/\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
  const result = parts.every((part) => {
    if (part.startsWith('(')) return evaluateFeature(part.replace(/^\(|\)$/g, ''), ctx);
    if (part === 'all') return true;
    return ctx.features['media-type'] === part;
  });
  return negate ? !result : result;
}

export function evaluateMediaQuery(query: string, size: ViewportSize, features: Record<string, string> = {}): boolean {
  const ctx: Context = { size, features: { ...DEFAULT_FEATURES, ...features } };
  return query.split(',').some((group) => evaluateGroup(group, ctx));
}

interface Entry {
  query: string;
  matches: boolean;
  listeners: Set<(event: { matches: boolean; media: string }) => void>;
  onchange: ((event: { matches: boolean; media: string }) => void) | null;
}

export function createViewportMock(options: ViewportMockOptions = {}): ViewportMock {
  const initialSize: ViewportSize = { width: options.width ?? 1280, height: options.height ?? 800 };
  const initialFeatures: Record<string, string> = { ...options.features };
  const size: ViewportSize = { ...initialSize };
  const features: Record<string, string> = { ...initialFeatures };
  const entries = new Set<Entry>();
  let installed = false;
  let originalMatchMedia: unknown;
  let hadMatchMedia = false;
  let originalWidth = 0;
  let originalHeight = 0;

  function evaluate(query: string): boolean {
    return evaluateMediaQuery(query, size, features);
  }

  function refresh(): void {
    entries.forEach((entry) => {
      const next = evaluate(entry.query);
      if (next === entry.matches) return;
      entry.matches = next;
      const event = { matches: next, media: entry.query };
      entry.listeners.forEach((listener) => listener(event));
      entry.onchange?.(event);
    });
  }

  function matchMedia(query: string): MediaQueryList {
    const entry: Entry = { query, matches: evaluate(query), listeners: new Set(), onchange: null };
    entries.add(entry);
    const list = {
      get matches() {
        return entry.matches;
      },
      get media() {
        return entry.query;
      },
      get onchange() {
        return entry.onchange;
      },
      set onchange(handler) {
        entry.onchange = handler as Entry['onchange'];
      },
      addEventListener(type: string, listener: Entry['listeners'] extends Set<infer L> ? L : never) {
        if (type === 'change') entry.listeners.add(listener);
      },
      removeEventListener(type: string, listener: Entry['listeners'] extends Set<infer L> ? L : never) {
        if (type === 'change') entry.listeners.delete(listener);
      },
      addListener(listener: Entry['listeners'] extends Set<infer L> ? L : never) {
        entry.listeners.add(listener);
      },
      removeListener(listener: Entry['listeners'] extends Set<infer L> ? L : never) {
        entry.listeners.delete(listener);
      },
      dispatchEvent: () => false,
    };
    return list as unknown as MediaQueryList;
  }

  return {
    install() {
      if (installed) return;
      installed = true;
      hadMatchMedia = 'matchMedia' in window && typeof window.matchMedia === 'function';
      originalMatchMedia = window.matchMedia;
      originalWidth = window.innerWidth;
      originalHeight = window.innerHeight;
      Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: matchMedia });
      window.innerWidth = size.width;
      window.innerHeight = size.height;
    },

    uninstall() {
      if (!installed) return;
      installed = false;
      entries.clear();
      size.width = initialSize.width;
      size.height = initialSize.height;
      Object.keys(features).forEach((key) => delete features[key]);
      Object.assign(features, initialFeatures);
      if (hadMatchMedia) {
        Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: originalMatchMedia });
      } else {
        delete (window as { matchMedia?: unknown }).matchMedia;
      }
      window.innerWidth = originalWidth;
      window.innerHeight = originalHeight;
    },

    setViewport(next) {
      if (next.width !== undefined) size.width = next.width;
      if (next.height !== undefined) size.height = next.height;
      if (installed) {
        window.innerWidth = size.width;
        window.innerHeight = size.height;
      }
      refresh();
      if (installed) window.dispatchEvent(new Event('resize'));
    },

    setFeature(name, value) {
      features[name] = value;
      refresh();
    },

    getViewport() {
      return { ...size };
    },
  };
}
