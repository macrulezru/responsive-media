
import { ResponsiveConfig, type Breakpoint, type MediaQueryConfig } from './responsive.enum';
export type { MediaQueryConfig };

type ResponsiveState = Record<Breakpoint, boolean>;
type ResponsiveListener = (state: ResponsiveState) => void;

class ReactiveResponsiveState {
  private state: ResponsiveState;
  private listeners: Set<ResponsiveListener> = new Set();
  public proxy: ResponsiveState;
  private queries: Record<string, MediaQueryList> = {};

  constructor() {
    this.state = {} as ResponsiveState;
    this.proxy = new Proxy(this.state, {
      set: (target, prop: string, value) => {
        if (target[prop as keyof ResponsiveState] !== value) {
          target[prop as keyof ResponsiveState] = value;
          this.notify();
        }
        return true;
      },
      get: (target, prop: string) => {
        return target[prop as keyof ResponsiveState];
      },
    });
    this.applyConfig(ResponsiveConfig);
  }

  private applyConfig(config: Record<string, MediaQueryConfig>) {
    Object.entries(this.queries).forEach(([key, query]) => {
      query.onchange = null;
    });
    this.queries = {};

    Object.keys(this.state).forEach(key => delete this.state[key as keyof ResponsiveState]);

    Object.entries(config).forEach(([key, conditions]) => {
      // Формируем строку media-запроса из массива условий
      const mq = conditions
        .map(cond => {
          const val = typeof cond.value === 'number' && !String(cond.type).includes('aspect-ratio')
            ? cond.value + 'px'
            : cond.value;
          return `(${cond.type}: ${val})`;
        })
        .join(' and ');
      const query = window.matchMedia(mq);
      this.queries[key] = query;
      this.proxy[key as keyof ResponsiveState] = query.matches;
      query.addEventListener('change', (e) => {
        this.proxy[key as keyof ResponsiveState] = e.matches;
      });
    });
    this.notify();
  }

  setConfig(config: Record<string, MediaQueryConfig>) {
    this.applyConfig(config);
  }

  subscribe(listener: ResponsiveListener) {
    this.listeners.add(listener);

    listener(this.proxy);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.proxy));
  }
}

export const responsiveState = new ReactiveResponsiveState();

export function setResponsiveConfig(config: Record<string, MediaQueryConfig>) {
  responsiveState.setConfig(config);
}






