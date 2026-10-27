const $ = (id) => document.getElementById(id);
// engine 'auto' means the user has not picked a model: Kokoro where WebGPU works,
// Paradee where it does not. The engine page makes the same check.
const DEFAULTS = { voice: 'af_heart', speed: 1, engine: 'auto' };

async function hasWebGPU() {
  try { return !!(navigator.gpu && await navigator.gpu.requestAdapter()); }
  catch (e) { return false; }
}

// Paradee is a small model distilled from Kokoro. It has four of Kokoro's voices,
// ships inside the extension, and runs without WebGPU. With Paradee the menu lists
// only those four, and a stored voice it doesn't have shows as af_heart, which is
// what the engine reads with.
const PARADEE_VOICES = ['af_heart', 'bf_isabella', 'am_puck', 'bm_fable'];
const ALL_VOICES = $('voice').cloneNode(true);   // the full Kokoro menu from popup.html
let storedVoice = DEFAULTS.voice;
function showEngine() {
  const light = $('engine').value === 'paradee';
  const menu = ALL_VOICES.cloneNode(true);
  if (light) for (const o of [...menu.querySelectorAll('option')]) if (!PARADEE_VOICES.includes(o.value)) o.remove();
  $('voice').replaceChildren(...menu.childNodes);
  $('voice').value = light && !PARADEE_VOICES.includes(storedVoice) ? 'af_heart' : storedVoice;
  $('size-note').textContent = light
    ? 'Small and fast. Works on any computer, no download.'
    : 'Most natural voice. Downloads 310 MB once, then works offline.';
}

chrome.storage.sync.get(DEFAULTS, async (s) => {
  const gpu = await hasWebGPU();
  if (!gpu) {
    const k = $('engine').querySelector('option[value="kokoro"]');
    k.disabled = true;
    k.textContent = 'Kokoro — needs WebGPU';
  }
  $('engine').value = gpu && s.engine !== 'paradee' ? 'kokoro' : 'paradee';
  storedVoice = s.voice;
  $('speed').value = String(s.speed);
  showEngine();
});

function save(ev) {
  // The voice is stored only when it is picked, so trying Paradee doesn't replace a Kokoro-only voice.
  if (ev && ev.target === $('voice')) storedVoice = $('voice').value;
  showEngine();
  const v = { voice: storedVoice, speed: parseFloat($('speed').value) };
  // Only an actual pick in the Model menu is stored, so the automatic default
  // keeps following the computer until the user chooses.
  if (ev && ev.target === $('engine')) v.engine = $('engine').value;
  chrome.storage.sync.set(v);
}
$('engine').onchange = save;
$('voice').onchange = save;
$('speed').onchange = save;

// The toolbar click now opens this popup, so reading needs an explicit button.
$('read').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'READ' });
  } catch (e) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tab.id, { action: 'READ' });
  }
  window.close();
};

// Shortcuts. They are declared in the manifest as chrome.commands, which means
// the user can rebind them at chrome://extensions/shortcuts. Show whatever is
// bound right now rather than the defaults, and give them a way to get there.
const COMMANDS = [['read-article', 'read'], ['toggle-play', 'play / pause']];
const IS_MAC = navigator.platform.startsWith('Mac');
const MOD = IS_MAC
  ? { Command: '⌘', MacCtrl: '⌃', Ctrl: '⌘', Alt: '⌥', Shift: '⇧' }
  : { Command: 'Win', MacCtrl: 'Ctrl', Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift' };

// Chrome hands back either "Alt+Shift+R" or, on a Mac, glyphs like "⌥⇧R".
function keysOf(shortcut) {
  if (!shortcut) return [];
  if (shortcut.includes('+')) return shortcut.split('+').map((k) => MOD[k] || k);
  const m = shortcut.match(/^([⌘⌥⇧⌃]*)(.+)$/u);
  return m ? [...m[1], m[2]] : [shortcut];
}

function renderShortcuts(cmds) {
  const byName = Object.fromEntries(cmds.map((c) => [c.name, c.shortcut]));
  const el = $('keys');
  el.textContent = '';
  for (const [name, label] of COMMANDS) {
    const span = document.createElement('span');
    const keys = keysOf(byName[name]);
    if (keys.length) {
      for (const k of keys) {
        const kbd = document.createElement('kbd');
        kbd.textContent = k;
        span.appendChild(kbd);
      }
    } else {
      const em = document.createElement('em');
      em.textContent = 'unset';
      span.appendChild(em);
    }
    span.appendChild(document.createTextNode(' ' + label));
    el.appendChild(span);
  }
}
chrome.commands.getAll(renderShortcuts);

// A plain link can't open a chrome:// page, but tabs.create can.
$('shortcuts').onclick = (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  window.close();
};
