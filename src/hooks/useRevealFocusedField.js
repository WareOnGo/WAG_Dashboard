import { useLayoutEffect } from 'react';

const editable = 'input, textarea, select, [contenteditable="true"]';

function fieldScroller(field) {
  let parent = field.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
    parent = parent.parentElement;
  }
  return null;
}

// Reveal the field the user chose. Scroll only its form/drawer, never focus a
// different control or scroll the page (which would move the map underneath).
export function useRevealFocusedField(rootRef, active, viewport) {
  useLayoutEffect(() => {
    if (!active) return;
    let frame;
    let observedScroller;
    const reveal = () => {
      const field = document.activeElement;
      if (!rootRef.current?.contains(field) || !field.matches(editable)) return;
      const scroller = fieldScroller(field);
      if (!scroller) return;
      if (scroller !== observedScroller) {
        if (observedScroller) observer?.unobserve(observedScroller);
        observer?.observe(scroller);
        observedScroller = scroller;
      }
      const rect = field.getBoundingClientRect();
      const area = scroller.getBoundingClientRect();
      const visual = window.visualViewport;
      const top = Math.max(area.top, visual?.offsetTop ?? 0);
      const bottom = Math.min(area.bottom, (visual?.offsetTop ?? 0) + (visual?.height ?? window.innerHeight));
      if (bottom <= top) return;
      const gap = Math.min(12, Math.max(0, (bottom - top - rect.height) / 2));
      let delta = 0;
      // Oversized fields align at the top instead of oscillating between edges.
      if (rect.top < top + gap || rect.height > bottom - top - 2 * gap) delta = rect.top - top - gap;
      else if (rect.bottom > bottom - gap) delta = rect.bottom - bottom + gap;
      if (Math.abs(delta) > 1) scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: 'instant' });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reveal);
    };
    const onFocus = event => {
      if (rootRef.current?.contains(event.target)) schedule();
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    // Listen on document because Ant's drawer mounts its portal after this
    // effect. The ref scopes all reactions to this editor's own fields.
    document.addEventListener('focusin', onFocus);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener('focusin', onFocus);
    };
  }, [rootRef, active, viewport.height, viewport.top]);
}
