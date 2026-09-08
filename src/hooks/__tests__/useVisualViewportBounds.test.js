import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVisualViewportBounds } from '../useVisualViewportBounds';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('useVisualViewportBounds', () => {
  it('tracks keyboard resize and panning without changing focus or scrolling the page', () => {
    const viewport = Object.assign(new EventTarget(), { width: 390, height: 844, offsetTop: 0, offsetLeft: 0 });
    vi.stubGlobal('visualViewport', viewport);
    let frame;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1; });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const scroll = vi.spyOn(window, 'scrollTo');
    const focused = document.activeElement;
    const { result, unmount } = renderHook(() => useVisualViewportBounds(true));
    act(() => frame());
    expect(result.current).toEqual({ width: 390, height: 844, top: 0, left: 0 });
    act(() => { viewport.height = 440; viewport.dispatchEvent(new Event('resize')); frame(); });
    act(() => { viewport.offsetTop = 120; viewport.dispatchEvent(new Event('scroll')); frame(); });
    expect(result.current).toEqual({ width: 390, height: 440, top: 120, left: 0 });
    expect(document.activeElement).toBe(focused);
    expect(scroll).not.toHaveBeenCalled();
    const remove = vi.spyOn(viewport, 'removeEventListener');
    unmount();
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('uses window dimensions without the visual viewport API and listens only while open', () => {
    vi.stubGlobal('visualViewport', undefined);
    const add = vi.spyOn(window, 'addEventListener');
    const { result, rerender } = renderHook(({ open }) => useVisualViewportBounds(open), { initialProps: { open: false } });
    expect(result.current).toEqual({ width: window.innerWidth, height: window.innerHeight, top: 0, left: 0 });
    expect(add).not.toHaveBeenCalledWith('resize', expect.any(Function));
    rerender({ open: true });
    expect(add).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
