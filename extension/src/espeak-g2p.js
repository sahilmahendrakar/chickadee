// Phonemes for Paradee's Hindi, French and Spanish voices. Training phonemized
// those languages the way Kokoro does (misaki's EspeakG2P): raw eSpeak output
// through the Python phonemizer, with punctuation kept, stress marks, and the
// two halves of some sounds tied together and then written as one symbol
// (t^ʃ -> ʧ, a^ɪ -> I). None of misaki's English rules apply, so these voices
// skip toMisaki() and kokoro-js's English text normalisation.
//
// The eSpeak in the browser (the phonemizer npm package) prints no tie marks, so
// a pair like "tʃ" can't tell one sound from two. Measured on 3,000 training
// sentences per language, eSpeak ties a pair in the voice's own language only
// in these cases, so only these are joined. Words eSpeak reads as English
// (marked "(en)" in its output) get the pairs English eSpeak ties.
const TIES = [
  ['aɪ', 'I'], ['aʊ', 'W'], ['dz', 'ʣ'], ['dʒ', 'ʤ'], ['eɪ', 'A'], ['oʊ', 'O'],
  ['ss', 'S'], ['ts', 'ʦ'], ['tʃ', 'ʧ'], ['ɔɪ', 'Y'], ['əʊ', 'Q'],
];
const OWN = {
  hi: [],
  fr: ['aɪ', 'aʊ', 'eɪ', 'əʊ', 'ɔɪ'],
  es: ['aɪ', 'aʊ', 'dʒ', 'eɪ', 'tʃ'],
  en: ['aɪ', 'aʊ', 'dʒ', 'eɪ', 'oʊ', 'tʃ', 'ɔɪ', 'əʊ'],
};
// What eSpeak is asked for, per language. "fr-fr" doesn't select a voice in the
// browser build, "fr" is the same voice (roa/fr).
export const ESPEAK = { hi: 'hi', fr: 'fr', es: 'es' };
// A Paradee voice's language, from the first letter of its name, as in Kokoro.
export const LANG_OF = { h: 'hi', f: 'fr', e: 'es' };

const MARKS = ';:,.!?¡¿—…"«»“”(){}[]';
const PUNCT = new RegExp(`(\\s*[${MARKS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+\\s*)+`, 'gu');

function tie(ps, pairs) {
  for (const [a, b] of TIES) if (pairs.includes(a)) ps = ps.split(a).join(b);
  return ps;
}

// eSpeak's output for one stretch of text, with any "(en)…(fr)" language
// switches resolved: switched (English) words get the English pairs, the rest the
// pairs of the voice's own language.
function mapSwitches(ps, lang) {
  let out = '', foreign = false;
  for (const part of ps.split(/(\([a-z-]+\))/u)) {
    const flag = part.match(/^\(([a-z-]+)\)$/u);
    if (flag) { foreign = flag[1].split('-')[0] !== lang; continue; }
    out += tie(part, foreign ? OWN.en : OWN[lang]);
  }
  return out;
}

// text -> phonemes, as misaki's EspeakG2P(language) makes them in training.
export async function g2p(phonemize, text, lang) {
  text = text.replace(/«/g, '“').replace(/»/g, '”').replace(/\(/g, '«').replace(/\)/g, '»');
  let out = '', last = 0;
  const chunks = [];
  for (const m of text.matchAll(PUNCT)) {
    if (m.index > last) chunks.push({ text: text.slice(last, m.index) });
    chunks.push({ mark: m[0].replace(/\s+/gu, ' ') });
    last = m.index + m[0].length;
  }
  if (last < text.length) chunks.push({ text: text.slice(last) });
  for (const c of chunks) {
    if (c.mark) { out += c.mark; continue; }
    const lines = await phonemize(c.text, ESPEAK[lang]);
    // A line per clause. Hindi's "।" ends a clause and is dropped, as in training.
    out += mapSwitches(lines.join(' '), lang).replace(/\s+/gu, ' ').trim();
  }
  out = out.replace(/\^/g, '').replace(/-/g, '');
  return out.replace(/«/g, '(').replace(/»/g, ')').replace(/\s+/gu, ' ').trim();
}
