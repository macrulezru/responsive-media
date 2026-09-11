export * from './responsive.enum';
export * from './base-state';
export * from './create-responsive';
export * from './container-state';
export * from './media-query';
export * from './presets';

// Vue composables (ResponsivePlugin, useResponsive, useBreakpoints, useMediaQuery,
// useContainerState) live at 'responsive-media/vue', NOT here — this entry stays
// import-safe for consumers who never install Vue (matching the already-optional
// `vue` peer dependency and mirroring how React hooks live at 'responsive-media/react').
// Previously this file re-exported them directly, which meant EVERY consumer of the
// main entry — vanilla JS or React included — pulled in a static, unconditional
// `import ... from '@vue/runtime-core'` with no `vue`/`@vue/runtime-core` in
// `dependencies` to guarantee it resolves. See README's "Framework support" section.
