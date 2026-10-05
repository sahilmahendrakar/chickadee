'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * One shared audio element for every clip in the post, so starting a clip
 * stops whichever one was playing, and any component can follow the playhead.
 * State shape: { src: string | null, playing: boolean }.
 */
const IDLE = { src: null, playing: false };
let state = IDLE;
let el = null;
const subscribers = new Set();

function set(next) {
  state = next;
  subscribers.forEach((notify) => notify());
}

function element() {
  if (!el) {
    el = new Audio();
    el.preload = 'auto';
    el.addEventListener('ended', () => set({ src: state.src, playing: false }));
  }
  return el;
}

export function play(src, opts = {}) {
  const audio = element();
  if (state.src !== src) audio.src = src;
  audio.volume = opts.volume ?? 1;
  audio.currentTime = opts.at ?? 0;
  set({ src, playing: true });
  audio.play().catch(() => set({ src, playing: false }));
}

export function stop() {
  el?.pause();
  set({ src: state.src, playing: false });
}

export function toggle(src, opts) {
  if (state.playing && state.src === src) stop();
  else play(src, opts);
}

export function currentTime() {
  return el?.currentTime ?? 0;
}

/** Fraction of the current clip played so far, 0 to 1. */
export function progress() {
  if (!el || !el.duration || Number.isNaN(el.duration)) return 0;
  return Math.min(1, el.currentTime / el.duration);
}

function subscribe(notify) {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

export function usePlayer() {
  return useSyncExternalStore(subscribe, () => state, () => IDLE);
}

/** Calls `onFrame` every animation frame while `active`, and once more when it stops. */
export function useFrame(active, onFrame) {
  useEffect(() => {
    if (!active) {
      onFrame(false);
      return;
    }
    let raf = 0;
    const tick = () => {
      onFrame(true);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

/**
 * Index of the `[data-step]` element closest to a horizontal line across the
 * viewport, updated on scroll. `line` is that line's position as a fraction of
 * the viewport height.
 */
export function nearestStep(root, line) {
  const y = window.innerHeight * line;
  let best = 0;
  let bestDistance = Infinity;
  root.querySelectorAll('[data-step]').forEach((step) => {
    const r = step.getBoundingClientRect();
    const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    if (d < bestDistance) {
      bestDistance = d;
      best = Number(step.dataset.step);
    }
  });
  return best;
}
