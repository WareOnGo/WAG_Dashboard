import { useLayoutEffect, useState } from 'react';

const readBounds = () => {
  const viewport = window.visualViewport;
  return {
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
    top: viewport?.offsetTop ?? 0,
    left: viewport?.offsetLeft ?? 0,
  };
};

// Modal geometry follows the visible browser area, including the software
// keyboard. This does not change screen breakpoints, focus or page scrolling.
export function useVisualViewportBounds(active) {
  const [bounds, setBounds] = useState(readBounds);
  useLayoutEffect(() => {
    if (!active) return;
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setBounds(readBounds()));
    };
    update();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [active]);
  return bounds;
}
