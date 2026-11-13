// Phonemes for Paradee's Hindi, French and Spanish voices, without eSpeak.
//
// Training phonemized these languages with eSpeak NG, which is GPL-3.0. This is
// Paradee's own G2P instead (the same as paradee/g2p.py in the Python package),
// learned from eSpeak's output and all Apache-2.0. It has three parts, in g2p/:
//
// - a 0.76M-parameter model (g2p.onnx, 0.9 MB int8) that reads one word, plus the
//   last letter of the word before it and the first letter of the word after it,
//   and writes the word's phonemes with stress marks. The neighbouring letters are
//   enough for French liaison ("les amis" -> lez), the Spanish b, d and g that
//   soften after a vowel, and the stress eSpeak puts at the end of a phrase.
// - word lists (g2p.json): the words the model gets wrong, and the 3,000 most
//   common words of each language so they skip the model.
// - a table of number pieces per language that numbers are put together from.
//
// On held-out sentences it differs from eSpeak in 0.80% (Hindi), 0.95% (French)
// and 0.59% (Spanish) of phoneme characters, mostly a moved stress mark.

// A Paradee voice's language, from the first letter of its name, as in Kokoro.
export const LANG_OF = { h: 'hi', f: 'fr', e: 'es' };

const PERCENT = { hi: 'प्रतिशत', fr: 'pour cent', es: 'por ciento' };
const MAX_WORD = 60;   // letters the model reads of one word

// Punctuation, symbols, spaces and zero-width characters, trimmed off the ends of a word.
const isEdge = (c) => /[\p{P}\p{S}\p{Z}]/u.test(c) || '​‌‍﻿'.includes(c);
const hasAlnum = (s) => /[\p{L}\p{N}]/u.test(s);
function strip(w) {
  const a = [...w];
  let i = 0, j = a.length;
  while (i < j && isEdge(a[i])) i++;
  while (j > i && isEdge(a[j - 1])) j--;
  return a.slice(i, j).join('');
}

// Each whitespace-separated piece as [word, punctuation before it?, punctuation after it?].
// A piece with no letters or digits is [null, true, true].
function words(text) {
  return text.split(/\s+/u).filter(Boolean).map((raw) => {
    const core = strip(raw);
    if (!core || !hasAlnum(core)) return [null, true, true];
    const i = raw.indexOf(core);
    return [core, i > 0, i + core.length < raw.length];
  });
}

// [before, after] for each word: the last letter of the word before and the first
// letter of the word after, lowercased, or "#" when punctuation or the end of the
// sentence is in between.
function contexts(ws) {
  const first = (s) => [...s][0].toLowerCase(), last = (s) => [...s].at(-1).toLowerCase();
  return ws.map(([w, lead, trail], i) => {
    if (w === null) return null;
    const before = i === 0 || lead || ws[i - 1][0] === null || ws[i - 1][2] ? '#' : last(ws[i - 1][0]);
    const after = i === ws.length - 1 || trail || ws[i + 1][0] === null || ws[i + 1][1] ? '#' : first(ws[i + 1][0]);
    return [before, after];
  });
}

// Numbers, put together from pieces the way eSpeak reads them.
const unstress = (s) => s.replace(/[ˈˌ]/gu, '');
function hi(n, t) {
  if (n < 100) return [t[n]];
  let out = [];
  for (const [div, name] of [[1e7, 'crore'], [1e5, 'lakh'], [1000, 'thousand']])
    if (n >= div) { out = out.concat(hi(Math.floor(n / div), t), [t[name]]); n %= div; }
  if (n >= 100) { out.push(t[Math.floor(n / 100) * 100]); n %= 100; }
  if (n) out.push(t[n]);
  return out;
}
function fr(n, t, top = true) {
  let out = [];
  for (const [div, one, many] of [[1e9, 'milliard', 'milliards'], [1e6, 'million', 'millions']])
    if (n >= div) {
      const q = Math.floor(n / div);
      out = out.concat(q === 1 ? ['œ̃'] : fr(q, t, false), [t[q === 1 ? one : many]]);
      n %= div;
    }
  if (n >= 1000) { const q = Math.floor(n / 1000); out = out.concat(q === 1 ? [] : fr(q, t, false), [t.thousand]); n %= 1000; }
  if (n >= 100) { out.push(t[Math.floor(n / 100) * 100]); n %= 100; }
  if (n || !out.length) out.push(t[n]);
  if (top) out = out.slice(0, -1).map(unstress).concat(out.slice(-1));   // French stresses only the last word of a number
  return out;
}
function es(n, t) {
  let out = [];
  if (n >= 1e6) { const q = Math.floor(n / 1e6); out = out.concat(q === 1 ? [t['millón']] : es(q, t).concat([t.millones])); n %= 1e6; }
  if (n >= 1000) {
    const q = Math.floor(n / 1000);
    if (q === 1) out.push(t.thousand);
    else {
      const p = es(q, t);
      if (q % 10 === 1 && q % 100 !== 11 && p.at(-1).endsWith('o')) p[p.length - 1] = p.at(-1).slice(0, -1);   // veintiuno mil -> veintiún mil
      out = out.concat(p, [t.thousand]);
    }
    n %= 1000;
  }
  if (n >= 100) { const h = Math.floor(n / 100) * 100; n %= 100; out.push(h === 100 && n ? t['100+'] : t[h]); }
  if (n || !out.length) out.push(t[n]);
  return out;
}
const NUMBERS = { hi, fr, es };

// Spanish b, d and g are said β, ð and ɣ after a vowel and most consonants, also
// across words, as eSpeak writes them. `before` is the sound or letter before, "#" after a pause.
const SOFT = { b: 'β', d: 'ð', 'ɡ': 'ɣ' };
function soften(p, before) {
  let i = 0;
  while (i < p.length && 'ˈˌ'.includes(p[i])) i++;
  const c = p[i];
  if (c in SOFT && !'#nmɲŋ'.includes(before) && !(c === 'd' && before === 'l')) p = p.slice(0, i) + SOFT[c] + p.slice(i + 1);
  return p;
}

export class ParadeeG2P {
  // ort: the onnxruntime-web module. model: the bytes of g2p.onnx. data: g2p.json.
  static async create(ort, model, data) {
    const g = new ParadeeG2P();
    g.ort = ort;
    g.data = data;
    g.session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
    g.index = Object.fromEntries(data.vocab.in.map((c, i) => [c, i]));
    return g;
  }

  // Phonemes for each [language, letter before, word, letter after], from the model alone.
  async model(items) {
    if (!items.length) return [];
    const ix = this.index, unk = ix['<unk>'];
    const rows = items.map(([lang, a, w, b]) => [ix[`<${lang}>`], ix[a] ?? unk, ix['<s1>'],
      ...[...w.toLowerCase()].slice(0, MAX_WORD).map((c) => ix[c] ?? unk), ix['<s2>'], ix[b] ?? unk]);
    const T = Math.max(...rows.map((r) => r.length)), B = rows.length;
    const chars = new BigInt64Array(B * T), pad = new Uint8Array(B * T).fill(1);
    rows.forEach((r, i) => r.forEach((v, j) => { chars[i * T + j] = BigInt(v); pad[i * T + j] = 0; }));
    const out = await this.session.run({
      chars: new this.ort.Tensor('int64', chars, [B, T]),
      pad: new this.ort.Tensor('bool', pad, [B, T]),
    });
    const best = out.best.data, steps = out.best.dims[1], outs = this.data.vocab.out;
    // CTC: merge repeats, drop blanks (0); each letter has 3 output steps
    return rows.map((r, i) => {
      let s = '', prev = 0;
      for (let t = 0; t < r.length * 3; t++) {
        const k = Number(best[i * steps + t]);
        if (k !== prev && k !== 0) s += outs[k];
        prev = k;
      }
      return s;
    });
  }

  // Phonemes for each [word, letter before, letter after]: the word list first, then the model.
  async words(lang, items) {
    const L = this.data.lexicon[lang] || { w: {}, c: {} };
    const out = items.map(([w, a, b]) => L.c[`${w}\t${a}\t${b}`] ?? L.w[w] ?? null);
    const todo = out.map((p, i) => (p === null ? i : -1)).filter((i) => i >= 0);
    const res = await this.model(todo.map((i) => [lang, items[i][1], items[i][0], items[i][2]]));
    todo.forEach((i, k) => { out[i] = res[k]; });
    return out;
  }

  number(n, lang, before = '#') {
    let parts = NUMBERS[lang](n, this.data.numbers[lang]);
    if (lang === 'es') {
      const soft = [];
      parts.forEach((p, k) => soft.push(soften(p, k === 0 ? before : [...soft[k - 1]].at(-1))));
      parts = soft;
    }
    return parts.join(' ');
  }

  // One sentence of Hindi ("hi"), French ("fr") or Spanish ("es") -> phonemes, one
  // space between words, punctuation kept, as misaki's EspeakG2P made them in training.
  async phonemize(text, lang) {
    text = text.replace(/[०-९]/gu, (d) => String(d.charCodeAt(0) - 0x966)).replace(/«/gu, '“').replace(/»/gu, '”');
    text = text.replace(/[​‌‍﻿]/gu, '');
    text = text.replace(/([।॥])(?=\S)/gu, '$1 ');
    if (lang === 'fr') text = text.replace(/(?<=\d)[   ](?=\d{3}\b)/gu, '');   // 12 000 is one number
    text = text.replace(/(\d)\s?%/gu, (m, d) => `${d} ${PERCENT[lang]}`);
    const raws = text.split(/\s+/u).filter(Boolean), ws = words(text), ctx = contexts(ws);
    const jobs = [], plan = [];
    raws.forEach((raw, k) => {
      const core = ws[k][0], c = ctx[k];
      if (core === null) { plan.push([raw, null, '']); return; }
      const i = raw.indexOf(core);
      const parts = [];
      for (const piece of core.match(/\d+|[^\d]+/gu)) {
        if (/^\d+$/u.test(piece)) parts.push(['number', piece]);
        else {
          const p = piece.replace(/^[-.,/:]+|[-.,/:]+$/gu, '');
          if (hasAlnum(p)) parts.push(['word', p]);
        }
      }
      const ids = parts.map(([kind, piece]) => {
        const first = piece === parts[0][1], last = piece === parts.at(-1)[1];
        if (kind === 'number')   // a long string of digits is read digit by digit
          return ['text', piece.length < 10 ? this.number(Number(piece), lang, first ? c[0] : '#')
            : [...piece].map((d) => this.number(Number(d), lang)).join(' ')];
        jobs.push([piece, first ? c[0] : '#', last ? c[1] : '#']);
        return ['job', jobs.length - 1];
      });
      plan.push([raw.slice(0, i), ids, raw.slice(i + core.length)]);
    });
    const res = await this.words(lang, jobs);
    return plan.map(([lead, ids, trail]) => (ids === null ? lead
      : lead + ids.map(([kind, x]) => (kind === 'text' ? x : res[x])).join(' ') + trail)).join(' ').replace(/-/gu, '');
  }
}
