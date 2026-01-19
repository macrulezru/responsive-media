import { ResponsiveConfig } from './responsive.enum';
class ReactiveResponsiveState {
    constructor() {
        this.listeners = new Set();
        this.queries = {};
        this.mediaQueries = {};
        this.state = {};
        this.proxy = new Proxy(this.state, {
            set: (target, prop, value) => {
                if (target[prop] !== value) {
                    target[prop] = value;
                    this.notify();
                }
                return true;
            },
            get: (target, prop) => {
                return target[prop];
            },
        });
        this.applyConfig(ResponsiveConfig);
    }
    applyConfig(config) {
        Object.entries(this.queries).forEach(([key, query]) => {
            query.onchange = null;
        });
        this.queries = {};
        this.mediaQueries = {};
        Object.keys(this.state).forEach(key => delete this.state[key]);
        Object.entries(config).forEach(([key, conditions]) => {
            const mq = conditions
                .map(cond => {
                const val = typeof cond.value === 'number' && !String(cond.type).includes('aspect-ratio')
                    ? cond.value + 'px'
                    : cond.value;
                return `(${cond.type}: ${val})`;
            })
                .join(' and ');
            this.mediaQueries[key] = mq;
            const query = window.matchMedia(mq);
            this.queries[key] = query;
            this.proxy[key] = query.matches;
            query.addEventListener('change', (e) => {
                this.proxy[key] = e.matches;
            });
        });
        this.notify();
    }
    getMediaQueries() {
        return { ...this.mediaQueries };
    }
    setConfig(config) {
        this.applyConfig(config);
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.proxy);
        return () => this.listeners.delete(listener);
    }
    notify() {
        this.listeners.forEach(listener => listener(this.proxy));
    }
}
export function getResponsiveMediaQueries() {
    return responsiveState.getMediaQueries();
}
export const responsiveState = new ReactiveResponsiveState();
export function setResponsiveConfig(config) {
    responsiveState.setConfig(config);
}
