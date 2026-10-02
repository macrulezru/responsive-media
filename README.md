# **Responsive Media**

![Responsive Media](https://github.com/macrulezru/assets/blob/master/packages-images/responsive-media.png?raw=true)

Reactive boolean state from CSS media queries and element dimensions for Vanilla JS, Vue 3, React 19+ and Nuxt — AND/OR conditions, container queries, ordered breakpoint helpers, rich subscription API, CSS vars sync, SSR-safe, typed from your own config — with no required peer dependencies.

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
- **Nuxt module** — `responsive-media/nuxt`: breakpoints in `nuxt.config.ts`, auto-imported composables, an app plugin, and types generated from your breakpoints; `ssrState` gives the server a layout to render
- **Typed from your config** — `defineResponsive(config)` (Vue and React) returns hooks whose state and breakpoint keys are inferred, so `useResponsive().smallTablet` autocompletes and a typo is a compile error; `useContainerState` infers its keys the same way
- **React 19+ adapter** — same four hooks; `useSyncExternalStore` for safe concurrent rendering; SSR-safe (`false` on server)
- **Presets** — `TailwindPreset`, `BootstrapPreset`, `AccessibilityPreset` out of the box; user-preference queries (`dark`, `reducedMotion`, `highContrast`, `print`, …)
- **SSR-safe** — all APIs check for `window` / `matchMedia` / `ResizeObserver` before use; the `ssrState` option sets what the server renders instead of all-`false`, and `hydrate()` prevents layout shift on the client
- **Hydration-safe SSR** — deferred hydration (`hydration: 'deferred'`) keeps the server's values until the page has finished hydrating (async components included) and then applies the real ones, so there is no hydration-mismatch warning; React hydrates from the server snapshot by default; request hints (`cookie`, `user-agent`) let the server render for the visitor's own device
- **More hooks** — `useResponsiveValue` (a value per breakpoint), `useUserPreferences` (dark mode, reduced motion, …), `useViewportSize` (the window size as numbers), and a reactive query for Vue's `useMediaQuery`
- **CSS from the same config** — `toScssModule`, `toCustomMedia`, `toTailwindScreens` generate stylesheets from your breakpoints; the Nuxt module can write them for you
- **Test helpers** — `responsive-media/testing` is a controllable `matchMedia` for Vitest and Jest
- **TypeScript** — full generics; `ConfigToState<T>` infers a boolean-state type from any config object

---

## When you'd reach for this

A CSS media query decides how the layout looks, but it tells JavaScript nothing — responsive-media turns that same media query into a plain reactive boolean you can read straight from a component's own logic, with no separate resize listener or manual debouncing.

- **A component needs to know the breakpoint, not just CSS** — Mobile shows five cards in a feed, desktop shows a twenty-column table. That's not a styling question — it's a different data set and different render logic, and the component reads the current breakpoint as a plain reactive value to decide what to render.
- **A widget responds to its container's size, not the screen's** — The same dashboard widget should collapse into a compact view in a narrow sidebar and expand fully in a wide center column. The widget tracks its own container size, not the whole screen, and switches on its own.
- **A user asked the browser not to show animations** — The system's "reduce motion" setting should actually turn off transitions and parallax on the site — it's exposed as the same kind of reactive value as any other breakpoint, and just as easy to subscribe to.
- **A page shouldn't flash the wrong layout for a split second** — The server doesn't know the user's real screen size yet — state carries over from server to client safely, so the layout doesn't jump from one version to another right after the page loads.

---

## Installation

No required peer dependencies — the core (viewport/container state, utilities, presets), imported from the package root, works standalone with neither Vue nor React installed. The Vue and React adapters each live at their own subpath, so importing the root never pulls in either framework:

| Environment | Minimum version                    |
| ----------- | ------------------------------------ |
| Node.js     | `18+`                                |
| Vue         | `^3.5.27` (optional, for `/vue`)     |
| React       | `^19.0.0` (optional, for `/react`)   |
| Nuxt        | `^3.9.0 \|\| ^4.0.0` (optional, for `/nuxt`) |

```bash
npm install responsive-media
```

```bash
npm install vue@^3.5.27     # for Vue composables
npm install react@^19.0.0   # for React hooks
```

For Nuxt there is nothing else to install — register the module (see [Nuxt](#nuxt) below).

### Quick start

```ts
import { responsiveState, setResponsiveConfig } from 'responsive-media'

setResponsiveConfig({
  mobile: [{ type: 'max-width', value: 767 }],
  tablet: [
    { type: 'min-width', value: 768 },
    { type: 'max-width', value: 1023 },
  ],
  desktop: [{ type: 'min-width', value: 1024 }],
})

// Read current state
console.log(responsiveState.proxy.mobile) // true / false

// Subscribe to changes
const stop = responsiveState.subscribe((state) => {
  console.log('desktop:', state.desktop)
})

// Cleanup
stop()
```

### More examples

#### Vanilla JS

**One pre-configured singleton for the whole app**

`responsiveState` comes pre-configured for mobile/tablet/desktop — `getState()` gives a stable snapshot, `proxy` is live access with no debounce, and `getResponsiveMediaQueries()` returns the same conditions as ready-made CSS strings.

```ts
import { responsiveState, setResponsiveConfig, getResponsiveMediaQueries } from 'responsive-media'

// Re-configure the singleton
setResponsiveConfig(
  {
    sm: [{ type: 'max-width', value: 767 }],
    lg: [{ type: 'min-width', value: 1024 }],
  },
  {
    order: ['sm', 'lg'], // for isAbove / isBelow / between
    debounce: 50, // ms — throttle subscribe() listeners
  },
)

// Read a stable snapshot
const { sm, lg } = responsiveState.getState()

// Live proxy access (never debounced)
console.log(responsiveState.proxy.sm)

// Get the generated CSS strings
const mq = getResponsiveMediaQueries()
// { sm: '(max-width: 767px)', lg: '(min-width: 1024px)' }
```

**Container queries, no framework required**

`createContainerState` tracks a specific DOM element's size via `ResizeObserver` and toggles classes/CSS variables on its own — the same idea as CSS Container Queries, with support in browsers that don't have them natively.

```ts
import { createContainerState } from 'responsive-media/container'
// or: import { createContainerState } from 'responsive-media';

const card = document.querySelector('.card')!

const cardState = createContainerState(
  card,
  {
    compact: [{ type: 'max-width', value: 300 }],
    normal: [
      { type: 'min-width', value: 301 },
      { type: 'max-width', value: 599 },
    ],
    wide: [{ type: 'min-width', value: 600 }],
  },
  {
    order: ['compact', 'normal', 'wide'],
  },
)

// Reactive class toggling
cardState.on('compact', (v) => card.classList.toggle('card--compact', v))

// Sync CSS custom properties: --card-compact: 1; --card-wide: 0; …
cardState.syncCSSVars({ prefix: '--card-' })

// Get @container-compatible query strings
const strings = cardState.getMediaQueries()
// { compact: '(max-width: 300px)', wide: '(min-width: 600px)' }

// Cleanup — call once you're done watching this element (e.g. before
// removing it from the DOM), not right after setup
// cardState.destroy()
```

#### Vue

**Ordered breakpoints instead of raw booleans**

`isAbove`/`isBelow`/`between` read the current breakpoint from one shared config — no manual width comparisons, no ad-hoc media queries scattered around.

```ts
import { useBreakpoints } from 'responsive-media/vue'

const { current, isAbove, isBelow, between } = useBreakpoints()

// current.value        -> 'sm' | 'lg' | null, reactive
// isAbove('sm')         -> true above the 'sm' breakpoint
// between('sm', 'lg')   -> true only in the sm–lg range
```

**Queries against an element, not the viewport**

`useContainerState` tracks a specific element's size via `ResizeObserver` — the same idea as CSS Container Queries, in JS, with support in browsers that don't have them natively.

```ts
import { useTemplateRef } from 'vue'
import { useContainerState } from 'responsive-media/vue'

const cardRef = useTemplateRef<HTMLDivElement>('card')
const cardState = useContainerState(cardRef, {
  compact: [{ type: 'max-width', value: 300 }],
  wide: [{ type: 'min-width', value: 600 }],
})

// cardState.compact / cardState.wide — reactive booleans driven by the
// card element's own size (ResizeObserver), not the viewport — the same
// idea as CSS Container Queries, in JS.
```

**Any media feature in one line**

`useMediaQuery` accepts any raw CSS media query — dark mode, hover support, whatever — and cleans up its own listener on unmount.

```ts
import { useMediaQuery } from 'responsive-media/vue'

const isDark = useMediaQuery('(prefers-color-scheme: dark)')
const canHover = useMediaQuery('(hover: hover)')

// Both are Ref<boolean> — reactive, and clean up their own listener on
// unmount. Works with any raw CSS media feature, not just width.
```

**Hooks typed from your own breakpoints**

`defineResponsive` applies a config and returns hooks whose state and breakpoint keys are inferred from it — no generic to write by hand.

```ts
import { defineResponsive } from 'responsive-media/vue'

export const { useResponsive, useBreakpoints, plugin } = defineResponsive(
  {
    mobile: [{ type: 'max-width', value: 600 }],
    smallTablet: [{ type: 'max-width', value: 850 }],
    desktop: [{ type: 'min-width', value: 961 }],
  },
  { order: ['mobile', 'smallTablet', 'desktop'] },
)

// useResponsive().smallTablet  -> boolean
// useBreakpoints().isAbove('smallTablet')  -> 'nope' is a compile error
// app.use(plugin)  -> shares the state through provide/inject
```

`responsive-media/react` has the same `defineResponsive` (without the plugin).

#### Nuxt

Register the module and describe your breakpoints once, in `nuxt.config.ts`. The values must be plain data.

```ts
export default defineNuxtConfig({
  modules: ['responsive-media/nuxt'],
  responsive: {
    breakpoints: {
      mobile: [{ type: 'max-width', value: 600 }],
      smallTablet: [{ type: 'max-width', value: 850 }],
      desktop: [{ type: 'min-width', value: 961 }],
    },
    order: ['mobile', 'smallTablet', 'desktop'],
    ssrState: { desktop: true },
    ssrHints: ['cookie', 'user-agent'],
    css: { scss: true },
  },
})
```

`useResponsive`, `useBreakpoints`, `useResponsiveValue`, `useMediaQuery`, `useContainerState`, `useUserPreferences` and `useViewportSize` are auto-imported, and the first three know your breakpoint keys. The `responsive` key is typed, so the editor completes and checks it.

- **`ssrState`** is what the server renders (the browser's real size is unknown there); without it every key is `false` on the server.
- **`hydration`** — `'deferred'` by default: the browser hydrates with the server's values and switches to its real ones once the page has finished hydrating, so Vue logs no hydration warning. `'immediate'` uses the real state at once.
- **`ssrHints`** — `'cookie'` (the browser writes its window size to a cookie, the server reads it on the next request) and `'user-agent'` (mobile / tablet / desktop). The server then renders for the visitor's own device. The HTML depends on `Cookie` and `User-Agent`, so a CDN that caches pages must vary on them.
- **`ssrDevices`**, **`cookie`** — the sizes a user agent is rendered for, and the cookie name.
- **`devBadge`** — a corner badge with the current breakpoint, in development only.
- **`css`** — `{ scss: true }` writes `.nuxt/responsive-media/queries.scss`: `@use '#build/responsive-media/queries' as r; @include r.media(mobile) { … }`. `{ customMedia: true }` writes a `@custom-media` file.

```vue
<script setup lang="ts">
const responsive = useResponsive()
const { current, isAbove } = useBreakpoints()
</script>

<template>
  <CompactLayout v-if="responsive.smallTablet" />
  <WideLayout v-else />
  <span>{{ current }}</span>
</template>
```

With the default deferred hydration there is no warning when the browser's size differs from `ssrState`: the page renders the server's layout first and the real one a tick later. Choose the layout most visitors get for `ssrState`, add `ssrHints` so the server renders for the visitor's own device, and render what has no server value — `useMediaQuery()` and container state — inside `<ClientOnly>`.

**More hooks**

```ts
import { useResponsiveValue, useUserPreferences, useViewportSize, useMediaQuery } from 'responsive-media/vue'

const columns = useResponsiveValue({ mobile: 1, tablet: 2, desktop: 4 }) // ComputedRef<number | undefined>
const prefs = useUserPreferences() // prefs.dark, prefs.reducedMotion, …
const size = useViewportSize({ throttle: 200 }) // size.width, size.height
const wide = useMediaQuery(() => `(min-width: ${breakpoint.value}px)`) // a ref or a getter re-subscribes
```

`responsive-media/react` has `useResponsiveValue`, `useUserPreferences` and `useViewportSize` too.

#### Other frameworks

The state object follows the store contract (`subscribe` calls the listener at once and returns an unsubscribe function): `$responsiveState` in Svelte, `from(responsiveState)` in Solid, an RxJS `Observable` for Angular.

#### CSS and tests

```ts
import { toScssModule, toCustomMedia, toTailwindScreens } from 'responsive-media'

toScssModule(breakpoints) // a map + `@mixin media($key)`
toCustomMedia(breakpoints) // @custom-media --mobile (max-width: 600px);
toTailwindScreens(breakpoints) // { mobile: { raw: '(max-width: 600px)' } }
```

```ts
import { createViewportMock } from 'responsive-media/testing'

const viewport = createViewportMock()
beforeEach(() => viewport.install())
afterEach(() => viewport.uninstall())

it('goes mobile', () => {
  viewport.setViewport({ width: 500 })
  viewport.setFeature('prefers-color-scheme', 'dark')
})
```

#### React

**The same breakpoints, as a React hook**

`useBreakpoints()` from `responsive-media/react` — the same ordered `isAbove`/`between`, but re-renders drive through `useSyncExternalStore` instead of Vue reactivity.

```tsx
import { useBreakpoints } from 'responsive-media/react'

function Nav() {
  const { current, isAbove, isBelow, between } = useBreakpoints()
  return (
    <>
      <span>Current: {current}</span>
      {isAbove('sm') ? <DesktopNav /> : <MobileNav />}
      {between('sm', 'lg') && <TabletBanner />}
    </>
  )
}
```

**Container queries in React**

`useContainerState` sets up and tears down a `ResizeObserver` through `useEffect` — the same API as the Vue version, just for React.

```tsx
import { useRef } from 'react'
import { useContainerState } from 'responsive-media/react'

function Card() {
  const ref = useRef<HTMLDivElement>(null)
  const { compact, wide } = useContainerState(ref, {
    compact: [{ type: 'max-width', value: 300 }],
    wide: [{ type: 'min-width', value: 600 }],
  })

  return (
    <div ref={ref}>{compact ? <CompactLayout /> : wide ? <WideLayout /> : <DefaultLayout />}</div>
  )
}
```

**Raw media queries too**

`useMediaQuery` is SSR-safe — it always returns `false` on the server instead of throwing over a missing `window`.

```tsx
import { useMediaQuery } from 'responsive-media/react'

function ThemeToggle() {
  const isDark = useMediaQuery('(prefers-color-scheme: dark)')
  const canHover = useMediaQuery('(hover: hover)')
  return <button className={isDark ? 'dark' : 'light'}>Toggle</button>
}
```

---

## Documentation & links

- 📖 **Full documentation:** [npm.vuecraft.ru/en/packages/responsive-media](https://npm.vuecraft.ru/en/packages/responsive-media/guide/overview.html)
- 🌐 **VueCraft:** [vuecraft.ru/en](https://vuecraft.ru/en)
- 👤 **Author:** [macrulez.ru/en](https://macrulez.ru/en)
- 💻 **GitHub:** [macrulezru/responsive-media](https://github.com/macrulezru/responsive-media)
- 📦 **NPM:** [responsive-media](https://www.npmjs.com/package/responsive-media)
- 🐛 **Issues:** [github.com/macrulezru/responsive-media/issues](https://github.com/macrulezru/responsive-media/issues)

---

## License

MIT

---

## 💖 Support the project

Open source takes time and effort. If this library saves you time or brings value, consider supporting further development.

<a href="https://donate.cryptocloud.plus/M6O34NIN" target="_blank">
  <img src="https://img.shields.io/badge/Donate-CryptoCloud-8A2BE2?style=for-the-badge&logo=cryptocurrency&logoColor=white" alt="Donate via CryptoCloud">
</a>

Thank you for being part of this journey. ❤️
