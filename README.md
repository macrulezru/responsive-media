<div align="center" style="background:#111827;border-radius:20px;padding:28px 20px 20px;margin-bottom:32px">
  <h1 style="color:#f9fafb;margin:0 0 32px;font-size:2.2em;letter-spacing:-0.03em;font-weight:700;font-family:sans-serif">
    responsive-media
  </h1>
  <img
    src="https://s3.twcstorage.ru/c9a2cc89-780f97fd-311d-4a1a-b86f-c25665c9dc46/images/npm/responsive-media.webp"
    alt="responsive-media"
    style="max-width:100%;width:auto;height:300px;border-radius:12px"
  />
</div>

Reactive boolean state from CSS media queries and element dimensions for Vanilla JS, Vue 3, and React 18+ — AND/OR conditions, container queries, ordered breakpoint helpers, rich subscription API, CSS vars sync, SSR-safe — with no required peer dependencies.

---

## Contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Config format — MediaQueryConfig](#config-format--mediaqueryconfig)
- [Global singleton](#global-singleton)
- [createResponsiveState — isolated instances](#createresponsivestate--isolated-instances)
- [ContainerState — element container queries](#containerstate--element-container-queries)
- [Subscription API](#subscription-api)
- [Ordered breakpoint helpers](#ordered-breakpoint-helpers)
- [Utilities](#utilities)
- [Presets](#presets)
- [Vue 3 integration](#vue-3-integration)
- [React 18+ integration](#react-18-integration)
- [TypeScript helpers](#typescript-helpers)
- [SSR / hydration](#ssr--hydration)
- [Architecture](#architecture)
- [Bundle size & peer dependencies](#bundle-size--peer-dependencies)
- [Exported API reference](#exported-api-reference)

---

## Features

- **Framework-agnostic core** — `ReactiveResponsiveState` and `ContainerState` work with Vanilla JS, any signals library, or any framework; Vue and React are optional peer dependencies
- **Viewport breakpoints** — backed by `window.matchMedia`; conditions combined with AND (flat array) or OR (nested array); raw media type support for `print`, `screen`, etc.
- **Full condition vocabulary** — `min/max-width`, `min/max-height`, `orientation`, `aspect-ratio`, `prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`, `hover`, `pointer`, `forced-colors`, `resolution`, `display-mode`, and `raw`
- **Container queries (JS-side)** — `ContainerState` tracks an element's dimensions via `ResizeObserver` and evaluates breakpoint conditions in JavaScript; identical API to viewport state
- **Rich subscription API** — `subscribe`, `on`, `onEnter`, `onLeave`, `once`, `onNextChange`, `onBreakpointChange`, `waitFor`; optional debounce for `subscribe`; per-key listeners are never debounced
- **Ordered breakpoint helpers** — `current`, `isAbove()`, `isBelow()`, `between()` for semantic viewport comparisons; order derived from config key insertion or explicit `order` option
- **Utilities** — `syncCSSVars` (CSS custom properties), `emitDOMEvents` (DOM CustomEvents), `toSignal` (any signals library — Preact, Angular, SolidJS, Vue), `match` (pick value by first active breakpoint), `subscribeMediaQuery` (raw single query)
- **Vue 3 adapter** — `useResponsive`, `useBreakpoints`, `useMediaQuery`, `useContainerState`; fully reactive in templates and `computed`; `ResponsivePlugin` for global config
- **React 18+ adapter** — same four hooks; `useSyncExternalStore` for safe concurrent rendering; SSR-safe (`false` on server)
- **Presets** — `TailwindPreset`, `BootstrapPreset`, `AccessibilityPreset` out of the box; user-preference queries (`dark`, `reducedMotion`, `highContrast`, `print`, …)
- **SSR-safe** — all APIs check for `window` / `matchMedia` / `ResizeObserver` before use; `hydrate()` prevents layout shift on the client
- **TypeScript** — full generics; `ConfigToState<T>` infers a boolean-state type from any config object

---

## Installation

```bash
npm install responsive-media
```

No required peer dependencies. Vue and React adapters are available automatically when the respective package is installed:

```bash
npm install vue@>=3.3     # for Vue composables
npm install react@>=18    # for React hooks
```

---

## Quick start

```ts
import { responsiveState, setResponsiveConfig } from 'responsive-media';

setResponsiveConfig({
  mobile:  [{ type: 'max-width',  value: 767 }],
  tablet:  [{ type: 'min-width',  value: 768 }, { type: 'max-width', value: 1023 }],
  desktop: [{ type: 'min-width',  value: 1024 }],
});

// Read current state
console.log(responsiveState.proxy.mobile);   // true / false

// Subscribe to changes
const stop = responsiveState.subscribe((state) => {
  console.log('desktop:', state.desktop);
});

// Cleanup
stop();
```

---

## Config format — MediaQueryConfig

Each breakpoint is described by a `MediaQueryConfig` — an array of conditions combined with **AND**, or a nested array of groups combined with **OR**.

### AND (flat array)

```ts
// (min-width: 768px) and (max-width: 1023px)
[
  { type: 'min-width', value: 768 },
  { type: 'max-width', value: 1023 },
]
```

### OR (nested array)

```ts
// (max-width: 600px), (orientation: portrait) and (max-width: 1024px)
[
  [{ type: 'max-width', value: 600 }],
  [{ type: 'orientation', value: 'portrait' }, { type: 'max-width', value: 1024 }],
]
```

### Raw media type

Use `type: 'raw'` to insert a value verbatim — useful for media types like `print` or `screen`:

```ts
// Matches 'print' media type
[{ type: 'raw', value: 'print' }]

// screen and (max-width: 600px)
[{ type: 'raw', value: 'screen' }, { type: 'max-width', value: 600 }]
```

### Supported condition types

| `type`                   | Example value  | Generated query                    |
|--------------------------|----------------|------------------------------------|
| `min-width`              | `768`          | `(min-width: 768px)`               |
| `max-width`              | `1023`         | `(max-width: 1023px)`              |
| `min-height`             | `600`          | `(min-height: 600px)`              |
| `max-height`             | `900`          | `(max-height: 900px)`              |
| `orientation`            | `'portrait'`   | `(orientation: portrait)`          |
| `aspect-ratio`           | `'16/9'`       | `(aspect-ratio: 16/9)`             |
| `prefers-color-scheme`   | `'dark'`       | `(prefers-color-scheme: dark)`     |
| `prefers-reduced-motion` | `'reduce'`     | `(prefers-reduced-motion: reduce)` |
| `prefers-contrast`       | `'more'`       | `(prefers-contrast: more)`         |
| `hover`                  | `'none'`       | `(hover: none)`                    |
| `pointer`                | `'coarse'`     | `(pointer: coarse)`                |
| `forced-colors`          | `'active'`     | `(forced-colors: active)`          |
| `resolution`             | `'2dppx'`      | `(resolution: 2dppx)`              |
| `display-mode`           | `'standalone'` | `(display-mode: standalone)`       |
| `raw`                    | `'print'`      | `print` *(verbatim)*               |

---

## Global singleton

The library exports a pre-configured singleton `responsiveState` initialized with the default `ResponsiveConfig` (mobile / tablet / desktop).

```ts
import { responsiveState, setResponsiveConfig, getResponsiveMediaQueries } from 'responsive-media';

// Re-configure the singleton
setResponsiveConfig(
  {
    sm: [{ type: 'max-width', value: 767 }],
    lg: [{ type: 'min-width', value: 1024 }],
  },
  {
    order:    ['sm', 'lg'],  // for isAbove / isBelow / between
    debounce: 50,            // ms — throttle subscribe() listeners
  }
);

// Read a stable snapshot
const { sm, lg } = responsiveState.getState();

// Live proxy access (never debounced)
console.log(responsiveState.proxy.sm);

// Get the generated CSS strings
const mq = getResponsiveMediaQueries();
// { sm: '(max-width: 767px)', lg: '(min-width: 1024px)' }
```

### Default config (`ResponsiveConfig`)

| Key       | Range        |
|-----------|--------------|
| `mobile`  | ≤ 600px      |
| `tablet`  | 601 – 960px  |
| `desktop` | ≥ 961px      |

---

## createResponsiveState — isolated instances

Create independent instances — useful for per-request SSR, multiple independent contexts, or testing:

```ts
import { createResponsiveState, TailwindPreset, TailwindOrder } from 'responsive-media';

const layoutState = createResponsiveState(TailwindPreset, {
  order: [...TailwindOrder],
});

const themeState = createResponsiveState({
  dark:          [{ type: 'prefers-color-scheme', value: 'dark' }],
  reducedMotion: [{ type: 'prefers-reduced-motion', value: 'reduce' }],
});

layoutState.subscribe((s) => console.log('layout:', s));
themeState.subscribe((s) => console.log('theme:', s));

// Cleanup when done (e.g. per-request SSR)
layoutState.destroy();
```

---

## ContainerState — element container queries

`ContainerState` tracks an **element's dimensions** via `ResizeObserver` and evaluates breakpoint conditions in JavaScript — the same concept as CSS Container Queries, but in JS.

The API is identical to `ReactiveResponsiveState` — all subscription methods work the same way.

```ts
import { createContainerState } from 'responsive-media/container';
// or: import { createContainerState } from 'responsive-media';

const card = document.querySelector('.card')!;

const cardState = createContainerState(card, {
  compact: [{ type: 'max-width', value: 300 }],
  normal:  [{ type: 'min-width', value: 301 }, { type: 'max-width', value: 599 }],
  wide:    [{ type: 'min-width', value: 600 }],
}, {
  order: ['compact', 'normal', 'wide'],
});

// Reactive class toggling
cardState.on('compact', (v) => card.classList.toggle('card--compact', v));

// Sync CSS custom properties: --card-compact: 1; --card-wide: 0; …
cardState.syncCSSVars({ prefix: '--card-' });

// Get @container-compatible query strings
const strings = cardState.getMediaQueries();
// { compact: '(max-width: 300px)', wide: '(min-width: 600px)' }

// Cleanup
cardState.destroy();
```

### Supported condition types for ContainerState

`max-width`, `min-width`, `max-height`, `min-height`, `orientation`, `aspect-ratio`

---

## Subscription API

All methods below are available on both `ReactiveResponsiveState` and `ContainerState`.

### `subscribe(listener)` → unsubscribe

Fires immediately with the current state, then on every change. Affected by `debounce`.

```ts
const stop = state.subscribe((s) => {
  document.body.dataset.bp = Object.keys(s).filter(k => s[k]).join(' ');
});
stop(); // unsubscribe
```

### `on(key, callback)` → unsubscribe

Fires immediately with the current value for `key`, then on every change. **Never debounced.**

```ts
const off = state.on('mobile', (matches) => {
  header.classList.toggle('header--mobile', matches);
});
off();
```

### `onEnter(key, callback)` → unsubscribe

Fires only on `false → true` transitions. Skips the initial value. **Never debounced.**

```ts
state.onEnter('mobile', () => initMobileMenu());
```

### `onLeave(key, callback)` → unsubscribe

Fires only on `true → false` transitions. Skips the initial value. **Never debounced.**

```ts
state.onLeave('mobile', () => destroyMobileMenu());
```

### `once(key, callback)` → unsubscribe

Fires on the **next change** to `key`, then auto-unsubscribes. Does not fire for the current value. **Never debounced.**

```ts
state.once('mobile', (matches) => {
  console.log('mobile changed to:', matches);
});
```

### `onNextChange(callback)` → unsubscribe

Fires on the **next global state change**, then auto-unsubscribes. Affected by `debounce`.

```ts
state.onNextChange((s) => console.log('first change:', s));
```

### `onBreakpointChange(callback)` → unsubscribe

Fires when the **active breakpoint** changes (i.e. `current` changes), providing `from` and `to`. Affected by `debounce`.

```ts
state.onBreakpointChange((from, to) => {
  console.log(`breakpoint: ${from} → ${to}`);
});
```

### `waitFor(key, expectedValue?)` → Promise

Returns a `Promise` that resolves when `key` reaches `expectedValue` (default `true`). Resolves immediately if already met. **Never debounced.**

```ts
await state.waitFor('desktop');
initDesktopChart();

// Wait for mobile to become false
await state.waitFor('mobile', false);
```

---

## Ordered breakpoint helpers

These helpers require a breakpoint `order` — either set via `setConfig` / `createResponsiveState` options, or derived from config key insertion order.

### `state.current` — getter

Returns the first active breakpoint key in order, or `null`.

```ts
if (state.current === 'mobile') showDrawer();
```

### `state.isAbove(key)` → boolean

`true` when the current breakpoint comes **after** `key` in the order.

```ts
// order: ['xs', 'sm', 'md', 'lg', 'xl']
// current = 'lg'
state.isAbove('sm')  // → true
state.isAbove('xl')  // → false
```

### `state.isBelow(key)` → boolean

`true` when the current breakpoint comes **before** `key` in the order.

```ts
state.isBelow('md')  // → true  (current = 'sm')
```

### `state.between(from, to)` → boolean

`true` when the current breakpoint is between `from` and `to` (inclusive).

```ts
state.between('sm', 'lg')  // → true  (current = 'md')
```

---

## Utilities

### `syncCSSVars(options?)` → stop

Syncs all breakpoint keys to CSS custom properties (`1` / `0`) on `document.documentElement` (or a custom element). Automatically removes properties for keys removed during a config change.

```ts
const stop = state.syncCSSVars({ element: document.body, prefix: '--bp-' });
// → --bp-mobile: 1; --bp-desktop: 0; …
stop(); // cleanup
```

| Option    | Default                    | Description                      |
|-----------|----------------------------|----------------------------------|
| `element` | `document.documentElement` | Target HTML element              |
| `prefix`  | `'--responsive-'`          | CSS custom property name prefix  |

### `emitDOMEvents(target?, options?)` → stop

Dispatches DOM `CustomEvent`s on `target` whenever breakpoints change:

- `responsive:change` — fires on any state change; `event.detail` is the full state snapshot
- `responsive:mobile:enter` — fires when `mobile` becomes `true`
- `responsive:mobile:leave` — fires when `mobile` becomes `false`

```ts
const stop = state.emitDOMEvents(document, { prefix: 'bp:' });

document.addEventListener('bp:change', (e) => console.log(e.detail));
document.addEventListener('bp:mobile:enter', () => initDrawer());
document.addEventListener('bp:desktop:leave', () => destroyDesktopChart());

stop();
```

| Option   | Default         | Description              |
|----------|-----------------|--------------------------|
| `prefix` | `'responsive:'` | Custom event name prefix |

### `toSignal(key, factory)` → Signal

Binds a breakpoint key to a writable signal from any signals library. The signal is kept in sync via `on()`.

```ts
// @preact/signals-core
import { signal } from '@preact/signals-core';
const isMobile = state.toSignal('mobile', signal);
isMobile.value; // reactive boolean

// Angular signal
import { signal } from '@angular/core';
const isMobile = state.toSignal('mobile', signal);

// Vue ref
import { ref } from 'vue';
const isMobile = state.toSignal('mobile', ref);
```

### `getMediaQueries()` → Record\<string, string\>

Returns the generated CSS media query strings for each breakpoint key.

```ts
const mq = state.getMediaQueries();
// { mobile: '(max-width: 600px)', desktop: '(min-width: 961px)' }
```

### `getState<T>()` → T

Returns a stable snapshot of the current state. Same reference between changes — safe for React's `useSyncExternalStore`.

### `getOrder()` → string[]

Returns the configured breakpoint order array (or empty array if not set).

### `hydrate(initialState)` — SSR hydration

Sets initial state from a server-side snapshot to prevent layout shift. Only updates keys that exist in the current config.

```ts
state.hydrate({ mobile: false, tablet: false, desktop: true });
```

### `destroy()`

Removes all `matchMedia` / `ResizeObserver` listeners, clears all subscribers, and cancels any pending debounce timer.

### `toMediaQueryString(conditions)` — standalone utility

Converts a `MediaQueryConfig` to a CSS media query string. Useful for CSS-in-JS or debugging.

```ts
import { toMediaQueryString } from 'responsive-media';

toMediaQueryString([{ type: 'min-width', value: 768 }, { type: 'max-width', value: 1024 }])
// → "(min-width: 768px) and (max-width: 1024px)"

toMediaQueryString([[{ type: 'max-width', value: 600 }], [{ type: 'orientation', value: 'portrait' }]])
// → "(max-width: 600px), (orientation: portrait)"
```

### `match(state, map, fallback?)` — standalone utility

Returns the first value in `map` whose key is `true` in `state`. Priority follows `map` insertion order.

```ts
import { match } from 'responsive-media';
import { responsiveState } from 'responsive-media';

const cols  = match(responsiveState.proxy, { mobile: 1, tablet: 2, desktop: 4 });
const View  = match(responsiveState.proxy, { mobile: MobileMenu, desktop: DesktopNav });
const label = match(responsiveState.proxy, { sm: 'Compact', lg: 'Full' }, 'Default');
```

### `subscribeMediaQuery(query, callback)` — standalone utility

Low-level reactive wrapper around a single raw CSS media query string. Framework-agnostic — the Vue and React adapters use this internally.

```ts
import { subscribeMediaQuery } from 'responsive-media';

const off = subscribeMediaQuery('(prefers-color-scheme: dark)', (matches) => {
  document.body.classList.toggle('dark', matches);
});
off(); // cleanup
```

---

## Presets

Import from `responsive-media/presets` or from the main entry point.

### `ResponsiveConfig` (default)

| Key       | Range        |
|-----------|--------------|
| `mobile`  | ≤ 600px      |
| `tablet`  | 601 – 960px  |
| `desktop` | ≥ 961px      |

### `TailwindPreset` + `TailwindOrder`

Mutually exclusive Tailwind CSS v3/v4 breakpoints:

| Key   | Range         |
|-------|---------------|
| `xs`  | ≤ 639px       |
| `sm`  | 640 – 767px   |
| `md`  | 768 – 1023px  |
| `lg`  | 1024 – 1279px |
| `xl`  | 1280 – 1535px |
| `2xl` | ≥ 1536px      |

```ts
import { createResponsiveState, TailwindPreset, TailwindOrder } from 'responsive-media';

const state = createResponsiveState(TailwindPreset, { order: [...TailwindOrder] });
```

### `BootstrapPreset` + `BootstrapOrder`

Mutually exclusive Bootstrap 5 breakpoints:

| Key   | Range          |
|-------|----------------|
| `xs`  | ≤ 575px        |
| `sm`  | 576 – 767px    |
| `md`  | 768 – 991px    |
| `lg`  | 992 – 1199px   |
| `xl`  | 1200 – 1399px  |
| `xxl` | ≥ 1400px       |

```ts
import { createResponsiveState, BootstrapPreset, BootstrapOrder } from 'responsive-media';

const state = createResponsiveState(BootstrapPreset, { order: [...BootstrapOrder] });
```

### `AccessibilityPreset`

User-preference media queries. Multiple keys can be `true` simultaneously.

| Key             | Matches when …                         |
|-----------------|----------------------------------------|
| `dark`          | `prefers-color-scheme: dark`           |
| `light`         | `prefers-color-scheme: light`          |
| `reducedMotion` | `prefers-reduced-motion: reduce`       |
| `highContrast`  | `prefers-contrast: more`               |
| `lowContrast`   | `prefers-contrast: less`               |
| `noHover`       | `hover: none` (touch / stylus devices) |
| `coarsePointer` | `pointer: coarse` (finger-sized input) |
| `forcedColors`  | `forced-colors: active` (Windows HCM) |
| `print`         | `print` media type                     |

```ts
import { createResponsiveState, AccessibilityPreset } from 'responsive-media';

const a11y = createResponsiveState(AccessibilityPreset);

a11y.onEnter('dark',          () => applyDarkTheme());
a11y.onEnter('reducedMotion', () => disableAnimations());
a11y.onEnter('print',         () => hideNonPrintable());
```

---

## Vue 3 integration

Vue composables are included in the main bundle and are activated when Vue is installed as a peer dependency.

### Plugin registration

```ts
import { createApp } from 'vue';
import { ResponsivePlugin } from 'responsive-media';

const app = createApp(App);

app.use(ResponsivePlugin, {
  sm: [{ type: 'max-width', value: 767 }],
  lg: [{ type: 'min-width', value: 1024 }],
});

app.mount('#app');
```

### `useResponsive<T>()` — reactive state object

Returns the Vue reactive responsive state. Reactive in templates and computed properties.

```vue
<script setup lang="ts">
import { useResponsive } from 'responsive-media';

type MyState = { sm: boolean; lg: boolean };
const state = useResponsive<MyState>();
</script>

<template>
  <MobileNav v-if="state.sm" />
  <DesktopNav v-else />
</template>
```

### `useBreakpoints()` — ordered helpers

Returns reactive ordered breakpoint helpers. All methods react to viewport changes in templates.

```vue
<script setup>
import { useBreakpoints } from 'responsive-media';

const { current, isAbove, isBelow, between } = useBreakpoints();
</script>

<template>
  <span>Current: {{ current }}</span>
  <DesktopNav v-if="isAbove('sm')" />
  <MobileNav  v-else />
  <TabletOnly v-if="between('sm', 'lg')" />
</template>
```

> `current` is a `ComputedRef<string | null>`. `isAbove`, `isBelow`, `between` are plain functions — reactive because they read from the Vue reactive state.

### `useMediaQuery(query)` — single raw query

Returns a `Ref<boolean>` for a raw CSS media query string. Cleans up automatically on `onUnmounted`.

```vue
<script setup>
import { useMediaQuery } from 'responsive-media';

const isDark   = useMediaQuery('(prefers-color-scheme: dark)');
const canHover = useMediaQuery('(hover: hover)');
</script>

<template>
  <DarkTheme v-if="isDark" />
</template>
```

### `useContainerState(elementRef, config, options?)` — container queries

Tracks an element's dimensions and returns a reactive state object. Sets up and tears down the `ResizeObserver` automatically via `watchEffect`.

```vue
<script setup>
import { useTemplateRef } from 'vue';
import { useContainerState } from 'responsive-media';

const cardRef   = useTemplateRef('card');
const cardState = useContainerState(cardRef, {
  compact: [{ type: 'max-width', value: 300 }],
  wide:    [{ type: 'min-width', value: 600 }],
});
</script>

<template>
  <div ref="card">
    <CompactLayout v-if="cardState.compact" />
    <WideLayout    v-else-if="cardState.wide" />
    <DefaultLayout v-else />
  </div>
</template>
```

---

## React 18+ integration

Import from `responsive-media/react`.

```ts
import { useResponsive, useBreakpoints, useMediaQuery, useContainerState } from 'responsive-media/react';
```

### `useResponsive<T>()` — reactive state

Returns the current responsive state. Re-renders only when state changes. Uses `useSyncExternalStore` internally.

```tsx
import { useResponsive } from 'responsive-media/react';

type MyState = { sm: boolean; lg: boolean };

function App() {
  const { sm, lg } = useResponsive<MyState>();
  return sm ? <MobileNav /> : <DesktopNav />;
}
```

### `useBreakpoints()` — ordered helpers

Returns ordered breakpoint helpers. Re-renders when the responsive state changes.

```tsx
import { useBreakpoints } from 'responsive-media/react';

function Nav() {
  const { current, isAbove, isBelow, between } = useBreakpoints();
  return (
    <>
      <span>Current: {current}</span>
      {isAbove('sm') ? <DesktopNav /> : <MobileNav />}
      {between('sm', 'lg') && <TabletBanner />}
    </>
  );
}
```

> Unlike Vue, `current` is a plain `string | null` (not a ref). Re-renders are triggered by `useSyncExternalStore`.

### `useMediaQuery(query)` — single raw query

Returns a `boolean` that tracks a raw CSS media query string. SSR-safe (returns `false` on the server).

```tsx
import { useMediaQuery } from 'responsive-media/react';

function ThemeToggle() {
  const isDark   = useMediaQuery('(prefers-color-scheme: dark)');
  const canHover = useMediaQuery('(hover: hover)');
  return <button className={isDark ? 'dark' : 'light'}>Toggle</button>;
}
```

### `useContainerState(ref, config, options?)` — container queries

Tracks an element's dimensions and returns a state object. Sets up and tears down `ResizeObserver` via `useEffect`.

```tsx
import { useRef } from 'react';
import { useContainerState } from 'responsive-media/react';

function Card() {
  const ref = useRef<HTMLDivElement>(null);
  const { compact, wide } = useContainerState(ref, {
    compact: [{ type: 'max-width', value: 300 }],
    wide:    [{ type: 'min-width', value: 600 }],
  });

  return (
    <div ref={ref}>
      {compact ? <CompactLayout /> : wide ? <WideLayout /> : <DefaultLayout />}
    </div>
  );
}
```

> `config` and `options` are treated as static after mount. Wrap in `useMemo` if they change.

---

## TypeScript helpers

### `ConfigToState<T>`

Derives a boolean-state type from a config object:

```ts
import type { ConfigToState, MediaQueryConfig } from 'responsive-media';

const config = {
  sm: [{ type: 'min-width', value: 640 }],
  lg: [{ type: 'min-width', value: 1024 }],
} satisfies Record<string, MediaQueryConfig>;

type MyState = ConfigToState<typeof config>;
// → { sm: boolean; lg: boolean }

const { sm, lg } = responsiveState.getState<MyState>();
```

### Generic `useResponsive<T>()`

Both Vue and React adapters accept a generic type parameter to narrow the returned state:

```ts
type AppState = { mobile: boolean; tablet: boolean; desktop: boolean };
const state = useResponsive<AppState>();
```

---

## SSR / hydration

All APIs are SSR-safe — they check for `window`, `matchMedia`, and `ResizeObserver` availability before use and fall back to `false` on the server.

| Scenario | Behaviour |
|---|---|
| `typeof window === 'undefined'` | All listeners skip setup; `proxy` / `getState()` return `false` for all keys |
| `useCookie` on server (Nuxt) | Not applicable — use `useCookie` from `@vueuse/core` or Nuxt built-ins |
| React SSR | `useMediaQuery` returns `false`; `useResponsive` returns the server-side snapshot |
| Hydration mismatch | Call `hydrate()` with the server snapshot before first render |

```ts
// Server: serialize the expected initial state
const initialState = { mobile: false, tablet: false, desktop: true };

// Client: hydrate before the first render
import { responsiveState } from 'responsive-media';
responsiveState.hydrate(initialState);
```

---

## Architecture

```
responsive-media
│
├── BaseResponsiveState  (abstract)
│     Proxy over a plain Record<string, boolean>
│     Batched updates — all matchMedia/ResizeObserver callbacks collected
│     before a single notify() fires
│     Subscription registry: global listeners + per-key listeners
│     Debounce for subscribe(); key listeners never debounced
│     Ordered breakpoint helpers: current / isAbove / isBelow / between
│     Utilities: syncCSSVars / emitDOMEvents / toSignal / hydrate / destroy
│
├── ReactiveResponsiveState  extends BaseResponsiveState
│     setupSources()  → window.matchMedia per config key
│     Generated media query string stored in mediaQueries map
│     Batches all MediaQueryList 'change' events, then flushes
│     setConfig() / destroy() cleanupSources() removes matchMedia handlers
│
├── ContainerState  extends BaseResponsiveState
│     setupSources()  → single ResizeObserver on the target element
│     Evaluates width/height/orientation/aspect-ratio conditions in JS
│     Reconnects observer when config changes; teardown on destroy()
│
├── createResponsiveState(config, options)
│     Factory — returns a new ReactiveResponsiveState instance
│
├── responsiveState  (global singleton)
│     Pre-configured with default ResponsiveConfig (mobile/tablet/desktop)
│     setResponsiveConfig() / getResponsiveState() / getResponsiveMediaQueries()
│     delegate to this instance
│
├── toMediaQueryString(conditions)
│     Converts MediaQueryConfig → CSS string
│     AND: flat array → joined with ' and '
│     OR:  nested array → groups joined with ', '
│     Numeric values get 'px' suffix (except raw / orientation / …)
│
├── match(state, map, fallback?)
│     First-match lookup — returns mapped value for first true key in map
│
├── subscribeMediaQuery(query, callback)
│     Thin wrapper around window.matchMedia + addEventListener('change')
│     Returns cleanup function
│
├── Vue adapter  (vue-responsive.ts)
│     ResponsivePlugin  — app.use(); calls setResponsiveConfig
│     useResponsive()   — returns shallowReactive mirror; subscribe() syncs it
│     useBreakpoints()  — returns { current, isAbove, isBelow, between }
│                          all methods read from the reactive mirror
│     useMediaQuery()   — wraps subscribeMediaQuery in a ref + onUnmounted
│     useContainerState() — watchEffect over templateRef; creates/destroys
│                           ContainerState; returns shallowReactive mirror
│
├── React adapter  (react-responsive.ts)
│     useResponsive()     — useSyncExternalStore(subscribe, getState, getState)
│     useBreakpoints()    — useSyncExternalStore + wraps ordered helpers
│     useMediaQuery()     — useSyncExternalStore over subscribeMediaQuery
│     useContainerState() — useEffect creates ContainerState; useState mirror
│
└── Presets  (presets.ts)
      ResponsiveConfig     — default mobile/tablet/desktop
      TailwindPreset / TailwindOrder
      BootstrapPreset / BootstrapOrder
      AccessibilityPreset
```

---

## Bundle size & peer dependencies

| Entry point                 | Peer deps            | Notes |
|-----------------------------|----------------------|-------|
| `responsive-media`          | *(none required)*    | Core + Vue composables (tree-shaken when Vue absent) |
| `responsive-media/react`    | `react ^18`          | React hooks only |
| `responsive-media/presets`  | *(none)*             | Preset configs only — add to any instance |
| `responsive-media/container`| *(none)*             | `ContainerState` class + factory only |

The package ships as tree-shakeable ESM and CommonJS. Vue composables (`ResponsivePlugin`, `useResponsive`, etc.) are included in the main bundle but resolve to no-ops when Vue is not installed, so the core footprint stays minimal in non-Vue projects. The React entry point is code-split and never imported by the main bundle.

---

## Exported API reference

### Main entry (`responsive-media`)

| Export                     | Type                      | Description                                            |
|----------------------------|---------------------------|--------------------------------------------------------|
| `responsiveState`          | `ReactiveResponsiveState` | Global singleton, default `ResponsiveConfig`           |
| `setResponsiveConfig`      | function                  | Reconfigure the global singleton                       |
| `getResponsiveState`       | function                  | Get state snapshot from global singleton               |
| `getResponsiveMediaQueries`| function                  | Get CSS query strings from global singleton            |
| `createResponsiveState`    | function                  | Create an isolated `ReactiveResponsiveState` instance  |
| `createContainerState`     | function                  | Create a `ContainerState` for an element               |
| `toMediaQueryString`       | function                  | Convert `MediaQueryConfig` to CSS string               |
| `match`                    | function                  | Pick a value by first matching breakpoint key          |
| `subscribeMediaQuery`      | function                  | Subscribe to a raw CSS media query string              |
| `ResponsiveConfig`         | const                     | Default mobile / tablet / desktop breakpoints          |
| `BaseResponsiveState`      | class                     | Abstract base (for extension)                          |
| `ReactiveResponsiveState`  | class                     | Viewport state (`matchMedia`-backed)                   |
| `ContainerState`           | class                     | Element container state (`ResizeObserver`-backed)      |
| `ResponsivePlugin`         | Vue plugin                | Vue app plugin                                         |
| `useResponsive`            | Vue composable            | Reactive state object                                  |
| `useBreakpoints`           | Vue composable            | Ordered breakpoint helpers                             |
| `useMediaQuery`            | Vue composable            | Single raw media query                                 |
| `useContainerState`        | Vue composable            | Element container queries                              |
| `ConfigToState`            | type                      | Derives state type from config                         |
| `MediaQueryConfig`         | type                      | Config entry type                                      |
| `MediaQueryCondition`      | type                      | Single condition type                                  |
| `ResponsiveState`          | type                      | `Record<string, boolean>`                              |
| `SetConfigOptions`         | type                      | Options for `setConfig` / `createResponsiveState`      |
| `BreakpointHelpers`        | type                      | Return type of `useBreakpoints`                        |

### React entry (`responsive-media/react`)

| Export              | Description                                   |
|---------------------|-----------------------------------------------|
| `useResponsive`     | State hook (`useSyncExternalStore`)           |
| `useBreakpoints`    | Ordered breakpoint helpers hook               |
| `useMediaQuery`     | Single raw media query hook                   |
| `useContainerState` | Element container queries hook                |
| `BreakpointHelpers` | Type for `useBreakpoints` return value        |

### Presets entry (`responsive-media/presets`)

| Export                | Description                              |
|-----------------------|------------------------------------------|
| `TailwindPreset`      | Tailwind CSS v3/v4 breakpoints           |
| `TailwindOrder`       | Ordered key array for `TailwindPreset`   |
| `BootstrapPreset`     | Bootstrap 5 breakpoints                  |
| `BootstrapOrder`      | Ordered key array for `BootstrapPreset`  |
| `AccessibilityPreset` | User-preference media queries            |

### Container entry (`responsive-media/container`)

| Export                 | Description                              |
|------------------------|------------------------------------------|
| `ContainerState`       | Class for element container queries      |
| `createContainerState` | Factory function                         |

---

## License

MIT

---

## Author

Danil Lisin Vladimirovich aka Macrulez

GitHub: [macrulezru](https://github.com/macrulezru) · Website: [macrulez.ru/en](https://macrulez.ru/en)

Bugs and questions — [issues](https://github.com/macrulezru/responsive-media/issues)

---

## 💖 Support the project

Open source takes time and effort. If my work saves you time or brings value, consider supporting further development.

<a href="https://donate.cryptocloud.plus/M6O34NIN" target="_blank">
  <img src="https://img.shields.io/badge/Donate-CryptoCloud-8A2BE2?style=for-the-badge&logo=cryptocurrency&logoColor=white" alt="Donate via CryptoCloud">
</a>

Thank you for being part of this journey. ❤️
