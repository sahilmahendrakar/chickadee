const $ = (id) => document.getElementById(id);
const DEFAULTS = { voice: 'af_heart', speed: 1, engine: 'kokoro' };

// Paradee is a small model distilled from Kokoro's af_heart voice. It has that
// one voice, ships inside the extension, and runs without WebGPU.
function showEngine() {
  const light = $('engine').value === 'paradee';
  $('voice').disabled = light;
  $('voice-field').title = light ? 'Paradee has one voice, distilled from af_heart' : '';
  $('size-note').textContent = light
    ? 'Paradee (9 MB) is built in, so nothing to download.'
    : 'Voice model (~310 MB) downloads once, then works offline.';
}

chrome.storage.sync.get(DEFAULTS, (s) => {
  $('engine').value = s.engine;
  $('voice').value = s.voice;
  $('speed').value = String(s.speed);
  showEngine();
});

function save() {
  showEngine();
  const v = { engine: $('engine').value, voice: $('voice').value, speed: parseFloat($('speed').value) };
  chrome.storage.sync.set(v, () => {
    const el = $('saved');
    el.textContent = 'Saved';
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 1800);
  });
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
