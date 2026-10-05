'use client';

import { useEffect, useRef } from 'react';

/**
 * Thin bar along the top of the viewport showing how far into the article the
 * reader is. The original used framer-motion's useScroll + useSpring; this eases
 * toward the scroll position each frame for a similar soft follow.
 */
export function ReadingProgress() {
  const bar = useRef(null);

  useEffect(() => {
    let target = 0;
    let shown = 0;
    let raf = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const measure = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    const draw = () => {
      if (bar.current) bar.current.style.transform = `scaleX(${shown})`;
    };
    const tick = () => {
      const delta = target - shown;
      if (reduce || Math.abs(delta) < 0.001) {
        shown = target;
        draw();
        raf = 0;
        return;
      }
      shown += delta * 0.2;
      draw();
      raf = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      measure();
      if (!raf) raf = requestAnimationFrame(tick);
    };

    measure();
    shown = target;
    draw();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={bar} aria-hidden="true" className="pd-progress" />;
}
