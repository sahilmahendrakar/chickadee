# Chickadee

Reads any article aloud with Kokoro-82M running **entirely in the browser**.
No server, no account, no API key, no local process.

Load unpacked from `ext/` at `chrome://extensions` (Developer mode).

## How it works
- **`ext/content.js`** — walks the live DOM, builds a `Range` per sentence, and paints
  the current one with the **CSS Custom Highlight API**. This never mutates the page,
  so site layout and the site's own JavaScript are untouched. Also draws the floating
  control bar.
- **`ext/engine.html` + `engine.bundle.js`** — a hidden iframe holding the model and the
  `<audio>` element. Extension page, so it gets the bundled ONNX runtime and WebGPU.
- **`ext/background.js`** — routes the Alt+R / Alt+P commands and the toolbar click.
- Sentence N+1 and N+2 generate while N plays (prefetch), so playback never waits.

## Config, and why
`fp32` on `webgpu`, model `onnx-community/Kokoro-82M-v1.0-ONNX`. Measured alternatives:
q8-on-webgpu is **numerically corrupt** (garbled audio, 0.19x realtime) and every wasm
config is **below realtime**. See ../SPIKE-in-browser.md. Do not "optimize" to q8.

## Requirements
- **WebGPU.** There is no working fallback; wasm generates slower than it plays.
- ~310 MB model downloaded on first run, then cached (quota measured at 10 GB, so
  space is not a constraint). A failed download caches nothing and restarts.

## Build
    npm install
    node build.mjs        # bundles src/engine.js -> ext/engine.bundle.js

`build.mjs` redirects every Node-only import (fs, path, fs/promises, sharp,
onnxruntime-node) to an empty stub. Marking them `--external` instead leaves a bare
`require()` that throws `Dynamic require of "path" is not supported` at load.

## Permissions: activeTab only
There is no host permission and no static content script. Every entry point (toolbar
popup, Alt+R / Alt+P commands, the context-menu item) is a user gesture that grants
`activeTab` for that tab, and `background.js` injects `content.js` on demand. The grant
survives tab switches (reading continues in the background) and ends when the tab
navigates. One consequence: on a page the reader has never run on, "Read aloud from
here" cannot know where the right-click landed (Chrome exposes no coordinates and the
listener did not exist yet), so it starts at the first sentence in view instead.

## Gotcha: reloading during development
`chrome.developerPrivate.reload` (and the reload button) refreshes code but **does not
re-read manifest.json**. After changing the manifest you must fully uninstall and
load-unpacked again, or web_accessible_resources changes silently do nothing and the
engine iframe fails as `chrome-extension://invalid/`.

## Controls
- **Alt+R** — read the page from the top
- **Alt+P** — play / pause
- **Right-click any word -> "Read aloud from here"** — starts from that sentence,
  whether or not the reader is already running
- Floating bar: prev, play/pause, next, speed, stop

## Things that were tried and reverted
- **Per-word highlighting.** Kokoro emits no word timings, so words were spread across
  each sentence's measured duration weighted by letter count. It drifted audibly
  mid-sentence. Real word sync needs forced alignment.
- **Silence trimming.** Kokoro pads ~310ms in front and ~490ms behind every utterance
  (measured), so back-to-back sentences had ~800ms of dead air. Trimming it, and later
  normalising it to a fixed 120/260ms, both made sentence starts and ends sound wrong.
  Reverted to raw model output.
- **Hover play button per paragraph.** Replaced by the right-click menu.

## Known gaps
- Sentence-level highlighting only. Per-word was implemented by distributing words
  across each sentence's duration weighted by length; it drifted noticeably mid-sentence
  and was removed. Real word timing needs forced alignment.
- Autoplay: if the browser blocks playback without a user gesture the bar shows
  "press play". Clicking play is a gesture and works.
- The engine iframe must be rendered (1px, opacity 0) — a `display:none` frame never
  initialises its media pipeline and `<audio>` stalls at readyState 0.
