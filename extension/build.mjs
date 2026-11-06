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

// Paradee (the small distilled model) ships inside the extension. Fetch the exact v1.3 file
// from the Hugging Face Hub, pinned by its hash, so the extension always carries the
// published model. A Hugging Face login (HF_TOKEN, or `hf auth login`) is only needed
// while the model repo is private.
const PARADEE_URL = 'https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.3/resolve/v1.3/onnx/paradee_int8.onnx';
const PARADEE_SHA256 = 'f68ed87562d040693dd0dd34e99c11b35ca24294e2149b840503bd1f25a2199f';
const PARADEE_OUT = 'ext/paradee/paradee.onnx';
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
fs.mkdirSync('ext/paradee', { recursive: true });
if (!fs.existsSync(PARADEE_OUT) || sha256(fs.readFileSync(PARADEE_OUT)) !== PARADEE_SHA256) {
  const tokenFile = path.join(process.env.HOME || '', '.cache/huggingface/token');   // written by `hf auth login`
  const token = process.env.HF_TOKEN || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8').trim() : '');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(PARADEE_URL, { headers });
  if (!res.ok) throw new Error(`Paradee download failed: HTTP ${res.status} from ${PARADEE_URL}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (sha256(buf) !== PARADEE_SHA256) throw new Error('Paradee download does not match the pinned v1.3 hash');
  fs.writeFileSync(PARADEE_OUT, buf);
  console.log(`fetched Paradee v1.3 (${(buf.length / 1e6).toFixed(1)} MB)`);
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

// The phonemizer package's eSpeak carries only the English dictionary and accepts
// only English voices. Paradee's Hindi, French and Spanish voices need eSpeak in
// those languages, so let it accept them, and hand the engine eSpeak's file
// system so it can add their dictionaries (ext/espeak/, from eSpeak NG 1.52).
const PHONEMIZER_LANGS = {
  name: 'phonemizer-langs',
  setup(build) {
    build.onLoad({ filter: /phonemizer[\/]dist[\/]phonemizer\.js$/ }, (args) => {
      let js = fs.readFileSync(args.path, 'utf8');
      const swap = (from, to) => {
        if (!js.includes(from)) throw new Error(`phonemizer patch: "${from}" not found (package changed?)`);
        js = js.split(from).join(to);
      };
      swap('ke=["en"]', 'ke=["en","hi","fr","es"]');
      swap('A.FS_createDataFile=U.createDataFile,', 'A.FS_createDataFile=U.createDataFile,globalThis.__espeakFS=U,');
      return { contents: js, loader: 'js' };
    });
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
  plugins: [stubNodeBuiltins, PHONEMIZER_LANGS],
  logLevel: 'warning',
  legalComments: 'none'
});
// Paradee runs in a worker of its own (src/paradee-worker.js).
await esbuild.build({
  entryPoints: ['src/paradee-worker.js'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  minify: true,
  outfile: 'ext/paradee-worker.bundle.js',
  plugins: [stubNodeBuiltins],
  logLevel: 'warning',
  legalComments: 'none'
});
console.log('built ext/engine.bundle.js and ext/paradee-worker.bundle.js');
