import { useRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRevealFocusedField } from '../useRevealFocusedField';

let frames;
const flush = () => act(() => {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach(callback => callback());
});
const bounds = (top, height) => ({ top, bottom: top + height, height });

function Form({ active = true, height = 500, top = 0 }) {
  const ref = useRef(null);
  useRevealFocusedField(ref, active, { height, top });
  return <><div ref={ref} data-testid="body" style={{ overflowY: 'auto' }}><input aria-label="Name" /><textarea aria-label="Notes" /></div><input aria-label="Outside" /></>;
}

beforeEach(() => {
  frames = new Map();
  let id = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++id, callback); return id; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(key => frames.delete(key));
  vi.stubGlobal('visualViewport', { height: 500, offsetTop: 0 });
  // The repository's global setup replaces computed styles with an empty
  // object. Supply the overflow geometry this hook needs to find the body.
  vi.stubGlobal('getComputedStyle', element => ({ overflowY: element.style.overflowY }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function setup(props) {
  const view = render(<Form {...props} />);
  const body = screen.getByTestId('body');
  Object.defineProperties(body, { scrollHeight: { value: 1000 }, clientHeight: { value: 300 } });
  body.getBoundingClientRect = () => bounds(100, 300);
  body.scrollTo = vi.fn(({ top }) => { body.scrollTop = top; });
  const name = screen.getByLabelText('Name');
  const notes = screen.getByLabelText('Notes');
  name.getBoundingClientRect = () => bounds(120 - body.scrollTop, 44);
  notes.getBoundingClientRect = () => bounds(450 - body.scrollTop, 96);
  flush();
  return { ...view, body, name, notes };
}

describe('useRevealFocusedField', () => {
  it('reveals newly focused fields without another viewport resize or changing page position', () => {
    const pageScroll = vi.spyOn(window, 'scrollTo');
    const { body, notes, name } = setup();
    expect(body.scrollTo).not.toHaveBeenCalled();
    act(() => notes.focus({ preventScroll: true }));
    flush();
    expect(notes.getBoundingClientRect().bottom).toBe(388);
    act(() => name.focus({ preventScroll: true }));
    flush();
    expect(name.getBoundingClientRect().top).toBe(112);
    expect(document.activeElement).toBe(name);
    expect(pageScroll).not.toHaveBeenCalled();
  });

  it('rechecks the active field after keyboard resize and panning', () => {
    const { rerender, body, notes } = setup();
    act(() => notes.focus({ preventScroll: true }));
    flush();
    window.visualViewport.height = 220;
    window.visualViewport.offsetTop = 100;
    rerender(<Form height={220} top={100} />);
    flush();
    expect(notes.getBoundingClientRect().bottom).toBe(308);
    expect(document.activeElement).toBe(notes);
    expect(body.scrollTop).toBeGreaterThan(0);
  });

  it('ignores outside fields, closed forms and pending work after unmount', () => {
    const { body, notes, rerender, unmount } = setup();
    act(() => screen.getByLabelText('Outside').focus());
    flush();
    expect(body.scrollTo).not.toHaveBeenCalled();
    rerender(<Form active={false} />);
    act(() => notes.focus({ preventScroll: true }));
    flush();
    expect(body.scrollTo).not.toHaveBeenCalled();
    rerender(<Form />);
    unmount();
    flush();
    expect(body.scrollTo).not.toHaveBeenCalled();
  });
});
