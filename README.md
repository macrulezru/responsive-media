# **Responsive Media**

![Responsive Media](https://github.com/macrulezru/assets/blob/master/packages-images/responsive-media.png?raw=true)

Reactive boolean state from CSS media queries and element dimensions for Vanilla JS, Vue 3, and React 19+ — AND/OR conditions, container queries, ordered breakpoint helpers, rich subscription API, CSS vars sync, SSR-safe — with no required peer dependencies.

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
- **React 19+ adapter** — same four hooks; `useSyncExternalStore` for safe concurrent rendering; SSR-safe (`false` on server)
- **Presets** — `TailwindPreset`, `BootstrapPreset`, `AccessibilityPreset` out of the box; user-preference queries (`dark`, `reducedMotion`, `highContrast`, `print`, …)
- **SSR-safe** — all APIs check for `window` / `matchMedia` / `ResizeObserver` before use; `hydrate()` prevents layout shift on the client
- **TypeScript** — full generics; `ConfigToState<T>` infers a boolean-state type from any config object

---

## Installation

No required peer dependencies — the core (viewport/container state, utilities, presets) works standalone. Vue and React adapters activate automatically once the matching peer package is installed:

| Environment | Minimum version                    |
| ----------- | ------------------------------------ |
| Node.js     | `18+`                                |
| Vue         | `^3.5.27` (optional)                 |
| React       | `^19.0.0` (optional, for `/react`)   |

```bash
npm install responsive-media
```

```bash
npm install vue@^3.5.27     # for Vue composables
npm install react@^19.0.0   # for React hooks
```

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
import { useBreakpoints } from 'responsive-media'

const { current, isAbove, isBelow, between } = useBreakpoints()

// current.value        -> 'sm' | 'lg' | null, reactive
// isAbove('sm')         -> true above the 'sm' breakpoint
// between('sm', 'lg')   -> true only in the sm–lg range
```

**Queries against an element, not the viewport**

`useContainerState` tracks a specific element's size via `ResizeObserver` — the same idea as CSS Container Queries, in JS, with support in browsers that don't have them natively.

```ts
import { useTemplateRef } from 'vue'
import { useContainerState } from 'responsive-media'

const cardRef = useTemplateRef('card')
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
import { useMediaQuery } from 'responsive-media'

const isDark = useMediaQuery('(prefers-color-scheme: dark)')
const canHover = useMediaQuery('(hover: hover)')

// Both are Ref<boolean> — reactive, and clean up their own listener on
// unmount. Works with any raw CSS media feature, not just width.
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
