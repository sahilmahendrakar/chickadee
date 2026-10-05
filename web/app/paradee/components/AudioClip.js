'use client';

import { useRef } from 'react';
import { PauseIcon, PlayIcon } from './icons';
import { progress, toggle, useFrame, usePlayer } from './player';

function PlayButton({ playing, onClick, label }) {
  return (
    <button type="button" className="pd-playbtn" onClick={onClick} aria-label={playing ? `Stop ${label}` : `Play ${label}`}>
      {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} className="pd-nudge" />}
    </button>
  );
}

function useProgressBar(active) {
  const fill = useRef(null);
  useFrame(active, (on) => {
    if (fill.current) fill.current.style.transform = `scaleX(${on ? progress() : 0})`;
  });
  return fill;
}

/** A single audio sample with a label. */
export function AudioClip({ src, label, note }) {
  const player = usePlayer();
  const playing = player.playing && player.src === src;
  const fill = useProgressBar(playing);

  return (
    <div className="pd-clip">
      <PlayButton playing={playing} onClick={() => toggle(src)} label={label} />
      <div className="pd-clip-body">
        <div className="pd-clip-label">
          <span>{label}</span>
          {note && <span className="pd-clip-note">{note}</span>}
        </div>
        <div className="pd-track">
          <div ref={fill} className="pd-track-fill" />
        </div>
      </div>
    </div>
  );
}
