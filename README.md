# responsive-media

Утилита для реактивного состояния на основе CSS media queries без зависимостей. Есть интеграция с Vue 3 (Composition API).

## Установка

```
npm install responsive-media
```

## Использование без Vue

### Получение состояния

```ts
import { responsiveState } from 'responsive-media';

// Получить текущее состояние:
const { mobile, tablet, desktop } = responsiveState.proxy;

console.log('isMobile:', mobile);
console.log('isTablet:', tablet);
console.log('isDesktop:', desktop);
```

### Подписка на изменения

```ts
// Подписаться на изменения состояния:
const unsubscribe = responsiveState.subscribe((state) => {
  console.log('Изменилось состояние:', state);
  // state.mobile, state.tablet, state.desktop
});

// Для отписки вызовите:
unsubscribe();
```

## Использование с Vue 3 (Composition API)


### Подключение плагина

```ts
import { createApp } from 'vue';
import { ResponsivePlugin, ResponsiveConfig } from 'responsive-media';
import App from './App.vue';

const app = createApp(App);

// Использовать стандартные точки:
app.use(ResponsivePlugin);

// Или передать свою конфигурацию точек (теперь можно комбинировать условия):
app.use(ResponsivePlugin, {
  ...ResponsiveConfig, // оставить стандартные точки
  myCustom: [
    { type: 'min-width', value: 1200 },
    { type: 'aspect-ratio', value: '16/9' },
  ], // добавить свою с несколькими условиями
  mobile: [
    { type: 'max-width', value: 500 },
    { type: 'orientation', value: 'portrait' },
  ], // переопределить стандартную с несколькими условиями
});

app.mount('#app');
```


### Использование в компоненте

```ts
<script setup lang="ts">
import { useResponsive } from 'responsive-media';

const responsive = useResponsive();

// responsive.mobile, responsive.tablet, responsive.desktop и т.д.
</script>
```


## Кастомизация брейкпоинтов

Вы можете переопределить или добавить свои брейкпоинты с помощью функции setResponsiveConfig. Теперь для каждого брейкпоинта можно указать массив условий (они будут объединены через and):

```ts
import { setResponsiveConfig, ResponsiveConfig } from 'responsive-media';

setResponsiveConfig({
  ...ResponsiveConfig, // оставить стандартные
  myCustom: [
    { type: 'min-width', value: 1200 },
    { type: 'aspect-ratio', value: '16/9' },
  ], // добавить свой брейкпоинт с несколькими условиями
  mobile: [
    { type: 'max-width', value: 500 },
    { type: 'orientation', value: 'portrait' },
  ], // переопределить стандартный с несколькими условиями
});
```

## Экспортируемые сущности
- responsiveState
- ResponsiveConfig
- setResponsiveConfig
- ResponsivePlugin (Vue)
- useResponsive (Vue)

## Формат конфигурации брейкпоинтов

Каждый брейкпоинт теперь описывается массивом условий (MediaQueryConfig = MediaQueryCondition[]), где каждое условие — это объект с type и value. Все условия внутри одного брейкпоинта объединяются через and (например, `(max-width: 600px) and (aspect-ratio: 16/9)`).

## Лицензия
MIT