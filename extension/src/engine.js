// Headless TTS engine. Lives in a hidden iframe (an extension page, so it gets
// the bundled ONNX runtime and WebGPU). It owns the model and the <audio>
// element; the content script owns all visible UI and on-page highlighting.
import { KokoroTTS } from 'kokoro-js';
import { env, PreTrainedTokenizer, RawAudio } from '@huggingface/transformers';
import tokenizerJSON from './paradee-tokenizer.json';
import { toMisaki } from './misaki.js';
import { wordTimes, textWords, phonemeWords } from './wordtimes.js';
import { phonemize } from 'phonemizer';
import { g2p as espeakG2P, LANG_OF } from './espeak-g2p.js';

env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('vendor/');
env.allowLocalModels = false;

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DTYPE = 'fp32';     // q8 on webgpu is numerically corrupt; wasm is sub-realtime
const DEVICE = 'webgpu';

// Paradee: an 8M-parameter model distilled from Kokoro, with eight of its voices
// in four languages (1.3). It ships inside the extension (8.5 MB, int8 weights)
// and runs on the CPU (wasm), so it needs no WebGPU and no download. The model
// takes the voice as its row in PARADEE_VOICES.
const PARADEE_URL = chrome.runtime.getURL('paradee/paradee.onnx');
const PARADEE_VOICES = ['af_heart', 'bf_isabella', 'am_puck', 'bm_fable', 'hf_alpha', 'hm_omega', 'ff_siwis', 'em_alex'];

// Hindi, French and Spanish phonemes. The phonemizer package carries eSpeak's
// English dictionary only, so the other three (from eSpeak NG 1.52, the version
// training used) ship in espeak/ and are written into eSpeak's files the first
// time a voice needs one. build.mjs makes the phonemizer accept those languages
// and hands this page eSpeak's file system as globalThis.__espeakFS.
const dicts = {};
function espeakDict(lang) {
  return dicts[lang] ??= (async () => {
    await phonemize('a', 'en-us');   // eSpeak is up, so its file system is there
    const bytes = new Uint8Array(await (await fetch(chrome.runtime.getURL(`espeak/${lang}_dict`))).arrayBuffer());
    globalThis.__espeakFS.writeFile(`/usr/share/espeak-ng-data/${lang}_dict`, bytes);
  })();
}
async function langPhonemes(text, lang) {
  await espeakDict(lang);
  return espeakG2P(phonemize, text, lang);
}

let models = {}, tts = null, engine = 'kokoro', gen = 0, sentences = [], cache = new Map();
let current = 0, stopped = false, voice = 'af_heart', speed = 1.0;
let audio;

const emit = (msg) => parent.postMessage(msg, '*');

// The word being spoken, sent to the page whenever it changes. Only Paradee
// reports durations, so with Kokoro the sentence alone is highlighted.
let playing = { i: -1, words: [] }, word = -1;
function tick() {
  const t = audio.currentTime, ws = playing.words;
  let k = -1;
  if (!audio.paused || audio.currentTime > 0)
    for (let j = 0; j < ws.length; j++) if (t >= ws[j].start && t < ws[j].end) { k = j; break; }
  if (k === word) return;
  word = k;
  emit(k < 0 ? { type: 'KL_WORD', i: playing.i, from: -1 } : { type: 'KL_WORD', i: playing.i, from: ws[k].from, to: ws[k].to });
}

// Reuses kokoro-js for text -> phonemes -> token ids and swaps in Paradee for
// the model call. kokoro-js picks British eSpeak for a bf_/bm_ voice and American
// for the rest; t.british tells toMisaki which of the two it got. It is set just
// before each generate, and runs never overlap (see runQueue).
//
// The model also says how long each phoneme lasts (see wordtimes.js), which is
// how the reader knows the word being spoken. t.phonemes and t.durations hold
// the last run's phonemes, one per token id, and their frames.
const KEEP = new RegExp(tokenizerJSON.normalizer.pattern.Regex, 'gu');   // what the tokenizer drops
// The model itself runs in a worker (paradee-worker.js).
function paradeeWorker() {
  const w = new Worker(chrome.runtime.getURL('paradee-worker.bundle.js'));
  const waiting = new Map();
  let next = 0;
  w.onmessage = ({ data }) => {
    const p = waiting.get(data.id);
    waiting.delete(data.id);
    if (p) data.error ? p.reject(new Error(data.error)) : p.resolve(data);
  };
  return (msg) => new Promise((resolve, reject) => {
    const id = next++;
    waiting.set(id, { resolve, reject });
    w.postMessage({ ...msg, id });
  });
}
async function loadParadee() {
  const call = paradeeWorker();
  await call({ type: 'load', url: PARADEE_URL, wasmPaths: chrome.runtime.getURL('vendor/') });
  const tok = new PreTrainedTokenizer(tokenizerJSON, { model_max_length: 512, pad_token: '$', unk_token: '$' });
  const t = new KokoroTTS(null, (phonemes, opts) => {
    const ps = toMisaki(phonemes, t.british);
    t.phonemes = ps.replace(KEEP, '');
    return tok(ps, opts);
  });
  t.british = false;
  // Hindi, French and Spanish voices take eSpeak's phonemes in their own language
  // as training did (espeak-g2p.js), without kokoro-js's English text rules.
  const englishGenerate = t.generate.bind(t);
  t.generate = async (text, opts = {}) => {
    const lang = LANG_OF[(opts.voice || 'af_heart')[0]];
    if (!lang) return englishGenerate(text, opts);
    const ps = await langPhonemes(text, lang);
    t.phonemes = ps.replace(KEEP, '');
    const { input_ids } = tok(ps, { truncation: true });
    return t.generate_from_ids(input_ids, opts);
  };
  t.generate_from_ids = async (ids, { voice: v = 'af_heart' } = {}) => {
    const out = await call({ type: 'run', ids: BigInt64Array.from(ids.data), voice: Math.max(0, PARADEE_VOICES.indexOf(v)) });
    t.durations = out.durations;
    t.phonemes = t.phonemes.slice(0, Math.max(0, t.durations.length - 2));   // the tokenizer cuts at 512 ids
    return new RawAudio(out.waveform, 24000);
  };
  // The phonemes kokoro-js would make for a piece of text, without running the model.
  let caught = '';
  const g2p = new KokoroTTS(null, (phonemes) => { caught = toMisaki(phonemes, t.british).replace(KEEP, ''); return { input_ids: null }; });
  g2p.generate_from_ids = async () => null;
  t.g2p = async (text, v) => {
    const lang = LANG_OF[v[0]];
    if (lang) return (await langPhonemes(text, lang)).replace(KEEP, '');
    await g2p.generate(text, { voice: v }); return caught;
  };
  return t;
}

// Where each word of sentence `text` is spoken: [{ from, to, start, end }], with
// from/to the word's characters in `text` and start/end in seconds of its audio.
async function timeWords(model, text, v) {
  const words = textWords(text), ps = model.phonemes, durations = model.durations;
  if (!words.length || !ps) return [];
  let counts = words.map(() => 1), lens = counts;
  if (phonemeWords(ps).length !== words.length) {
    // A word can be read as several (a number, "U.S.A.") or merged with the next,
    // so phonemize each word on its own to see how much of the sentence it takes.
    counts = []; lens = [];
    for (const w of words) {
      const own = phonemeWords(await model.g2p(w.text, v));
      counts.push(own.length); lens.push(own.reduce((a, p) => a + p.len, 0));
    }
  }
  const times = wordTimes(ps, durations, counts, lens);
  return words.map((w, k) => ({ from: w.from, to: w.to, start: times[k][0], end: times[k][1] }));
}

// One generation at a time, across both models. onnxruntime-web refuses a run
// ("Session already started") while another session's run is in flight, which
// happens when the model is switched with the old model's prefetch still going.
let runQueue = Promise.resolve();
async function synth(i) {
  const g = gen, model = tts;
  // Kokoro here reads English only (kokoro-js has no other voices), so a Hindi,
  // French or Spanish voice picked with Paradee reads with af_heart under Kokoro.
  const v = engine === 'paradee' ? (PARADEE_VOICES.includes(voice) ? voice : 'af_heart')
    : (LANG_OF[voice[0]] ? 'af_heart' : voice);
  const run = runQueue.then(() => {
    if (g !== gen) throw new Error('stale');   // the model was switched while this waited
    if (engine === 'paradee') model.british = v.startsWith('b');
    // Raw model output, untouched. Trimming/normalising the leading and trailing
    // silence was tried and reverted: it made sentence starts and ends sound wrong.
    return model.generate(sentences[i], { voice: v, speed: 1.0 }).then(async (raw) =>
      ({ raw, words: engine === 'paradee' ? await timeWords(model, sentences[i], v).catch(() => []) : [] }));
  });
  runQueue = run.catch(() => {});
  const { raw, words } = await run;
  return { url: URL.createObjectURL(raw.toBlob()), words };
}
function getAudio(i) {
  if (i < 0 || i >= sentences.length) return null;
  if (!cache.has(i)) { const p = synth(i).catch(e => { if (cache.get(i) === p) cache.delete(i); throw e; }); cache.set(i, p); }
  return cache.get(i);
}
// chunk N+1 and N+2 generate while chunk N plays
function prefetch(i) {
  for (const k of [i + 1, i + 2]) if (k < sentences.length && !cache.has(k)) getAudio(k);
  for (const k of [...cache.keys()]) if (k < i - 2) cache.delete(k);
}

async function play(i, resume = true) {
  if (stopped || i < 0 || i >= sentences.length) return;
  current = i;
  const g = gen;
  emit({ type: 'KL_SENTENCE', i, total: sentences.length });
  let url, words;
  try { ({ url, words } = await getAudio(i)); }
  catch (e) { if (g === gen) emit({ type: 'KL_STATUS', text: 'Generation failed: ' + (e.message || e) }); return; }
  if (stopped || current !== i || g !== gen) return;
  audio.src = url;
  audio.playbackRate = speed;
  playing = { i, words }; word = -1;
  if (!resume) { prefetch(i); return; }
  try { await audio.play(); }
  catch (e) { if (e.name === 'NotAllowedError') emit({ type: 'KL_BLOCKED' }); }
  prefetch(i);
}

// Returns a human-readable reason, or null when WebGPU is usable.
async function webgpuProblem() {
  if (!('gpu' in navigator) || !navigator.gpu) {
    return 'This browser can\u2019t run the speech model. It needs WebGPU \u2014 try Chrome, Edge or Arc 113 or newer.';
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return 'This computer can\u2019t run the speech model. Your browser supports WebGPU but no compatible device was available.';
    // presence of an adapter is not enough — the device must actually come up
    const dev = await adapter.requestDevice();
    if (!dev) return 'This computer can\u2019t run the speech model \u2014 graphics acceleration failed to start.';
    return null;
  } catch (e) {
    return 'WebGPU failed to start: ' + (e && e.message ? e.message : e);
  }
}

// Makes `which` the current model, loading it the first time. Both stay in memory
// once loaded, so switching back and forth mid-page is instant after the first time.
// Which model to use. Paradee when it is asked for, and also whenever WebGPU is
// missing: Kokoro cannot run without it, so "no choice made yet" and "Kokoro chosen
// on another computer" both fall back to Paradee instead of failing.
let gpuCheck = null;
async function pickEngine(which) {
  if (which === 'paradee') return 'paradee';
  gpuCheck ??= webgpuProblem();
  return (await gpuCheck) ? 'paradee' : 'kokoro';
}

async function loadModel(which) {
  const want = await pickEngine(which);
  if (want !== engine) { engine = want; tts = null; gen++; cache.clear(); }
  if (!tts && models[engine]) tts = models[engine];
  if (!tts && engine === 'paradee') {
    try { tts = models.paradee = await loadParadee(); }
    catch (e) { emit({ type: 'KL_STATUS', text: 'Model failed: ' + (e.message || e) }); return false; }
  }
  if (!tts) {
    // Hard requirement. There is no usable fallback: q8-on-webgpu is numerically
    // corrupt and every wasm config generates slower than it plays. Check BEFORE
    // downloading ~310MB so an unsupported machine fails in a second, not a minute.
    const why = await webgpuProblem();
    if (why) { emit({ type: 'KL_UNSUPPORTED', reason: why }); return false; }
    // transformers.js reports 'download' and 'progress' even when it is reading the
    // model from its cache, so ask the cache directly and only show progress on a
    // genuine first-run download.
    let cached = false;
    try {
      const c = await caches.open('transformers-cache');
      cached = (await c.keys()).some(r => r.url.includes(MODEL) && /onnx\/model[^/]*\.onnx$/.test(r.url));
    } catch (e) { /* no Cache API: treat as a first run */ }
    if (!cached) emit({ type: 'KL_STATUS', text: 'First run: downloading voice (~310 MB, one time)…', busy: true });
    try {
      tts = models.kokoro = await KokoroTTS.from_pretrained(MODEL, {
        dtype: DTYPE, device: DEVICE,
        progress_callback: (p) => {
          if (!cached && p.status === 'progress' && p.progress != null)
            emit({ type: 'KL_STATUS', text: `Downloading model ${Math.round(p.progress)}%`, busy: true });
        }
      });
    } catch (e) { emit({ type: 'KL_STATUS', text: 'Model failed: ' + (e.message || e) }); return false; }
  }
  return true;
}

// The popup changed the model or voice while a page is being read: regenerate
// from the current sentence with the new one, keeping play/pause as it was.
async function switchModel(d) {
  const want = await pickEngine(d.engine);
  const voiceChanged = !!d.voice && d.voice !== voice;
  voice = d.voice || voice;
  if (want === engine && !voiceChanged) return;
  const resume = !audio.paused;
  audio.pause();
  gen++; cache.clear();
  if (!await loadModel(want)) return;
  if (!stopped && sentences.length) play(current, resume);
}

async function init(payload) {
  sentences = payload.sentences || [];
  voice = payload.voice || voice;
  speed = payload.speed || speed;
  if (!sentences.length) { emit({ type: 'KL_STATUS', text: 'No readable text found.' }); return; }
  if (!await loadModel(payload.engine)) return;
  stopped = false;
  emit({ type: 'KL_FIRST' });
  play(payload.start || 0);
}

document.addEventListener('DOMContentLoaded', () => {
  audio = document.getElementById('audio');
  audio.addEventListener('ended', () => { word = -1; emit({ type: 'KL_WORD', i: playing.i, from: -1 }); if (!stopped) play(current + 1); });
  setInterval(() => { if (!audio.paused) tick(); }, 20);
  audio.addEventListener('seeked', tick);
  audio.addEventListener('play',  () => emit({ type: 'KL_PLAYING', playing: true }));
  audio.addEventListener('pause', () => { if (!audio.ended) emit({ type: 'KL_PLAYING', playing: false }); });

  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || typeof d !== 'object') return;
    switch (d.type) {
      case 'KL_INIT':   init(d); break;
      case 'KL_TOGGLE': audio.paused ? audio.play().catch(()=>{}) : audio.pause(); break;
      case 'KL_NEXT':   play(current + 1); break;
      case 'KL_PREV':   play(current - 1); break;
      case 'KL_GOTO':   play(d.i); break;
      case 'KL_SPEED':  speed = d.speed; audio.playbackRate = speed; break;
      case 'KL_VOICE':  voice = d.voice; cache.clear(); play(current); break;
      case 'KL_MODEL':  switchModel(d); break;
      case 'KL_STOP':   stopped = true; audio.pause(); audio.src = ''; break;
    }
  });
  emit({ type: 'KL_READY' });
});
