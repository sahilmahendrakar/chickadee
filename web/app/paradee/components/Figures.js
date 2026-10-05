'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon } from './icons';

const ROWS = [
  { label: 'Parameters', kokoro: '82M', paradee: '8M' },
  { label: 'File size', kokoro: '325 MB', paradee: '9 MB' },
  { label: 'Naturalness score (out of 5)', kokoro: '4.52', paradee: '4.41' },
  { label: 'Words misheard', kokoro: '5.7%', paradee: '6.0%' },
];

/** Kokoro and Paradee side by side. */
export function Comparison() {
  return (
    <div className="pd-table-wrap">
      <table className="pd-table">
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">Kokoro-82M</th>
            <th scope="col" className="pd-table-us">Paradee</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{r.kokoro}</td>
              <td className="pd-table-us">{r.paradee}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// tone: 'text' | 'dec' | 'plain', or undefined for a teacher box.
function Box({ x, y, w, title, sub, tone }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={56} rx={9} className={`pd-box pd-box-${tone ?? 'teacher'}`} />
      <text x={x + w / 2} y={sub ? y + 25 : y + 33} textAnchor="middle" className="pd-box-t">
        {title}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + 43} textAnchor="middle" className="pd-box-s">
          {sub}
        </text>
      )}
    </g>
  );
}

/** How each half of Paradee is trained against the matching half of Kokoro. */
export function DistillationDiagram() {
  const row = (y, student) => (
    <g>
      <Box x={10} y={y} w={110} title="Phonemes" tone="plain" />
      <path d={`M120 ${y + 28} H 176`} className="pd-wire" markerEnd="url(#pd-arrow)" />
      <Box x={180} y={y} w={220} title={student ? 'Student text side' : 'Kokoro text side'} sub={student ? '4.2M parameters' : '28M parameters'} tone={student ? 'text' : undefined} />
      <path d={`M400 ${y + 28} H 566`} className="pd-wire" markerEnd="url(#pd-arrow)" />
      <text x={485} y={y + 48} textAnchor="middle" className="pd-box-s">
        timing, pitch, loudness,
      </text>
      <text x={485} y={y + 64} textAnchor="middle" className="pd-box-s">
        feature encodings
      </text>
      <Box x={570} y={y} w={220} title={student ? 'Student decoder' : 'Kokoro decoder'} sub={student ? '3.9M parameters' : '53M parameters'} tone={student ? 'dec' : undefined} />
      <path d={`M790 ${y + 28} H 846`} className="pd-wire" markerEnd="url(#pd-arrow)" />
      <Box x={850} y={y} w={90} title="Audio" tone="plain" />
    </g>
  );
  return (
    <figure className="pd-figure">
      <div className="pd-figure-scroll">
        <svg viewBox="0 0 950 330" role="img" aria-label="Kokoro's text side and decoder on top, Paradee's smaller text side and decoder below, each trained to match the half above it">
          <defs>
            <marker id="pd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--pd-wire)" />
            </marker>
            <marker id="pd-arrow-text" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--pd-blue)" />
            </marker>
            <marker id="pd-arrow-dec" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--pd-amber)" />
            </marker>
          </defs>
          <text x={10} y={22} className="pd-box-h">Kokoro-82M, the teacher</text>
          {row(38, false)}
          <path d="M290 94 V 222" className="pd-wire pd-wire-text" markerEnd="url(#pd-arrow-text)" />
          <text x={278} y={152} textAnchor="end" className="pd-box-s pd-fill-text">trained to match</text>
          <text x={278} y={168} textAnchor="end" className="pd-box-s pd-fill-text">Kokoro&rsquo;s outputs</text>
          <path d="M680 94 V 222" className="pd-wire pd-wire-dec" markerEnd="url(#pd-arrow-dec)" />
          <text x={692} y={144} className="pd-box-s pd-fill-dec">trained to match</text>
          <text x={692} y={160} className="pd-box-s pd-fill-dec">Kokoro&rsquo;s audio, given</text>
          <text x={692} y={176} className="pd-box-s pd-fill-dec">Kokoro&rsquo;s text side outputs</text>
          {row(226, true)}
          <text x={10} y={318} className="pd-box-h">Paradee, the student</text>
        </svg>
      </div>
    </figure>
  );
}

/** A shell snippet with a copy button. */
export function Snippet({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be blocked; the code is still selectable.
    }
  };
  return (
    <div className="pd-snippet">
      <button type="button" onClick={copy} aria-label="Copy the commands">
        {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
      </button>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
