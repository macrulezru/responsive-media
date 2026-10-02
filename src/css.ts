import type { MediaQueryConfig } from './responsive.enum';
import { buildMediaQuery } from './create-responsive';

export function toMediaQueries(config: Record<string, MediaQueryConfig>): Record<string, string> {
  return Object.keys(config).reduce<Record<string, string>>((acc, key) => {
    acc[key] = buildMediaQuery(config[key]);
    return acc;
  }, {});
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export interface ScssOptions {
  name?: string;
  mixin?: string;
}

export function toScssMap(config: Record<string, MediaQueryConfig>, options: ScssOptions = {}): string {
  const name = options.name ?? 'queries';
  const entries = Object.entries(toMediaQueries(config))
    .map(([key, query]) => `  ${quote(key)}: ${quote(query)}`)
    .join(',\n');
  return `$${name}: (\n${entries}\n);`;
}

export function toScssModule(config: Record<string, MediaQueryConfig>, options: ScssOptions = {}): string {
  const name = options.name ?? 'queries';
  const mixin = options.mixin ?? 'media';
  return [
    "@use 'sass:map';",
    '',
    toScssMap(config, { name }),
    '',
    `@mixin ${mixin}($key) {`,
    `  @if not map.has-key($${name}, $key) {`,
    '    @error "Unknown breakpoint #{$key}";',
    '  }',
    `  @media #{map.get($${name}, $key)} {`,
    '    @content;',
    '  }',
    '}',
    '',
  ].join('\n');
}

export interface CustomMediaOptions {
  prefix?: string;
}

export function toCustomMedia(
  config: Record<string, MediaQueryConfig>,
  options: CustomMediaOptions = {},
): string {
  const prefix = options.prefix ?? '--';
  return Object.entries(toMediaQueries(config))
    .map(([key, query]) => `@custom-media ${prefix}${key} ${query};`)
    .join('\n');
}

export function toTailwindScreens(
  config: Record<string, MediaQueryConfig>,
): Record<string, { raw: string }> {
  return Object.entries(toMediaQueries(config)).reduce<Record<string, { raw: string }>>(
    (acc, [key, query]) => {
      acc[key] = { raw: query };
      return acc;
    },
    {},
  );
}
