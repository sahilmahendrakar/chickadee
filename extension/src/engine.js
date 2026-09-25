// Headless TTS engine. Lives in a hidden iframe (an extension page, so it gets
// the bundled ONNX runtime and WebGPU). It owns the model and the <audio>
// element; the content script owns all visible UI and on-page highlighting.
import { KokoroTTS } from 'kokoro-js';
import { env, PreTrainedTokenizer, RawAudio } from '@huggingface/transformers';
import * as ort from 'onnxruntime-web';
import tokenizerJSON from './paradee-tokenizer.json';
import { toMisaki } from './misaki.js';

env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('vendor/');
env.allowLocalModels = false;

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DTYPE = 'fp32';     // q8 on webgpu is numerically corrupt; wasm is sub-realtime
const DEVICE = 'webgpu';

// Paradee: an 8M-parameter single-voice model distilled from Kokoro (af_heart).
// It ships inside the extension (~13 MB, int8 weights) and runs on the CPU
// (wasm), so it needs no WebGPU and no download.
const PARADEE_URL = chrome.runtime.getURL('paradee/paradee.onnx');

let models = {}, tts = null, engine = 'kokoro', gen = 0, sentences = [], cache = new Map();
let current = 0, stopped = false, voice = 'af_heart', speed = 1.0;
let audio;

const emit = (msg) => parent.postMessage(msg, '*');

// Reuses kokoro-js for text -> phonemes -> token ids and swaps in Paradee for
// the model call. Paradee has one voice, so the voice setting does not apply.
async function loadParadee() {
  const session = await ort.InferenceSession.create(PARADEE_URL, { executionProviders: ['wasm'] });
  const tok = new PreTrainedTokenizer(tokenizerJSON, { model_max_length: 512, pad_token: '$', unk_token: '$' });
  const t = new KokoroTTS(null, (phonemes, opts) => tok(toMisaki(phonemes), opts));
  t.generate_from_ids = async (ids) => {
    const { waveform } = await session.run({
      input_ids: new ort.Tensor('int64', ids.data, ids.dims),
      speed: new ort.Tensor('float32', new Float32Array([1]), [1]),
    });
    return new RawAudio(waveform.data, 24000);
  };
  return t;
}

// One generation at a time, across both models. onnxruntime-web refuses a run
// ("Session already started") while another session's run is in flight, which
// happens when the model is switched with the old model's prefetch still going.
let runQueue = Promise.resolve();
async function synth(i) {
  const g = gen, model = tts, v = engine === 'paradee' ? 'af_heart' : voice;
  const run = runQueue.then(() => {
    if (g !== gen) throw new Error('stale');   // the model was switched while this waited
    // Raw model output, untouched. Trimming/normalising the leading and trailing
    // silence was tried and reverted: it made sentence starts and ends sound wrong.
    return model.generate(sentences[i], { voice: v, speed: 1.0 });
  });
  runQueue = run.catch(() => {});
  const raw = await run;
  return URL.createObjectURL(raw.toBlob());
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
  let url;
  try { url = await getAudio(i); }
  catch (e) { if (g === gen) emit({ type: 'KL_STATUS', text: 'Generation failed: ' + (e.message || e) }); return; }
  if (stopped || current !== i || g !== gen) return;
  audio.src = url;
  audio.playbackRate = speed;
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
async function loadModel(which) {
  const want = which === 'paradee' ? 'paradee' : 'kokoro';
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
  const want = d.engine === 'paradee' ? 'paradee' : 'kokoro';
  const voiceChanged = !!d.voice && d.voice !== voice;
  voice = d.voice || voice;
  if (want === engine && !(voiceChanged && engine === 'kokoro')) return;
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
  audio.addEventListener('ended', () => { if (!stopped) play(current + 1); });
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
