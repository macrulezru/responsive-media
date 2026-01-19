npm install responsive-media

# responsive-media

A utility for reactive state based on CSS media queries. Includes integration with Vue 3 (Composition API).

## Installation

```
npm install responsive-media
```

## Usage without Vue

### Getting the state

```ts
import { responsiveState } from 'responsive-media';

// Get the current state:
const { mobile, tablet, desktop } = responsiveState.proxy;

console.log('isMobile:', mobile);
console.log('isTablet:', tablet);
console.log('isDesktop:', desktop);
```

### Subscribing to changes

```ts
// Subscribe to state changes:
const unsubscribe = responsiveState.subscribe((state) => {
  console.log('State changed:', state);
  // state.mobile, state.tablet, state.desktop
});

// To unsubscribe:
unsubscribe();
```

## Usage with Vue 3 (Composition API)

### Plugin registration

```ts
import { createApp } from 'vue';
import { ResponsivePlugin, ResponsiveConfig } from 'responsive-media';
import App from './App.vue';

const app = createApp(App);

// Use default breakpoints:
app.use(ResponsivePlugin);

// Or provide your own breakpoints (now you can combine conditions):
app.use(ResponsivePlugin, {
  ...ResponsiveConfig, // keep default breakpoints
  myCustom: [
    { type: 'min-width', value: 1200 },
    { type: 'aspect-ratio', value: '16/9' },
  ], // add your own with multiple conditions
  mobile: [
    { type: 'max-width', value: 500 },
    { type: 'orientation', value: 'portrait' },
  ], // override default with multiple conditions
});

app.mount('#app');
```

### Usage in a component

```ts
<script setup lang="ts">
import { useResponsive } from 'responsive-media';

const responsive = useResponsive();

// responsive.mobile, responsive.tablet, responsive.desktop, etc.
</script>
```

## Customizing breakpoints

You can override or add your own breakpoints using the setResponsiveConfig function. Now each breakpoint can be an array of conditions (they will be combined with and):

```ts
import { setResponsiveConfig, ResponsiveConfig } from 'responsive-media';

setResponsiveConfig({
  ...ResponsiveConfig, // keep default
  myCustom: [
    { type: 'min-width', value: 1200 },
    { type: 'aspect-ratio', value: '16/9' },
  ], // add your own breakpoint with multiple conditions
  mobile: [
    { type: 'max-width', value: 500 },
    { type: 'orientation', value: 'portrait' },
  ], // override default with multiple conditions
});
```

## Exported entities
- responsiveState
- ResponsiveConfig
- setResponsiveConfig
- ResponsivePlugin (Vue)
- useResponsive (Vue)

## Breakpoint config format

Each breakpoint is now described by an array of conditions (MediaQueryConfig = MediaQueryCondition[]), where each condition is an object with type and value. All conditions within a breakpoint are combined with and (e.g., `(max-width: 600px) and (aspect-ratio: 16/9)`).

## Author

Danil Lisin Vladimirovich aka Macrulez

GitHub: [macrulezru](https://github.com/macrulezru)

Website: [macrulez.ru](https://macrulez.ru/)

## License
MIT