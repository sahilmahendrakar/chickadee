'use client';

import { useRef, useState } from 'react';
import { AudioClip } from './AudioClip';
import { currentTime, stop, useFrame, usePlayer } from './player';

/** One card with a tab per language: the chosen sentence, its clip, and the words lighting up as they're spoken. */
export function LanguageClips({ clips }) {
  const [active, setActive] = useState(0);
  const player = usePlayer();
  const clip = clips[active];
  const textRef = useRef(null);
  const speaking = player.playing && player.src === clip.src;

  useFrame(speaking, (on) => {
    const words = textRef.current?.querySelectorAll('[data-w]');
    if (!words) return;
    const t = currentTime();
    words.forEach((w, i) => {
      const said = on && t >= clip.starts[i];
      const next = clip.starts[i + 1] ?? Infinity;
      w.dataset.w = !on ? 'idle' : said && t < next ? 'now' : said ? 'said' : 'ahead';
    });
  });

  function pick(i) {
    if (i === active) return;
    if (player.playing) stop();
    setActive(i);
  }

  return (
    <div className="pd-langs">
      <div className="pd-langs-tabs" role="tablist" aria-label="Language">
        {clips.map((c, i) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            id={`pd-lang-tab-${c.id}`}
            aria-selected={i === active}
            aria-controls="pd-lang-panel"
            className="pd-langs-tab"
            onClick={() => pick(i)}
          >
            {c.language}
          </button>
        ))}
      </div>
      <div className="pd-langs-panel" id="pd-lang-panel" role="tabpanel" aria-labelledby={`pd-lang-tab-${clip.id}`}>
        <p ref={textRef} className="pd-langs-text" lang={clip.lang} key={clip.id}>
          {clip.text.split(' ').map((word, i) => (
            <span key={i}>
              <span data-w="idle">{word}</span>{' '}
            </span>
          ))}
        </p>
        <AudioClip src={clip.src} label={`${clip.language} (${clip.voice})`} />
      </div>
    </div>
  );
}
