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
