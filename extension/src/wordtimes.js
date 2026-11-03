// When each word is spoken, for highlighting the word being read. Paradee works
// out how long every phoneme lasts before it makes any sound (in frames of 600
// samples, 25 ms at 24 kHz), and the frames add up to the length of the audio
// exactly. This is the same idea as with_timestamps in the paradee package.

// Inside the released Paradee graphs: each token's length in frames, rounded.
export const DURATIONS = '/Clip_output_0';

// The ONNX file `model` (bytes) with the float tensor `name` as one more graph
// output, so the durations can be read without re-exporting the model. An ONNX
// file is a protobuf: the graph is field 7 of the model and its outputs are field
// 12 of the graph, so one ValueInfoProto is appended to the graph and the graph's
// length prefix rewritten. Every other byte stays as it was.
export function withOutput(model, name) {
  const varint = (n) => {
    const out = [];
    for (;;) {
      const b = n % 128; n = Math.floor(n / 128);
      out.push(n ? b | 0x80 : b);
      if (!n) return out;
    }
  };
  const readVarint = (i) => {
    let n = 0, mul = 1;
    for (;;) {
      const b = model[i++];
      n += (b & 0x7f) * mul; mul *= 128;
      if (b < 0x80) return [n, i];
    }
  };
  const field = (num, payload) => [...varint(num * 8 + 2), ...varint(payload.length), ...payload];
  let i = 0;
  while (i < model.length) {
    const start = i;
    const [key, j] = readVarint(i); i = j;
    const kind = key & 7;
    if (kind === 0) i = readVarint(i)[1];
    else if (kind === 1) i += 8;
    else if (kind === 5) i += 4;
    else if (kind === 2) {
      const [n, body] = readVarint(i);
      i = body + n;
      if (Math.floor(key / 8) === 7) {
        // ValueInfoProto{name, type: TypeProto{tensor_type: {elem_type: FLOAT}}}
        const info = field(1, [...new TextEncoder().encode(name)]).concat(field(2, field(1, [0x08, 0x01])));
        const graphEnd = field(12, info);
        const head = varint(7 * 8 + 2).concat(varint(n + graphEnd.length));
        const out = new Uint8Array(start + head.length + n + graphEnd.length + (model.length - i));
        out.set(model.subarray(0, start), 0);
        out.set(head, start);
        out.set(model.subarray(body, i), start + head.length);
        out.set(graphEnd, start + head.length + n);
        out.set(model.subarray(i), start + head.length + n + graphEnd.length);
        return out;
      }
    } else break;
  }
  throw new Error('no graph found in the ONNX model');
}

const LETTER = /[\p{L}\p{N}]/u;
// The phoneme string as runs of characters between spaces, with each run's
// position in the token ids (id 0 is the pad at the start).
function phonemeWords(ps) {
  const words = [];
  let k = 0;
  for (const part of ps.split(' ')) {
    if (part && [...part].some(c => LETTER.test(c)))   // punctuation alone is not a word
      words.push({ from: k + 1, to: k + 1 + [...part].length, len: [...part].filter(c => LETTER.test(c)).length });
    k += [...part].length + 1;
  }
  return words;
}

// Seconds, for each phoneme id position, where the sound for that id starts.
// The sound comes about 3 frames before the durations say it does, which is the
// same correction Kokoro makes (KPipeline.join_timestamps, and with_timestamps in
// the paradee package). Checked against Whisper's word times: without it the
// highlight ran about 100 ms late.
const LEAD = 3 * 0.025;
function frameStarts(durations) {
  const t = new Float64Array(durations.length + 1);
  for (let i = 0; i < durations.length; i++) t[i + 1] = t[i] + Math.round(Number(durations[i])) * 0.025;
  return t.map(x => Math.max(0, x - LEAD));
}

// [start, end] in seconds for each text word.
//   ps: the phoneme string the model read (tokenizer-normalised, so one id per character)
//   durations: the model's frames for every id, the pad at each end included
//   counts: for each text word, how many phoneme words it turns into on its own
//   lens: for each text word, how many phoneme letters it turns into on its own
// When the counts add up to the phoneme words of the sentence, each text word gets
// its own phoneme words. When they do not (eSpeak sometimes runs two short words
// together, as in "of the"), the sentence's phonemes are shared out in proportion
// to each word's own length, and a boundary that lands near a space moves to it.
export function wordTimes(ps, durations, counts, lens) {
  const at = frameStarts(durations);
  const pw = phonemeWords(ps);
  const n = counts.length;
  if (!pw.length || !n) return [];
  const span = (a, b) => [at[pw[a].from], at[pw[b].to]];
  const out = [];
  if (counts.reduce((a, b) => a + b, 0) === pw.length) {
    let w = 0;
    for (const c of counts) {
      if (!c) { const t = w < pw.length ? at[pw[w].from] : at[pw[pw.length - 1].to]; out.push([t, t]); continue; }
      out.push(span(w, w + c - 1)); w += c;
    }
  } else {
    // positions of the phoneme letters, in id order, and where each phoneme word starts among them
    const letters = [], starts = new Set();
    for (const p of pw) {
      starts.add(letters.length);
      for (let k = p.from; k < p.to; k++) if (LETTER.test(ps[k - 1])) letters.push(k);
    }
    starts.add(letters.length);
    const total = lens.reduce((a, b) => a + b, 0);
    let acc = 0, prev = 0;
    for (let w = 0; w < n; w++) {
      acc += total ? lens[w] : 1;
      let cut = w === n - 1 ? letters.length : Math.round(acc / (total || n) * letters.length);
      for (const d of [0, 1, -1, 2, -2]) if (starts.has(cut + d)) { cut += d; break; }
      cut = Math.max(prev, Math.min(letters.length, cut));
      const a = Math.min(prev, letters.length - 1);
      out.push(cut > prev ? [at[letters[prev]], at[letters[cut - 1] + 1]] : [at[letters[a]], at[letters[a]]]);
      prev = cut;
    }
  }
  // The highlight moves on halfway through the pause between two words.
  for (let w = 0; w + 1 < out.length; w++) {
    const mid = (out[w][1] + out[w + 1][0]) / 2;
    if (out[w + 1][0] > out[w][1]) { out[w][1] = mid; out[w + 1][0] = mid; }
  }
  return out;
}

// The words of a sentence as the reader shows them: runs between spaces that hold
// a letter or digit, with their character offsets in the sentence.
export function textWords(text) {
  const words = [];
  for (const m of text.matchAll(/\S+/g)) if (LETTER.test(m[0])) words.push({ text: m[0], from: m.index, to: m.index + m[0].length });
  return words;
}

export { phonemeWords };
