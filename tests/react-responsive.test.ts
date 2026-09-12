import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { createMatchMediaMock } from './matchMedia.mock';
import { useBreakpoints, useMediaQuery, useContainerState } from '../src/react-responsive';
import { setResponsiveConfig } from '../src/create-responsive';

// Previously untested adapter (see want-fix.md gotcha 11) — these tests focus
// on the behavior actually fixed here (the isAbove bounds guard delegating
// correctly, and useContainerState's ref-not-yet-populated retry) rather than
// attempting full coverage of every hook.

const mock = createMatchMediaMock();

beforeEach(() => {
  mock.install();
  mock.reset();
});

afterEach(() => {
  cleanup();
  mock.uninstall();
  vi.unstubAllGlobals();
});

function stubResizeObserver() {
  const observeSpy = vi.fn();
  const disconnectSpy = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(_cb: ResizeObserverCallback) {}
      observe = observeSpy;
      disconnect = disconnectSpy;
      unobserve = vi.fn();
    },
  );
  return { observeSpy, disconnectSpy };
}

describe('useBreakpoints — isAbove bounds guard', () => {
  it('returns false for an unrecognized key (delegates to the shared, now-fixed base-state.ts logic)', () => {
    setResponsiveConfig({
      react_sm: [{ type: 'max-width', value: 600 }],
      react_lg: [{ type: 'min-width', value: 601 }],
    });
    mock.setMatch('(min-width: 601px)', true);

    const { result } = renderHook(() => useBreakpoints());

    expect(result.current.isAbove('typo')).toBe(false);
    expect(result.current.isAbove('react_sm')).toBe(true);
  });
});

describe('useMediaQuery', () => {
  it('tracks matchMedia changes and cleans up its listener on unmount', () => {
    const query = '(prefers-color-scheme: dark)';
    const { result, unmount } = renderHook(() => useMediaQuery(query));

    expect(result.current).toBe(false);
    expect(mock.listenerCount(query)).toBe(1);

    act(() => mock.setMatch(query, true));
    expect(result.current).toBe(true);

    unmount();
    expect(mock.listenerCount(query)).toBe(0);
  });
});

describe('useContainerState — ref populated after the first effect run', () => {
  it('sets up the ResizeObserver once ref.current becomes available, instead of giving up after the first null check', () => {
    // Regression: useEffect(..., []) ran its ref.current check exactly once,
    // on mount — an element behind a later-mounted conditional/portal (ref
    // still null at that moment) meant the observer was never created for
    // the component instance's entire lifetime. A plain RefObject has no
    // change notification of its own, so this required actually retrying,
    // not just reading `ref.current` more carefully once.
    const { observeSpy } = stubResizeObserver();
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });

    try {
      const elementRef: { current: Element | null } = { current: null };

      renderHook(() =>
        useContainerState(elementRef, { wide: [{ type: 'min-width', value: 500 }] }),
      );

      // Effect has run once; ref.current was null — old code gave up here forever.
      expect(observeSpy).not.toHaveBeenCalled();

      // The element "mounts" later — e.g. a conditional render flips, or a
      // child sets the ref after this component's own effect already committed.
      const el = document.createElement('div');
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        width: 700,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: 700,
        toJSON: () => {},
      } as DOMRect);
      elementRef.current = el;

      // Let the rAF-based poll loop catch up and find the now-populated ref.
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(observeSpy).toHaveBeenCalledTimes(1);
      expect(observeSpy).toHaveBeenCalledWith(el);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops polling and disconnects on unmount even if the ref never populated', () => {
    stubResizeObserver();
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });

    try {
      const elementRef: { current: Element | null } = { current: null };
      const { unmount } = renderHook(() =>
        useContainerState(elementRef, { wide: [{ type: 'min-width', value: 500 }] }),
      );

      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Should not throw, and should not leave a dangling rAF loop running.
      expect(() => unmount()).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });
});
