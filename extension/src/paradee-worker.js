// Runs the Paradee model off the engine page's main thread. On the CPU (wasm) a
// sentence takes a moment to make, and the next ones are made while one plays;
// on the main thread that froze the word highlight until each one was done.
//
// It also turns text into phonemes for both models (Paradee and Kokoro): English
// with misaki's rules and dictionaries (misaki-en.js), Hindi, French and Spanish
// with Paradee's own G2P (paradee-g2p.js). Each part loads the first time it is needed.
import * as ort from 'onnxruntime-web';
import { DURATIONS, withOutput } from './wordtimes.js';
import { ParadeeG2P } from './paradee-g2p.js';
import { MisakiEnglish, englishFallback } from './misaki-en.js';

let session = null, g2p = null;
const english = {};
const json = (url) => fetch(url).then((r) => r.json());

function loadG2P(base) {
  return g2p ??= (async () => {
    const [model, data] = await Promise.all([fetch(base + 'g2p/g2p.onnx').then((r) => r.arrayBuffer()), json(base + 'g2p/g2p.json')]);
    return ParadeeG2P.create(ort, new Uint8Array(model), data);
  })();
}
function loadEnglish(base, lang) {
  return english[lang] ??= (async () => {
    const key = lang === 'en-gb' ? 'gb' : 'us', british = key === 'gb';
    const [gold, silver, tags, own] = await Promise.all([json(`${base}misaki/${key}_gold.json`), json(`${base}misaki/${key}_silver.json`),
      json(base + 'g2p/en-tags.json'), loadG2P(base)]);
    const data = { gold, silver };
    const plain = new MisakiEnglish(british, data, tags);   // reads the digits inside words misaki doesn't know
    return new MisakiEnglish(british, data, tags, englishFallback(own, british, plain));
  })();
}

self.onmessage = async ({ data: d }) => {
  try {
    if (d.wasmPaths) ort.env.wasm.wasmPaths = d.wasmPaths;
    if (d.type === 'load') {
      const bytes = new Uint8Array(await (await fetch(d.url)).arrayBuffer());
      session = await ort.InferenceSession.create(withOutput(bytes, DURATIONS), { executionProviders: ['wasm'] });
      self.postMessage({ id: d.id });
    } else if (d.type === 'run') {
      const out = await session.run({
        input_ids: new ort.Tensor('int64', d.ids, [1, d.ids.length]),
        speed: new ort.Tensor('float32', new Float32Array([1]), [1]),
        voice: new ort.Tensor('int64', BigInt64Array.from([BigInt(d.voice)]), [1]),
      });
      const waveform = out.waveform.data, durations = Float32Array.from(out[DURATIONS].data);
      self.postMessage({ id: d.id, waveform, durations }, [waveform.buffer, durations.buffer]);
    } else if (d.type === 'phonemize') {
      const phonemes = d.lang.startsWith('en') ? await (await loadEnglish(d.dataUrl, d.lang)).phonemize(d.text)
        : await (await loadG2P(d.dataUrl)).phonemize(d.text, d.lang);
      self.postMessage({ id: d.id, phonemes });
    }
  } catch (e) {
    self.postMessage({ id: d.id, error: String(e && e.message || e) });
  }
};
