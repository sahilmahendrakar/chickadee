// Runs the Paradee model off the engine page's main thread. On the CPU (wasm) a
// sentence takes a moment to make, and the next ones are made while one plays;
// on the main thread that froze the word highlight until each one was done.
// It also turns Hindi, French and Spanish text into phonemes (paradee-g2p.js),
// with a small model of its own that is loaded the first time it is needed.
import * as ort from 'onnxruntime-web';
import { DURATIONS, withOutput } from './wordtimes.js';
import { ParadeeG2P } from './paradee-g2p.js';

let session = null, g2p = null;
self.onmessage = async ({ data: d }) => {
  try {
    if (d.type === 'load') {
      ort.env.wasm.wasmPaths = d.wasmPaths;
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
      g2p ??= (async () => {
        const [model, data] = await Promise.all([
          fetch(d.g2pUrl + 'g2p.onnx').then((r) => r.arrayBuffer()),
          fetch(d.g2pUrl + 'g2p.json').then((r) => r.json()),
        ]);
        return ParadeeG2P.create(ort, new Uint8Array(model), data);
      })();
      self.postMessage({ id: d.id, phonemes: await (await g2p).phonemize(d.text, d.lang) });
    }
  } catch (e) {
    self.postMessage({ id: d.id, error: String(e && e.message || e) });
  }
};
