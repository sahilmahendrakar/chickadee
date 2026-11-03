// Runs the Paradee model off the engine page's main thread. On the CPU (wasm) a
// sentence takes a moment to make, and the next ones are made while one plays;
// on the main thread that froze the word highlight until each one was done.
import * as ort from 'onnxruntime-web';
import { DURATIONS, withOutput } from './wordtimes.js';

let session = null;
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
    }
  } catch (e) {
    self.postMessage({ id: d.id, error: String(e && e.message || e) });
  }
};
