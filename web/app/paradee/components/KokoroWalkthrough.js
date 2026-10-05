'use client';

import { useEffect, useRef, useState } from 'react';
import { KOKORO as K } from '../data/kokoro';
import { currentTime, nearestStep, stop, toggle, useFrame, usePlayer } from './player';

const ASSETS = '/paradee';
const TONE = `${ASSETS}/audio/walk_tone.mp3`;
const VOICE = `${ASSETS}/audio/walk_kokoro.mp3`;

// Each step and node belongs to a part: 'in' | 'text' | 'dec'.
const STEPS = [
  {
    part: 'in',
    kicker: 'Text',
    title: 'It starts with a sentence',
    body: [
      "This is the line from Wikipedia's page on black-capped chickadees. Neither Kokoro nor Paradee saw it during training.",
    ],
  },
  {
    part: 'in',
    kicker: 'Phonemes',
    title: 'The words become sounds',
    body: [
      'Misaki turns the text into phonemes. “Males” becomes something like “mˈAlz”. From here on, Kokoro only works with phonemes.',
    ],
  },
  {
    part: 'text',
    kicker: 'Text side',
    title: 'How long to hold each sound',
    body: [
      'The text side reads the phonemes and decides how long each one lasts. Laid end to end, they become the timeline for everything that follows.',
      'Most sounds get 25 to 100 milliseconds. The last sound before the comma is held for about a quarter of a second.',
    ],
  },
  {
    part: 'text',
    kicker: 'Text side',
    title: 'Where the pitch goes, and how loud',
    body: [
      'Next it predicts how the pitch rises and falls, and how loud each moment should be. The gaps in the pitch line are sounds like “s” and “f”, which have no pitch.',
    ],
  },
  {
    part: 'text',
    kicker: 'Text side',
    title: 'What each sound should be',
    body: [
      'It also produces a 512-dimensional feature encoding for each phoneme, stretched to fit how long the phoneme lasts. Here are 96 of the dimensions, one row each.',
      'The timing, pitch, loudness and feature encodings are everything the decoder gets from the text side.',
    ],
  },
  {
    part: 'dec',
    kicker: 'Decoder',
    title: 'A helper tone to start from',
    body: [
      'The decoder builds a simple tone from the predicted pitch and its first eight overtones, using a fixed formula. Each bright line is one of them.',
      'For this voice, the tone stops around 2 kHz. Above that line, the decoder has to make the sound on its own.',
    ],
  },
  {
    part: 'dec',
    kicker: 'Decoder',
    title: 'The final audio',
    body: [
      'The decoder combines the tone with the text side’s outputs to make sound, 24,000 samples every second.',
      'The waveform generator at its very end does 89% of all of Kokoro’s arithmetic, which is why the decoder mattered most for making Paradee fast.',
    ],
  },
];

const NODES = [
  { label: 'Text', go: 0, part: 'in', steps: [0] },
  { label: 'Phonemes', go: 1, part: 'in', steps: [1] },
  { label: 'Text side', sub: '28M params', go: 2, part: 'text', steps: [2, 3, 4] },
  { label: 'Decoder', sub: '53M params', go: 5, part: 'dec', steps: [5, 6] },
  { label: 'Audio', go: 6, part: 'in', steps: [6] },
];

const LAYERS = [
  ['sentence'],
  ['phonemes'],
  ['axis', 'track', 'dur'],
  ['axis', 'track', 'pitch'],
  ['axis', 'track', 'feat'],
  ['axis', 'track', 'tone'],
  ['axis', 'track', 'out'],
];

// Chart geometry, in the SVG's 800x440 coordinate space.
const X0 = 56, X1 = 784, TOP = 20, BOT = 356, TRACK_Y = 372, TRACK_H = 34;
const tx = (t) => X0 + (t / K.total) * (X1 - X0);

/** Scroll-driven walkthrough of one sentence going through Kokoro. */
export function KokoroWalkthrough() {
  const root = useRef(null);
  const svgRef = useRef(null);
  const head = useRef(null);
  const apply = useRef(() => {});
  const [step, setStep] = useState(0);
  const player = usePlayer();

  // Draw every layer once; switching steps only toggles what is visible.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs = {}, parent) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, String(attrs[k]));
      parent?.appendChild(e);
      return e;
    };
    const layer = (name) => el('g', { class: 'pd-layer pd-hide', 'data-layer': name }, svg);

    const frame = K.frameMs / 1000;
    let t = K.lead * frame;
    const ph = K.phonemes.map((c, i) => {
      const s = t;
      t += K.dur[i] * frame;
      return { c, s, e: t, ms: K.dur[i] * K.frameMs };
    });

    // Time axis, shared by every chart from step 3 on.
    const axis = layer('axis');
    axis.classList.add('pd-axis');
    el('line', { x1: X0, x2: X1, y1: TRACK_Y + TRACK_H + 6, y2: TRACK_Y + TRACK_H + 6 }, axis);
    for (let s = 0; s <= Math.floor(K.total); s++) {
      el('line', { x1: tx(s), x2: tx(s), y1: TRACK_Y + TRACK_H + 6, y2: TRACK_Y + TRACK_H + 11 }, axis);
      el('text', { x: tx(s), y: TRACK_Y + TRACK_H + 26, 'text-anchor': 'middle' }, axis).textContent = `${s} s`;
    }

    // The sentence.
    const sentence = layer('sentence');
    const lines = [];
    let cur = '';
    K.text.split(' ').forEach((w) => {
      if (`${cur} ${w}`.trim().length > 34) {
        lines.push(cur.trim());
        cur = w;
      } else cur += ` ${w}`;
    });
    lines.push(cur.trim());
    lines.forEach((ln, i) => {
      el('text', { x: 400, y: 200 + (i - (lines.length - 1) / 2) * 46, 'text-anchor': 'middle', class: 'pd-sentence', 'font-size': 34 }, sentence).textContent = ln;
    });

    // Phoneme chips. Stress marks ride along with the sound that follows them.
    const phonemes = layer('phonemes');
    el('text', { x: 400, y: 70, 'text-anchor': 'middle', class: 'pd-sentence pd-dim', 'font-size': 18 }, phonemes).textContent = K.text;
    const chipW = 40, perRow = 15;
    const groups = [];
    K.phonemes.forEach((c) => {
      const last = groups[groups.length - 1];
      if (last && /^[ˈˌ]+$/.test(last)) groups[groups.length - 1] = last + c;
      else groups.push(c);
    });
    const chips = [];
    let row = 0, col = 0;
    groups.forEach((c, i) => {
      if (c === ' ') {
        col += 0.4;
        return;
      }
      if (col + 1 > perRow) {
        row++;
        col = 0;
      }
      const x = 400 - (perRow * chipW) / 2 + col * chipW, y = 130 + row * 58;
      const g = el('g', { class: 'pd-chip', style: `transition-delay:${i * 6}ms` }, phonemes);
      el('rect', { x: x + 2, y, width: chipW - 4, height: 44, rx: 6 }, g);
      el('text', { x: x + chipW / 2, y: y + 30, 'text-anchor': 'middle', class: 'pd-ph', 'font-size': 21 }, g).textContent = c;
      chips.push(g);
      col++;
    });

    // Phoneme track along the bottom.
    const track = layer('track');
    ph.forEach((p, i) => {
      if (p.c === ' ') return;
      const x = tx(p.s), w = Math.max(0.6, tx(p.e) - tx(p.s) - 0.6);
      el('rect', { x, y: TRACK_Y, width: w, height: TRACK_H, fill: i % 2 ? 'var(--pd-track-a)' : 'var(--pd-track-b)' }, track);
      if (w > 9) el('text', { x: x + w / 2, y: TRACK_Y + 23, 'text-anchor': 'middle', class: 'pd-ph', 'font-size': 13 }, track).textContent = p.c;
    });
    el('text', { x: X0 - 8, y: TRACK_Y + 22, 'text-anchor': 'end', class: 'pd-lbl' }, track).textContent = 'sounds';

    // Durations.
    const dur = layer('dur');
    const yMs = (ms) => BOT - (ms / 300) * (BOT - TOP - 40);
    [0, 100, 200, 300].forEach((v) => {
      el('line', { x1: X0, x2: X1, y1: yMs(v), y2: yMs(v), class: 'pd-grid', 'stroke-dasharray': v ? '2 4' : '' }, dur);
      el('text', { x: X0 - 8, y: yMs(v) + 4, 'text-anchor': 'end', class: 'pd-lbl' }, dur).textContent = `${v} ms`;
    });
    const bars = [];
    ph.forEach((p) => {
      if (p.c === ' ') return;
      const x = tx(p.s), w = Math.max(0.8, tx(p.e) - tx(p.s) - 0.8);
      bars.push(el('rect', { class: 'pd-bar', x, y: yMs(p.ms), width: w, height: BOT - yMs(p.ms) }, dur));
    });
    const comma = ph.findIndex((p) => p.c === ',');
    const held = ph[comma - 1];
    if (held) {
      el('text', { x: (tx(held.s) + tx(held.e)) / 2, y: yMs(held.ms) - 10, 'text-anchor': 'middle', class: 'pd-lbl pd-strong' }, dur).textContent = `held before the comma, ${held.ms} ms`;
    }

    // Pitch and loudness.
    const pitch = layer('pitch');
    const dt = K.total / K.f0.length;
    const PT = TOP + 10, PB = 230, fMin = 60, fMax = 320;
    const yF = (f) => PB - ((f - fMin) / (fMax - fMin)) * (PB - PT);
    [100, 200, 300].forEach((v) => {
      el('line', { x1: X0, x2: X1, y1: yF(v), y2: yF(v), class: 'pd-grid', 'stroke-dasharray': '2 4' }, pitch);
      el('text', { x: X0 - 8, y: yF(v) + 4, 'text-anchor': 'end', class: 'pd-lbl' }, pitch).textContent = `${v} Hz`;
    });
    let d = '', pen = false;
    K.f0.forEach((f, i) => {
      if (f > 80) {
        d += `${pen ? 'L' : 'M'}${tx(i * dt).toFixed(1)} ${yF(Math.min(f, fMax)).toFixed(1)}`;
        pen = true;
      } else pen = false;
    });
    const pitchPath = el('path', { d, class: 'pd-pitch' }, pitch);
    const pathLen = pitchPath.getTotalLength();
    pitchPath.style.strokeDasharray = String(pathLen);
    pitchPath.style.strokeDashoffset = String(pathLen);
    el('text', { x: X0, y: PT - 4, class: 'pd-lbl pd-strong' }, pitch).textContent = 'pitch';
    const NT = 262, NB = 350, nMin = Math.min(...K.n), nMax = Math.max(...K.n);
    const yN = (v) => NB - ((v - nMin) / (nMax - nMin)) * (NB - NT);
    let a = `M${X0} ${NB}`;
    K.n.forEach((v, i) => {
      a += `L${tx(i * dt).toFixed(1)} ${yN(v).toFixed(1)}`;
    });
    a += `L${X1} ${NB}Z`;
    el('path', { d: a, class: 'pd-loud' }, pitch);
    el('text', { x: X0, y: NT - 6, class: 'pd-lbl pd-strong' }, pitch).textContent = 'loudness';

    // Image layers.
    const image = (name, file, label) => {
      const g = layer(name);
      el('image', { href: `${ASSETS}/img/${file}`, x: X0, y: TOP + 20, width: X1 - X0, height: BOT - TOP - 20, preserveAspectRatio: 'none' }, g);
      el('text', { x: X0, y: TOP + 12, class: 'pd-lbl pd-strong' }, g).textContent = label;
      return g;
    };
    const kHz = (k) => BOT - (k / 8) * (BOT - TOP - 20);
    const addKhz = (g) =>
      [0, 2, 4, 6, 8].forEach((k) => {
        el('text', { x: X0 - 8, y: kHz(k) + 4, 'text-anchor': 'end', class: 'pd-lbl' }, g).textContent = `${k} kHz`;
      });
    image('feat', 'kokoro_features.png', '96 of the 512 feature dimensions for each sound (red is high, blue is low)');
    const tone = image('tone', 'kokoro_tone.png', 'the helper tone, as a spectrogram (brighter is louder)');
    addKhz(tone);
    el('line', { x1: X0, x2: X1, y1: kHz(2), y2: kHz(2), stroke: '#fff', 'stroke-dasharray': '5 5', opacity: 0.85 }, tone);
    el('text', { x: X1 - 6, y: kHz(2) - 8, 'text-anchor': 'end', class: 'pd-lbl pd-white' }, tone).textContent = 'the tone stops around 2 kHz';
    const out = image('out', 'kokoro_out.png', "Kokoro's final audio, as a spectrogram");
    addKhz(out);
    el('line', { x1: X0, x2: X1, y1: kHz(2), y2: kHz(2), stroke: '#fff', 'stroke-dasharray': '5 5', opacity: 0.5 }, out);

    head.current = el('line', { x1: X0, x2: X0, y1: TOP + 20, y2: TRACK_Y + TRACK_H, class: 'pd-head', opacity: 0 }, svg);

    apply.current = (s) => {
      svg.querySelectorAll('[data-layer]').forEach((g) => {
        g.classList.toggle('pd-hide', !LAYERS[s].includes(g.dataset.layer ?? ''));
      });
      chips.forEach((c) => c.classList.toggle('pd-in', s === 1));
      bars.forEach((b) => b.classList.toggle('pd-in', s === 2));
      pitchPath.style.strokeDashoffset = String(s === 3 ? 0 : pathLen);
    };
    apply.current(0);
    return () => svg.replaceChildren();
  }, []);

  useEffect(() => {
    apply.current(step);
  }, [step]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mobile = window.matchMedia('(max-width: 860px)');
    const pick = () => setStep(nearestStep(el, mobile.matches ? 0.72 : 0.5));
    window.addEventListener('scroll', pick, { passive: true });
    window.addEventListener('resize', pick);
    pick();
    return () => {
      window.removeEventListener('scroll', pick);
      window.removeEventListener('resize', pick);
    };
  }, []);

  const clip = step === 5 ? TONE : step === 6 ? VOICE : null;
  const playing = player.playing && clip !== null && player.src === clip;
  useFrame(playing, (on) => {
    const line = head.current;
    if (!line) return;
    line.setAttribute('opacity', on ? '1' : '0');
    if (on) {
      const x = String(tx(currentTime()));
      line.setAttribute('x1', x);
      line.setAttribute('x2', x);
    }
  });

  // Leaving a step stops its audio.
  useEffect(() => {
    if (player.playing && (player.src === TONE || player.src === VOICE) && player.src !== clip) stop();
  }, [clip, player]);

  const go = (target) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.current
      ?.querySelector(`[data-step="${target}"]`)
      ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  };

  return (
    <section className="pd-band" aria-label="How Kokoro turns one sentence into speech">
      <div className="pd-scrolly" ref={root}>
        <div className="pd-steps">
          {STEPS.map((s, i) => (
            <div key={s.title} className={`pd-step${i === step ? ' pd-active' : ''}`} data-step={i} data-part={s.part}>
              <div className="pd-kicker">
                Step {i + 1} · {s.kicker}
              </div>
              <h3>{s.title}</h3>
              {s.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          ))}
        </div>

        <div className="pd-stage-wrap">
          <div className="pd-stage">
            <div className="pd-pipe">
              {NODES.map((n, i) => (
                <div key={n.label} className="pd-contents">
                  {i > 0 && <span className="pd-arrow">→</span>}
                  <button
                    type="button"
                    className={`pd-node${n.sub ? ' pd-wide' : ''}${n.steps.includes(step) ? ` pd-on-${n.part}` : ''}`}
                    onClick={() => go(n.go)}
                  >
                    <b>{n.label}</b>
                    {n.sub && <small>{n.sub}</small>}
                  </button>
                </div>
              ))}
            </div>
            <div className="pd-viz">
              <svg ref={svgRef} viewBox="0 0 800 440" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Kokoro's intermediate outputs for the example sentence" />
            </div>
            <div className="pd-controls">
              {step === 5 && (
                <button type="button" className="pd-pill" onClick={() => toggle(TONE, { volume: 0.5 })}>
                  {playing ? 'Stop' : '▶ Play the helper tone'}
                </button>
              )}
              {step === 6 && (
                <button type="button" className="pd-pill" onClick={() => toggle(VOICE)}>
                  {playing ? 'Stop' : '▶ Play Kokoro'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
