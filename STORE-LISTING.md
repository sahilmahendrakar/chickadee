# Chrome Web Store listing — draft copy

## Name
Chickadee

## Short description (max 132 chars)
Reads any web page aloud in a natural voice. Runs entirely on your machine — no
account, no API key, nothing uploaded.

## Source code
https://github.com/sahilmahendrakar/chickadee  (Apache-2.0)

## Category
Accessibility  (alternative: Productivity)

## Single purpose (required field)
Chickadee converts the text of the web page the user is viewing into speech and
plays it back, highlighting each sentence as it is read.

## Permission justifications (required, one per permission)

**activeTab**
The extension's sole function is reading aloud the page the user is on. activeTab
gives it access to that one tab only, and only after an explicit user gesture: the
toolbar button, the Alt+R shortcut, or the "Read aloud from here" context-menu item.
It is never injected ahead of time and has no access to any other tab. No page
content leaves the device.

**scripting**
Used to inject the reader into the current tab, on demand, when the user starts it.

**storage**
Stores only the user's chosen voice and default playback speed.

**contextMenus**
Adds a single "Read aloud from here" item so the user can start reading from a
specific point in the page instead of the top.

**Remote code**
None. The speech engine (ONNX Runtime + kokoro-js) is bundled in the package. The
only network request is a one-time download of a static, public model file from
Hugging Face; it is data consumed by the bundled runtime, not executable code.

## Full description

Chickadee reads any web page aloud in a natural, human-sounding voice, and it does it entirely on your own computer. Nothing you read is ever uploaded, and there is no account, no subscription and no API key.

Open an article and press Alt+R, or click the Chickadee button, and it starts reading from the top, highlighting each sentence on the page itself as it goes. Right-click any sentence and choose "Read aloud from here" to start partway through. A small floating bar lets you pause, step back and forth between sentences, and change the speed from 0.9x to 2x. Alt+P plays and pauses. Both shortcuts can be changed from the popup if you'd rather use other keys.

Most read-aloud tools send your page text to a server to generate the speech. Chickadee runs the speech model directly in your browser, so the words never leave your machine. On computers with WebGPU it uses Kokoro, with twelve voices to choose from, American and British. On computers without it, Chickadee uses Paradee, a small voice built into the extension, so it works on any computer.

With Kokoro, Chickadee downloads the voice model once on first use (about 310 MB) and then works offline: on a plane, in a tunnel, anywhere. Paradee needs no download at all.

Chickadee collects nothing and sends nothing. No analytics, no telemetry, no server. It is open source under the Apache 2.0 licence: https://github.com/sahilmahendrakar/chickadee

## Screenshots needed (1280x800 or 640x400, up to 5)
1. An article mid-read with a sentence highlighted and the floating bar visible
2. The right-click menu showing "Read aloud from here"
3. The settings popup with the voice list open
4. A dark-themed page being read (shows the adaptive highlight)
5. Optional: the first-run download notice
