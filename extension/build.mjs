import * as esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';

// The ONNX Runtime WebGPU binaries are ~21MB and come from npm, so they are not
// committed. Stage them into ext/vendor on every build so a fresh clone can
// load-unpacked immediately after `npm install && node build.mjs`.
const VENDOR = 'ext/vendor';
fs.mkdirSync(VENDOR, { recursive: true });
for (const f of ['ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.jsep.mjs']) {
  const src = path.join('node_modules/onnxruntime-web/dist', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(VENDOR, f));
}

// Paradee (the small distilled model) is built by ../research/scripts/export_paradee.py,
// which is not in git either. Stage the int8 export when it is there.
const PARADEE = '../research/models/paradee/paradee_int8.onnx';
fs.mkdirSync('ext/paradee', { recursive: true });
if (fs.existsSync(PARADEE)) fs.copyFileSync(PARADEE, 'ext/paradee/paradee.onnx');
else if (!fs.existsSync('ext/paradee/paradee.onnx')) console.warn('Paradee model missing: run research/scripts/export_paradee.py');

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
