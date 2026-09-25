import * as esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

// The ONNX Runtime WebGPU binaries are ~21MB and come from npm, so they are not
// committed. Stage them into ext/vendor on every build so a fresh clone can
// load-unpacked immediately after `npm install && node build.mjs`.
const VENDOR = 'ext/vendor';
fs.mkdirSync(VENDOR, { recursive: true });
for (const f of ['ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.jsep.mjs']) {
  const src = path.join('node_modules/onnxruntime-web/dist', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(VENDOR, f));
}

// Paradee (the small distilled model) ships inside the extension. Fetch the exact v1.0 file
// from the Hugging Face Hub, pinned by its hash, so the extension always carries the
// published model. HF_TOKEN is only needed while the model repo is private.
const PARADEE_URL = 'https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.0/resolve/v1.0/onnx/paradee_int8.onnx';
const PARADEE_SHA256 = '60e8f8a1bc7c546488154e9d99ecac6e9c50baf3f4b684c5b0de48ea03b698eb';
const PARADEE_OUT = 'ext/paradee/paradee.onnx';
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
fs.mkdirSync('ext/paradee', { recursive: true });
if (!fs.existsSync(PARADEE_OUT) || sha256(fs.readFileSync(PARADEE_OUT)) !== PARADEE_SHA256) {
  const headers = process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {};
  const res = await fetch(PARADEE_URL, { headers });
  if (!res.ok) throw new Error(`Paradee download failed: HTTP ${res.status} from ${PARADEE_URL}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (sha256(buf) !== PARADEE_SHA256) throw new Error('Paradee download does not match the pinned v1.0 hash');
  fs.writeFileSync(PARADEE_OUT, buf);
  console.log(`fetched Paradee v1.0 (${(buf.length / 1e6).toFixed(1)} MB)`);
}

// transformers.js and kokoro-js both carry Node-only code paths (fs, path,
// fs/promises, sharp, onnxruntime-node). They are guarded by env.IS_NODE and
// never execute in a browser, but esbuild still has to resolve them. Marking
// them --external leaves a bare require() that throws at load time, so we
// redirect every one of them to a single empty module instead.
const NODE_ONLY = /^(node:)?(fs|path|url|module|os|crypto|stream|util|worker_threads|child_process)(\/.*)?$|^sharp$|^onnxruntime-node$/;

const stubNodeBuiltins = {
  name: 'stub-node-builtins',
  setup(build) {
    build.onResolve({ filter: NODE_ONLY }, (args) => ({
      path: path.resolve('src/stubs/empty.js')
    }));
  }
};

await esbuild.build({
  entryPoints: ['src/engine.js'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  minify: true,
  outfile: 'ext/engine.bundle.js',
  plugins: [stubNodeBuiltins],
  logLevel: 'warning',
  legalComments: 'none'
});
console.log('built ext/engine.bundle.js');
