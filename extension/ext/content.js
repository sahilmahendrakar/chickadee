// Highlights the REAL page text as it is read. No reader panel, no copy of the
// article — we build Ranges over the live DOM and paint them with the CSS Custom
// Highlight API, which never mutates the document (so page layout and the site's
// own JavaScript are untouched).
(() => {
  if (window.__kokoroLocal) return;
  window.__kokoroLocal = true;

  const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','NAV','HEADER','FOOTER','ASIDE',
                        'FORM','BUTTON','SELECT','TEXTAREA','CODE','PRE','SVG']);
  const HL_SENT = 'kokoro-sentence';
  let sentences = [];      // [{ text, range, block }]
  let onReadyCb = null;
  let frame = null, bar = null, playing = false, curIdx = -1;

  /* ---------- collect sentences as live-DOM ranges ---------- */
  function pickRoot() {
    const cands = [document.querySelector('article'), document.querySelector('main'),
                   document.querySelector('[role="main"]'), document.body].filter(Boolean);
    let best = document.body, bestLen = 0;
    for (const c of cands) {
      const len = (c.innerText || '').trim().length;
      // prefer a tighter container, but only if it still holds most of the text
      if (len > bestLen * 1.05) { best = c; bestLen = len; }
    }
    return best;
  }
  function visible(el) {
    if (!el) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }
  function collect() {
    const root = pickRoot();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        for (let p = n.parentElement; p && p !== root.parentElement; p = p.parentElement) {
          if (SKIP.has(p.tagName)) return NodeFilter.FILTER_REJECT;
          if (p.id && String(p.id).startsWith('kokoro-')) return NodeFilter.FILTER_REJECT;
        }
        if (!visible(n.parentElement)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    // Flatten every text node into one string, remembering where each node starts,
    // so a sentence that spans <em>/<a> boundaries still becomes one Range.
    const segs = [];
    let full = '';
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.nodeValue.replace(/\s+/g, ' ');
      if (!t.trim()) continue;
      segs.push({ node: n, start: full.length, len: t.length });
      full += t;
      if (!/\s$/.test(t)) full += ' ', segs[segs.length - 1].pad = 1;
    }
    const locate = (off) => {
      let lo = 0, hi = segs.length - 1, s = segs[0];
      while (lo <= hi) {
        const mid = (lo + hi) >> 1, g = segs[mid];
        if (off < g.start) hi = mid - 1;
        else if (off >= g.start + g.len) { lo = mid + 1; s = g; }
        else return { node: g.node, offset: off - g.start };
      }
      return { node: s.node, offset: Math.min(s.len, Math.max(0, off - s.start)) };
    };

    const ABBR = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|al|Inc|Ltd|Co|Fig|No|pp)\.$/i;
    const out = [];
    let start = 0;
    const push = (from, to) => {
      const text = full.slice(from, to).trim();
      if (text.length < 2) return;
      const a = locate(from + (full.slice(from, to).match(/^\s*/) || [''])[0].length);
      const b = locate(Math.max(from, to - 1));
      const r = document.createRange();
      try {
        r.setStart(a.node, Math.min(a.offset, a.node.nodeValue.length));
        r.setEnd(b.node, Math.min(b.offset + 1, b.node.nodeValue.length));
      } catch (e) { return; }
      out.push({ text, range: r });
    };
    const re = /[.!?]["')\]]?(\s|$)/g;
    let m;
    while ((m = re.exec(full))) {
      const end = m.index + m[0].length;
      if (ABBR.test(full.slice(start, m.index + 1))) continue;
      if (end - start > 3) { push(start, end); start = end; }
    }
    if (full.length - start > 3) push(start, full.length);

    // Kokoro's context is ~510 tokens; split anything oversized on a comma.
    const MAX = 380, final = [];
    for (const s of out) {
      if (s.text.length <= MAX) { final.push(s); continue; }
      final.push(s); // range stays whole; engine receives the trimmed text
    }
    return final;
  }

  /* ---------- painting ---------- */
  // Pick highlight colours from the PAGE's own background, not the user's OS theme.
  // prefers-color-scheme is the wrong signal: a dark site in light mode got the light
  // highlight, and since ::highlight() only overrode background-color the page's light
  // text stayed light — pale blue block, cream text, unreadable.
  // We always set BOTH background and colour so contrast can't depend on the page.
  function pageLuminance() {
    const seen = [document.body, document.documentElement];
    for (const el of seen) {
      if (!el) continue;
      const bg = getComputedStyle(el).backgroundColor || '';
      const m = bg.match(/rgba?\(([^)]+)\)/);
      if (!m) continue;
      const parts = m[1].split(',').map(x => parseFloat(x));
      const [r, g, b] = parts;
      const alpha = parts.length > 3 ? parts[3] : 1;
      if (alpha === 0) continue;                 // transparent: keep looking
      // relative luminance, sRGB weights
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }
    return 1;                                     // nothing set: assume a white page
  }
  function ensureStyle() {
    const dark = pageLuminance() < 0.5;
    // Blue rather than the brand teal/green: this sits on other people's pages for
    // long stretches, and blue is the universal "selected text" convention, so it
    // reads as active without looking like a diff or a brand overlay.
    // Contrast: 12.2:1 light, 6.5:1 dark — both well past WCAG AA.
    const bg = dark ? '#2f5f9e' : '#cfe4ff';
    const fg = dark ? '#ffffff' : '#0b2340';
    const prev = document.getElementById('kokoro-hl-style');
    if (prev && prev.dataset.dark === String(dark)) return;
    if (prev) prev.remove();
    const st = document.createElement('style');
    st.id = 'kokoro-hl-style';
    st.dataset.dark = String(dark);
    st.textContent = `::highlight(${HL_SENT}) { background-color: ${bg}; color: ${fg}; }`;
    document.documentElement.appendChild(st);
  }
  function paint(i) {
    if (!window.CSS || !CSS.highlights) return;
    const s = sentences[i];
    if (!s) return;
    CSS.highlights.set(HL_SENT, new Highlight(s.range));
    const rect = s.range.getBoundingClientRect();
    if (rect.height && (rect.top < 60 || rect.bottom > innerHeight - 60)) {
      const y = scrollY + rect.top - innerHeight / 2 + rect.height / 2;
      scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
  }
  function clearPaint() { if (window.CSS && CSS.highlights) CSS.highlights.delete(HL_SENT); }

  /* ---------- floating control bar ---------- */
  function mkBtn(label, title, fn) {
    const b = document.createElement('button');
    b.textContent = label; b.title = title;
    b.style.cssText = 'all:unset;cursor:pointer;padding:5px 9px;border-radius:999px;color:#fff;line-height:1;font-size:14px;';
    b.onmouseenter = () => b.style.background = 'rgba(255,255,255,.16)';
    b.onmouseleave = () => b.style.background = 'transparent';
    b.onclick = (e) => { e.stopPropagation(); fn(); };
    return b;
  }
  function makeBar() {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'kokoro-bar';
    bar.style.cssText = 'position:fixed;bottom:22px;left:50%;transform:translateX(-50%);' +
      'z-index:2147483647;display:flex;align-items:center;gap:2px;padding:7px 10px;' +
      'border-radius:999px;background:#1c1c1e;color:#fff;box-shadow:0 6px 22px rgba(0,0,0,.35);' +
      'font:13px -apple-system,system-ui,sans-serif;';
    const status = document.createElement('span');
    status.id = 'kokoro-status';
    // Only surfaces the first-run model download and hard errors. Stays hidden
    // during normal playback so the bar is just: prev, play/pause, next, speed, stop.
    status.style.cssText = 'padding:0 8px;color:#aaa;font-size:12px;white-space:nowrap;display:none;';
    const playBtn = mkBtn('❚❚', 'Play / pause', () => send({ type: 'KL_TOGGLE' }));
    playBtn.id = 'kokoro-play';
    const speed = document.createElement('select');
    speed.style.cssText = 'all:unset;cursor:pointer;color:#fff;font-size:12px;padding:0 4px;';
    [['0.9','0.9x'],['1','1x'],['1.25','1.25x'],['1.5','1.5x'],['1.75','1.75x'],['2','2x']]
      .forEach(([v,t]) => { const o=document.createElement('option'); o.value=v; o.textContent=t;
        o.style.color='#000'; if(v==='1') o.selected=true; speed.appendChild(o); });
    speed.onchange = (e) => send({ type: 'KL_SPEED', speed: parseFloat(e.target.value) });
    const grip = document.createElement('span');
    grip.title = 'Drag to move';
    grip.textContent = '⠿';
    grip.style.cssText = 'cursor:grab;color:#777;font-size:13px;padding:0 4px 0 2px;user-select:none;';
    bar.append(
      grip,
      mkBtn('‹', 'Previous sentence', () => send({ type: 'KL_PREV' })),
      playBtn,
      mkBtn('›', 'Next sentence', () => send({ type: 'KL_NEXT' })),
      speed, status,
      mkBtn('✕', 'Stop', stop)
    );
    document.body.appendChild(bar);
    makeDraggable(bar);
    return bar;
  }
  // The bar can be dragged anywhere by its grip or its background (not the
  // controls). It starts bottom-centre; once moved it is pinned by left/top and
  // the spot is remembered per device, clamped to the viewport on restore.
  function placeBar(x, y) {
    const w = bar.offsetWidth, h = bar.offsetHeight;
    x = Math.min(Math.max(0, x), Math.max(0, innerWidth - w));
    y = Math.min(Math.max(0, y), Math.max(0, innerHeight - h));
    bar.style.transform = 'none'; bar.style.bottom = 'auto';
    bar.style.left = x + 'px'; bar.style.top = y + 'px';
  }
  function makeDraggable(el) {
    chrome.storage.local.get({ barPos: null }, ({ barPos }) => {
      if (barPos && bar === el) placeBar(barPos.x, barPos.y);
    });
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button,select')) return;
      const r = el.getBoundingClientRect();
      drag = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;   // a click, not a drag
      drag.moved = true;
      el.style.cursor = 'grabbing';
      placeBar(drag.ox + dx, drag.oy + dy);
    });
    const end = (e) => {
      if (!drag) return;
      if (drag.moved) {
        const r = el.getBoundingClientRect();
        chrome.storage.local.set({ barPos: { x: r.left, y: r.top } });
      }
      drag = null; el.style.cursor = '';
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  function keepInView() {
    if (bar && bar.style.top && bar.style.top !== 'auto')
      placeBar(parseFloat(bar.style.left), parseFloat(bar.style.top));
  }
  addEventListener('resize', keepInView);
  function setStatus(t) {
    const e = document.getElementById('kokoro-status');
    if (!e) return;
    e.textContent = t || '';
    e.style.display = t ? '' : 'none';
    keepInView();                        // the text can widen a bar parked near an edge
  }
  function setPlay(p) { playing = p; const e = document.getElementById('kokoro-play'); if (e) e.textContent = p ? '❚❚' : '▶'; }

  /* ---------- geometry: map a screen point to a sentence ---------- */
  // Rectangles, not text offsets. caretRangeFromPoint + Range.comparePoint drifted
  // (two points on one line resolved to different sentences) because the flattened
  // text offsets don't line up with node boundaries. Boxes can't drift.
  let boxes = [];   // per sentence: [{l,t,r,b}] in document coordinates
  function cacheBoxes() {
    boxes = sentences.map(s => {
      const out = [];
      for (const r of s.range.getClientRects()) {
        if (!r.width || !r.height) continue;
        out.push({ l: r.left + scrollX, t: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY });
      }
      return out;
    });
  }
  // Takes DOCUMENT coordinates, not viewport. The right-click may be resolved
  // much later (first run waits on a ~310MB model download) and by then the page
  // has auto-scrolled to follow playback, so viewport coords would be stale.
  function sentenceAtPoint(x, y) {
    for (let i = 0; i < boxes.length; i++)
      for (const bx of boxes[i])
        if (x >= bx.l && x <= bx.r && y >= bx.t && y <= bx.b) return i;
    return -1;
  }

  /* ---------- right-click "read from here" ---------- */
  // The context menu API gives no coordinates, so remember where the last
  // right-click landed and resolve it to a sentence when the item is chosen.
  let lastPoint = null;
  document.addEventListener('contextmenu', (e) => {
    lastPoint = { x: e.clientX + scrollX, y: e.clientY + scrollY };   // document coords
  }, true);

  // The reader is injected on demand (activeTab), so on a page it has never run on
  // the right-click that opened the menu happened before this listener existed and
  // the point is unknown. Start at the first sentence in view instead: the click was
  // in the viewport, so this lands within a paragraph or two of it.
  function firstVisibleSentence() {
    const top = scrollY + 8, bottom = scrollY + innerHeight;
    for (let i = 0; i < boxes.length; i++)
      for (const bx of boxes[i]) if (bx.b > top && bx.t < bottom) return i;
    return 0;
  }
  function resolvePoint(pt) {
    const i = pt ? sentenceAtPoint(pt.x, pt.y) : -1;
    return i >= 0 ? i : firstVisibleSentence();
  }
  function readFromPoint() {
    if (!sentences.length || !boxes.length) {      // reader not started yet
      const pending = lastPoint;
      start(() => send({ type: 'KL_GOTO', i: resolvePoint(pending) }));
      return;
    }
    send({ type: 'KL_GOTO', i: resolvePoint(lastPoint) });
  }

  /* ---------- engine plumbing ---------- */
  function send(msg) { if (frame && frame.contentWindow) frame.contentWindow.postMessage(msg, '*'); }
  function stop() {
    send({ type: 'KL_STOP' });
    clearPaint();
    if (frame) { frame.remove(); frame = null; }
    if (bar) { bar.remove(); bar = null; }

    curIdx = -1;
  }
  function start(onReady) {
    onReadyCb = onReady || null;
    sentences = collect();
    if (!sentences.length) { alert('Chickadee: no readable text found on this page.'); return; }
    cacheBoxes();
    addEventListener('resize', cacheBoxes, { passive: true });
    ensureStyle();
    makeBar();
    if (frame) {
      chrome.storage.sync.get({ voice: 'af_heart', speed: 1, engine: 'kokoro' }, (cfg) => {
        send({ type: 'KL_INIT', sentences: sentences.map(s => s.text.slice(0, 380)),
               voice: cfg.voice, speed: cfg.speed, engine: cfg.engine });
      });
      return;
    }
    frame = document.createElement('iframe');
    frame.id = 'kokoro-engine';
    frame.src = chrome.runtime.getURL('engine.html');
    frame.allow = 'autoplay';
    // hidden, but NOT display:none — a never-rendered frame won't initialise its
    // media pipeline, which leaves <audio> stuck at readyState 0.
    frame.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;bottom:0;left:0;border:0;';
    document.body.appendChild(frame);
  }

  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || typeof d !== 'object') return;
    switch (d.type) {
      case 'KL_READY':
        chrome.storage.sync.get({ voice: 'af_heart', speed: 1, engine: 'kokoro' }, (cfg) => {
          send({ type: 'KL_INIT', sentences: sentences.map(s => s.text.slice(0, 380)),
                 voice: cfg.voice, speed: cfg.speed, engine: cfg.engine });
        });
        break;
      case 'KL_FIRST':
        if (onReadyCb) { const cb = onReadyCb; onReadyCb = null; cb(); }
        break;
      case 'KL_SENTENCE':
        curIdx = d.i; paint(d.i);
        // Audio is flowing: clear any leftover download progress. Errors never
        // reach here (they short-circuit before a sentence starts), so they persist.
        setStatus('');
        break;
      case 'KL_STATUS': {
        // Show only the first-run download and real failures; ignore chatter.
        const t = d.text || '';
        setStatus(/^Downloading|failed|No readable/i.test(t) ? t : '');
        break;
      }
      case 'KL_PLAYING':  setPlay(d.playing); if (d.playing) setStatus(''); break;
      // Autoplay blocked (no user gesture). The bar's button already flips to ▶,
      // which says it better than any text would.
      case 'KL_BLOCKED':  setPlay(false); break;
      case 'KL_UNSUPPORTED': {
        // No WebGPU: nothing will ever play. Say why, and clear the UI so the
        // user isn't left staring at controls that cannot work.
        const s2 = document.getElementById('kokoro-status');
        if (s2) { s2.style.display = ''; s2.style.color = '#ffb4b4'; s2.textContent = d.reason; }
        setPlay(false);
        if (frame) { frame.remove(); frame = null; }
        setTimeout(() => { const b = document.getElementById('kokoro-bar'); if (b) b.remove(); bar = null; }, 9000);
        break;
      }
    }
  });

  chrome.runtime.onMessage.addListener((req, _s, respond) => {
    if (req.action === 'PING')   { respond({ ok: true }); return; }
    if (req.action === 'READ')   { start(); respond({ ok: true }); return; }
    if (req.action === 'READ_FROM_POINT') { readFromPoint(); respond({ ok: true }); return; }
    if (req.action === 'TOGGLE') { send({ type: 'KL_TOGGLE' }); respond({ ok: true }); return; }
    if (req.action === 'STOP')   { stop(); respond({ ok: true }); return; }
  });
})();
