// English phonemes the way misaki makes them (hexgrad/misaki, Kokoro's own G2P,
// Apache-2.0), in the browser and without eSpeak. Kokoro and Paradee both learned
// English from misaki's phonemes.
//
// This is misaki's en.py (0.9.4) ported line for line, with two parts of its own:
// - misaki reads text with spaCy, for its tokens and their part-of-speech tags.
//   Here a few rules split the text and tag punctuation, numbers and names, and a
//   small classifier (en-tags.json, 0.3 MB) learned from spaCy's tags guesses the
//   tag of the ~800 words whose phonemes depend on it ("read", "live", "that").
// - misaki asks eSpeak for the words its dictionaries don't have (mostly names).
//   Here they go to Paradee's own G2P model (paradee-g2p.js) with its English word
//   list, the same as the Python package does.
// On 1,000 Wikipedia sentences this differs from misaki with spaCy and eSpeak in
// 0.17% of phoneme characters (American and British).

const DIPHTHONGS = new Set('AIOQWYʤʧ');
const stressWeight = (ps) => (ps ? [...ps].reduce((n, c) => n + (DIPHTHONGS.has(c) ? 2 : 1), 0) : 0);

const SUBTOKEN = /^['‘’]+|\p{Lu}(?=\p{Lu}\p{Ll})|(?:^-)?(?:\p{Nd}?[,.]?\p{Nd})+|[-_]+|['‘’]{2,}|\p{L}*?(?:['‘’]\p{L})*?\p{Ll}(?=\p{Lu})|\p{L}+(?:['‘’]\p{L})*|[^-_\p{L}'‘’\p{Nd}]|['‘’]+$/gu;
const subtokenize = (word) => [...word.matchAll(SUBTOKEN)].map((m) => m[0]);

const SUBTOKEN_JUNKS = new Set("',-._‘’/");
const PUNCTS = new Set(';:,.!?—…"“”');
const NON_QUOTE_PUNCTS = new Set([...PUNCTS].filter((p) => !'"“”'.includes(p)));
const PUNCT_TAGS = new Set(['.', ',', '-LRB-', '-RRB-', '``', '""', "''", ':', '$', '#', 'NFP']);
const PUNCT_TAG_PHONEMES = { '-LRB-': '(', '-RRB-': ')', '``': '“', '""': '”', "''": '”' };
const LEXICON_ORDS = new Set([39, 45, ...Array.from({ length: 26 }, (_, i) => 65 + i), ...Array.from({ length: 26 }, (_, i) => 97 + i)]);
const CONSONANTS = new Set('bdfhjklmnpstvwzðŋɡɹɾʃʒʤʧθ');
const US_TAUS = new Set('AIOWYiuæɑəɛɪɹʊʌ');
const CURRENCIES = { '$': ['dollar', 'cent'], '£': ['pound', 'pence'], '€': ['euro', 'cent'] };
const ORDINALS = ['st', 'nd', 'rd', 'th'];
const SYMBOLS = { '%': 'percent', '&': 'and', '+': 'plus', '@': 'at' };
const PRIMARY = 'ˈ', SECONDARY = 'ˌ', STRESSES = 'ˌˈ';
const VOWELS = new Set('AIOQWYaiuæɑɒɔəɛɜɪʊʌᵻ');

// Python's string tests, which misaki relies on
const isAlpha = (s) => s.length > 0 && /^\p{L}+$/u.test(s);
const isUpper = (s) => s === s.toUpperCase();   // as misaki uses it: word == word.upper()
const isLower = (s) => s === s.toLowerCase();
const capitalize = (s) => { const a = [...s]; return a.length ? a[0].toUpperCase() + a.slice(1).join('').toLowerCase() : s; };
const isDigits = (s) => /^[0-9]+$/.test(s);
const len = (s) => [...s].length;
const allLexiconOrds = (s) => [...s].every((c) => LEXICON_ORDS.has(c.codePointAt(0)));
const has = (o, k) => k !== null && k !== undefined && Object.prototype.hasOwnProperty.call(o, k);

function applyStress(ps, stress) {
  const restress = (ps) => {   // move each stress mark to just before the vowel after it
    const a = [...ps], i = a.findIndex((c) => STRESSES.includes(c));
    const j = a.findIndex((c, k) => k > i && VOWELS.has(c));
    const s = a.splice(i, 1)[0];
    a.splice(j - 1, 0, s);
    return a.join('');
  };
  if (stress === null || stress === undefined || ps === null) return ps;
  const none = ![...STRESSES].some((s) => ps.includes(s));
  const noVowel = ![...ps].some((c) => VOWELS.has(c));
  if (stress < -1) return ps.replaceAll(PRIMARY, '').replaceAll(SECONDARY, '');
  if (stress === -1 || ((stress === 0 || stress === -0.5) && ps.includes(PRIMARY)))
    return ps.replaceAll(SECONDARY, '').replaceAll(PRIMARY, SECONDARY);
  if ([0, 0.5, 1].includes(stress) && none) return noVowel ? ps : restress(SECONDARY + ps);
  if (stress >= 1 && !ps.includes(PRIMARY) && ps.includes(SECONDARY)) return ps.replaceAll(SECONDARY, PRIMARY);
  if (stress > 1 && none) return noVowel ? ps : restress(PRIMARY + ps);
  return ps;
}

// English numbers as words, the way the num2words package writes them (misaki reads
// numbers through it). Only the words matter: misaki drops the punctuation and "and".
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion',
  'octillion', 'nonillion', 'decillion'];
function under1000(n) {
  const out = [];
  if (n >= 100) { out.push(ONES[Math.floor(n / 100)], 'hundred'); n %= 100; if (n) out.push('and'); }
  if (n >= 20) out.push(TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''));
  else if (n || !out.length) out.push(ONES[n]);
  return out.join(' ');
}
function cardinal(n) {
  n = BigInt(n);
  if (n < 0n) return 'minus ' + cardinal(-n);
  if (n < 1000n) return under1000(Number(n));
  const groups = [];
  for (let k = 0; n > 0n; k++, n /= 1000n) groups.push([Number(n % 1000n), k]);
  const parts = groups.reverse().filter(([g]) => g).map(([g, k]) => under1000(g) + (k ? ' ' + SCALES[k] : ''));
  const last = groups.at(-1)[0];
  if (last && last < 100 && parts.length > 1) parts[parts.length - 1] = 'and ' + parts.at(-1);
  return parts.join(', ');
}
function ordinal(n) {
  const words = cardinal(n).split(' ');
  const parts = words.at(-1).split('-');
  const w = parts.at(-1);
  const IRREGULAR = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
  parts[parts.length - 1] = IRREGULAR[w] || (w.endsWith('y') ? w.slice(0, -1) + 'ieth' : w + 'th');
  words[words.length - 1] = parts.join('-');
  return words.join(' ');
}
function year(n) {
  const high = Math.floor(n / 100), low = n % 100;
  if (high === 0 || (high % 10 === 0 && low < 10) || high >= 100) return cardinal(n);
  return cardinal(high) + ' ' + (low === 0 ? 'hundred' : low < 10 ? 'oh-' + cardinal(low) : cardinal(low));
}
function decimal(s) {   // num2words(float(s))
  const x = parseFloat(s);
  const [whole, frac = ''] = String(x).split('.');
  const head = cardinal(BigInt(whole.replace('-', ''))), sign = x < 0 ? 'minus ' : '';
  return sign + head + (frac ? ' point ' + [...frac].map((d) => ONES[+d]).join(' ') : '');
}

class Lexicon {
  static grow(d) {
    const e = {};
    for (const [k, v] of Object.entries(d)) {
      if (len(k) < 2) continue;
      if (k === k.toLowerCase()) { if (k !== capitalize(k)) e[capitalize(k)] = v; }
      else if (k === capitalize(k.toLowerCase())) e[k.toLowerCase()] = v;
    }
    return Object.assign(Object.create(null), e, d);
  }

  constructor(british, gold, silver) {
    this.british = british;
    this.capStresses = [0.5, 2];
    this.golds = Lexicon.grow(gold);
    this.silvers = Lexicon.grow(silver);
  }

  getNNP(word) {
    const ps = [...word].filter((c) => isAlpha(c)).map((c) => this.golds[c.toUpperCase()]);
    if (ps.some((p) => p === undefined || p === null)) return [null, null];
    const s = applyStress(ps.join(''), 0), k = s.lastIndexOf(SECONDARY);
    return [k < 0 ? s : s.slice(0, k) + PRIMARY + s.slice(k + 1), 3];
  }

  getSpecialCase(word, tag, stress, ctx) {
    if (has(SYMBOLS, word)) return this.lookup(SYMBOLS[word], null, null, ctx);
    const inner = word.replace(/^\.+|\.+$/g, '');
    if (inner.includes('.') && isAlpha(word.replaceAll('.', '')) && Math.max(...word.split('.').map(len)) < 3) return this.getNNP(word);
    if (word === 'a' || word === 'A') return [tag === 'DT' ? 'ɐ' : 'ˈA', 4];
    if (['am', 'Am', 'AM'].includes(word)) {
      if (tag.startsWith('NN')) return this.getNNP(word);
      if (ctx.futureVowel === null || word !== 'am' || (stress && stress > 0)) return [this.golds.am, 4];
      return ['ɐm', 4];
    }
    if (['an', 'An', 'AN'].includes(word)) {
      if (word === 'AN' && tag.startsWith('NN')) return this.getNNP(word);
      return ['ɐn', 4];
    }
    if (word === 'I' && tag === 'PRP') return [SECONDARY + 'I', 4];
    if (['by', 'By', 'BY'].includes(word) && Lexicon.parentTag(tag) === 'ADV') return ['bˈI', 4];
    if (word === 'to' || word === 'To' || (word === 'TO' && (tag === 'TO' || tag === 'IN')))
      return [ctx.futureVowel === null ? this.golds.to : ctx.futureVowel ? 'tʊ' : 'tə', 4];
    if (word === 'in' || word === 'In' || (word === 'IN' && tag !== 'NNP'))
      return [(ctx.futureVowel === null || tag !== 'IN' ? PRIMARY : '') + 'ɪn', 4];
    if (word === 'the' || word === 'The' || (word === 'THE' && tag === 'DT')) return [ctx.futureVowel === true ? 'ði' : 'ðə', 4];
    if (tag === 'IN' && /^vs\.?$/i.test(word)) return this.lookup('versus', null, null, ctx);
    if (['used', 'Used', 'USED'].includes(word)) {
      if ((tag === 'VBD' || tag === 'JJ') && ctx.futureTo) return [this.golds.used.VBD, 4];
      return [this.golds.used.DEFAULT, 4];
    }
    return [null, null];
  }

  static parentTag(tag) {
    if (tag === null || tag === undefined) return tag;
    if (tag.startsWith('VB')) return 'VERB';
    if (tag.startsWith('NN')) return 'NOUN';
    if (tag.startsWith('ADV') || tag.startsWith('RB')) return 'ADV';
    if (tag.startsWith('ADJ') || tag.startsWith('JJ')) return 'ADJ';
    return tag;
  }

  isKnown(word) {
    if (has(this.golds, word) || has(SYMBOLS, word) || has(this.silvers, word)) return true;
    if (!isAlpha(word) || !allLexiconOrds(word)) return false;
    if (len(word) === 1) return true;
    if (isUpper(word) && has(this.golds, word.toLowerCase())) return true;
    const rest = [...word].slice(1).join('');
    return rest === rest.toUpperCase();
  }

  lookup(word, tag, stress, ctx) {
    let isNNP = null;
    if (isUpper(word) && !has(this.golds, word)) { word = word.toLowerCase(); isNNP = tag === 'NNP'; }
    let ps = has(this.golds, word) ? this.golds[word] : null, rating = 4;
    if (ps === null && !isNNP) { ps = has(this.silvers, word) ? this.silvers[word] : null; rating = 3; }
    if (ps !== null && typeof ps === 'object') {
      if (ctx && ctx.futureVowel === null && has(ps, 'None')) tag = 'None';
      else if (!has(ps, tag)) tag = Lexicon.parentTag(tag);
      ps = has(ps, tag) ? ps[tag] : ps.DEFAULT;
    }
    if (ps === null || (isNNP && !ps.includes(PRIMARY))) {
      const [p, r] = this.getNNP(word);
      if (p !== null) return [p, r];
      ps = null; rating = r;   // misaki goes on with the word's own phonemes (or none)
    }
    return [applyStress(ps, stress), rating];
  }

  _s(stem) {
    if (!stem) return null;
    const c = stem.at(-1);
    if ('ptkfθ'.includes(c)) return stem + 's';
    if ('szʃʒʧʤ'.includes(c)) return stem + (this.british ? 'ɪ' : 'ᵻ') + 'z';
    return stem + 'z';
  }

  stemS(word, tag, stress, ctx) {
    if (len(word) < 3 || !word.endsWith('s')) return [null, null];
    let stem;
    if (!word.endsWith('ss') && this.isKnown(word.slice(0, -1))) stem = word.slice(0, -1);
    else if ((word.endsWith("'s") || (len(word) > 4 && word.endsWith('es') && !word.endsWith('ies'))) && this.isKnown(word.slice(0, -2))) stem = word.slice(0, -2);
    else if (len(word) > 4 && word.endsWith('ies') && this.isKnown(word.slice(0, -3) + 'y')) stem = word.slice(0, -3) + 'y';
    else return [null, null];
    const [ps, rating] = this.lookup(stem, tag, stress, ctx);
    return [this._s(ps), rating];
  }

  _ed(stem) {
    if (!stem) return null;
    const c = stem.at(-1);
    if ('pkfθʃsʧ'.includes(c)) return stem + 't';
    if (c === 'd') return stem + (this.british ? 'ɪ' : 'ᵻ') + 'd';
    if (c !== 't') return stem + 'd';
    if (this.british || len(stem) < 2) return stem + 'ɪd';
    if (US_TAUS.has(stem.at(-2))) return stem.slice(0, -1) + 'ɾᵻd';
    return stem + 'ᵻd';
  }

  stemEd(word, tag, stress, ctx) {
    if (len(word) < 4 || !word.endsWith('d')) return [null, null];
    let stem;
    if (!word.endsWith('dd') && this.isKnown(word.slice(0, -1))) stem = word.slice(0, -1);
    else if (len(word) > 4 && word.endsWith('ed') && !word.endsWith('eed') && this.isKnown(word.slice(0, -2))) stem = word.slice(0, -2);
    else return [null, null];
    const [ps, rating] = this.lookup(stem, tag, stress, ctx);
    return [this._ed(ps), rating];
  }

  _ing(stem) {
    if (!stem) return null;
    if (this.british) { if ('əː'.includes(stem.at(-1))) return null; }
    else if (len(stem) > 1 && stem.at(-1) === 't' && US_TAUS.has(stem.at(-2))) return stem.slice(0, -1) + 'ɾɪŋ';
    return stem + 'ɪŋ';
  }

  stemIng(word, tag, stress, ctx) {
    if (len(word) < 5 || !word.endsWith('ing')) return [null, null];
    let stem;
    if (len(word) > 5 && this.isKnown(word.slice(0, -3))) stem = word.slice(0, -3);
    else if (this.isKnown(word.slice(0, -3) + 'e')) stem = word.slice(0, -3) + 'e';
    else if (len(word) > 5 && /([bcdgklmnprstvxz])\1ing$|cking$/.test(word) && this.isKnown(word.slice(0, -4))) stem = word.slice(0, -4);
    else return [null, null];
    const [ps, rating] = this.lookup(stem, tag, stress, ctx);
    return [this._ing(ps), rating];
  }

  getWord(word, tag, stress, ctx) {
    const [sp, sr] = this.getSpecialCase(word, tag, stress, ctx);
    if (sp !== null && sp !== undefined) return [sp, sr];
    const wl = word.toLowerCase();
    const rest = [...word].slice(1).join('');
    if (len(word) > 1 && isAlpha(word.replaceAll("'", '')) && word !== wl && (tag !== 'NNP' || len(word) > 7)
      && !has(this.golds, word) && !has(this.silvers, word) && (isUpper(word) || rest === rest.toLowerCase())
      && (has(this.golds, wl) || has(this.silvers, wl)
        || [this.stemS, this.stemEd, this.stemIng].some((fn) => fn.call(this, wl, tag, stress, ctx)[0]))) word = wl;
    if (this.isKnown(word)) return this.lookup(word, tag, stress, ctx);
    if (word.endsWith("s'") && this.isKnown(word.slice(0, -2) + "'s")) return this.lookup(word.slice(0, -2) + "'s", tag, stress, ctx);
    if (word.endsWith("'") && this.isKnown(word.slice(0, -1))) return this.lookup(word.slice(0, -1), tag, stress, ctx);
    let r = this.stemS(word, tag, stress, ctx);
    if (r[0] !== null) return r;
    r = this.stemEd(word, tag, stress, ctx);
    if (r[0] !== null) return r;
    r = this.stemIng(word, tag, stress === null ? 0.5 : stress, ctx);
    if (r[0] !== null) return r;
    return [null, null];
  }

  static isCurrency(word) {
    if (!word.includes('.')) return true;
    if (word.split('.').length > 2) return false;
    return len(word.split('.')[1]) < 3;
  }

  getNumber(word, currency, isHead, numFlags) {
    const m = word.match(/[a-z']+$/);
    const suffix = m ? m[0] : null;
    if (suffix) word = word.slice(0, -suffix.length);
    const result = [];
    if (word.startsWith('-')) { result.push(this.lookup('minus', null, null, null)); word = word.slice(1); }
    const extend = (num, first = true, escape = false) => {
      const splits = (escape ? num : cardinal(num)).split(/[^a-z]+/);
      splits.forEach((w, i) => {
        if (w !== 'and' || numFlags.includes('&')) {
          if (first && i === 0 && splits.length > 1 && w === 'one' && numFlags.includes('a')) result.push(['ə', 4]);
          else result.push(this.lookup(w, null, w === 'point' ? -2 : null, null));
        } else if (w === 'and' && numFlags.includes('n') && result.length) {
          result[result.length - 1] = [result.at(-1)[0] + 'ən', result.at(-1)[1]];
        }
      });
    };
    const int = (s) => BigInt(s);
    if (isDigits(word) && ORDINALS.includes(suffix)) extend(ordinal(int(word)), true, true);
    else if (!result.length && len(word) === 4 && !has(CURRENCIES, currency) && isDigits(word)) extend(year(Number(word)), true, true);
    else if (!isHead && !word.includes('.')) {
      const num = word.replaceAll(',', '');
      if (num[0] === '0' || len(num) > 3) for (const n of num) extend(n, false);
      else if (len(num) === 3 && !num.endsWith('00')) {
        extend(num[0]);
        if (num[1] === '0') { result.push(this.lookup('O', null, -2, null)); extend(num[2], false); }
        else extend(num.slice(1), false);
      } else extend(num);
    } else if (word.split('.').length > 2 || !isHead) {
      let first = true;
      for (const num of word.replaceAll(',', '').split('.')) {
        if (!num) { /* nothing */ }
        else if (num[0] === '0' || (len(num) !== 2 && [...num.slice(1)].some((n) => n !== '0'))) for (const n of num) extend(n, false);
        else extend(num, first);
        first = false;
      }
    } else if (has(CURRENCIES, currency) && Lexicon.isCurrency(word)) {
      let pairs = word.replaceAll(',', '').split('.').slice(0, 2).map((num, i) => [num ? Number(num) : 0, CURRENCIES[currency][i]]);
      if (pairs.length > 1) {
        if (pairs[1][0] === 0) pairs = pairs.slice(0, 1);
        else if (pairs[0][0] === 0) pairs = pairs.slice(1);
      }
      pairs.forEach(([num, unit], i) => {
        if (i > 0) result.push(this.lookup('and', null, null, null));
        extend(num, i === 0);
        result.push(Math.abs(num) !== 1 && unit !== 'pence' ? this.stemS(unit + 's', null, null, null) : this.lookup(unit, null, null, null));
      });
    } else {
      let text;
      if (isDigits(word)) text = cardinal(int(word));
      else if (!word.includes('.')) {
        const n = int(word.replaceAll(',', ''));
        text = ORDINALS.includes(suffix) ? ordinal(n) : cardinal(n);
      } else {
        const w = word.replaceAll(',', '');
        text = w[0] === '.' ? 'point ' + [...w.slice(1)].map((n) => cardinal(n)).join(' ') : decimal(w);
      }
      extend(text, true, true);
    }
    if (!result.length) return [null, null];
    const ps = result.map(([p]) => p).join(' '), rating = Math.min(...result.map(([, r]) => r));
    if (suffix === 's' || suffix === "'s") return [this._s(ps), rating];
    if (suffix === 'ed' || suffix === "'d") return [this._ed(ps), rating];
    if (suffix === 'ing') return [this._ing(ps), rating];
    return [ps, rating];
  }

  appendCurrency(ps, currency) {
    if (!currency) return ps;
    const c = CURRENCIES[currency];
    const word = c ? this.stemS(c[0] + 's', null, null, null)[0] : null;
    return word ? `${ps} ${word}` : ps;
  }

  static isNumber(word, isHead) {
    if (![...word].some((c) => isDigits(c))) return false;
    for (const s of ['ing', "'d", 'ed', "'s", ...ORDINALS, 's']) if (word.endsWith(s)) { word = word.slice(0, -s.length); break; }
    return [...word].every((c, i) => isDigits(c) || ',.'.includes(c) || (isHead && i === 0 && c === '-'));
  }

  call(tk, ctx) {
    let word = (tk.alias ?? tk.text).replaceAll('‘', "'").replaceAll('’', "'").normalize('NFKC');
    word = [...word].map(numericIfNeeded).join('');
    const stress = word === word.toLowerCase() ? null : this.capStresses[word === word.toUpperCase() ? 1 : 0];
    const [ps, rating] = this.getWord(word, tk.tag, stress, ctx);
    if (ps !== null && ps !== undefined) return [applyStress(this.appendCurrency(ps, tk.currency), tk.stress), rating];
    if (Lexicon.isNumber(word, tk.isHead)) {
      const [p, r] = this.getNumber(word, tk.currency, tk.isHead, tk.numFlags);
      return [applyStress(p, tk.stress), r];
    }
    return [null, null];
  }
}

// A digit other than 0-9 (another script's, a superscript) as its plain digit, as unicodedata.numeric does.
const SUPER = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9, '₀': 0, '₁': 1, '₂': 2, '₃': 3, '₄': 4, '₅': 5, '₆': 6, '₇': 7, '₈': 8, '₉': 9 };
function numericIfNeeded(c) {
  if (has(SUPER, c)) return String(SUPER[c]);
  if (/^\p{Nd}$/u.test(c)) {   // decimal digits come in runs of ten, 0 first
    let zero = c.codePointAt(0);
    while (zero > 0 && /^\p{Nd}$/u.test(String.fromCodePoint(zero - 1))) zero--;
    return String((c.codePointAt(0) - zero) % 10);
  }
  return c;
}

// The text split into tokens and tagged, in place of spaCy (see the top of the file).
const ABBREV = new Set(['._.', '10a.m.', '10p.m.', '11a.m.', '11p.m.', '12a.m.', '12p.m.', '1a.m.', '1p.m.', '2a.m.', '2p.m.',
  '3a.m.', '3p.m.', '4a.m.', '4p.m.', '5a.m.', '5p.m.', '6a.m.', '6p.m.', '7a.m.', '7p.m.', '8a.m.', '8p.m.', '9a.m.', '9p.m.',
  'Adm.', 'Ak.', 'Ala.', 'Apr.', 'Ariz.', 'Ark.', 'Aug.', 'Bros.', 'Calif.', 'Co.', 'Colo.', 'Conn.', 'Corp.', 'D.C.', 'Dec.',
  'Del.', 'Dr.', 'E.G.', 'E.g.', 'Feb.', 'Fla.', 'Ga.', 'Gen.', 'Gov.', 'I.E.', 'I.e.', 'Ia.', 'Id.', 'Ill.', 'Inc.', 'Ind.',
  'Jan.', 'Jr.', 'Jul.', 'Jun.', 'Kan.', 'Kans.', 'Ky.', 'La.', 'Ltd.', 'Mar.', 'Mass.', 'Md.', 'Messrs.', 'Mich.', 'Minn.',
  'Miss.', 'Mo.', 'Mont.', 'Mr.', 'Mrs.', 'Ms.', 'Mt.', 'N.C.', 'N.D.', 'N.H.', 'N.J.', 'N.M.', 'N.Y.', 'Neb.', 'Nebr.', 'Nev.',
  'Nov.', 'Oct.', 'Okla.', 'Ore.', 'Pa.', 'Ph.D.', 'Prof.', 'Rep.', 'Rev.', 'S.C.', 'Sen.', 'Sep.', 'Sept.', 'St.', 'Tenn.',
  'Va.', 'Wash.', 'Wis.', 'a.', 'a.m.', 'b.', 'c.', 'co.', 'd.', 'e.', 'e.g.', 'f.', 'g.', 'h.', 'i.', 'i.e.', 'j.', 'k.', 'l.',
  'm.', 'n.', 'o.', 'p.', 'p.m.', 'q.', 'r.', 's.', 't.', 'u.', 'v.', 'v.s.', 'vs.', 'w.', 'x.', 'y.', 'z.', '°C.', '°F.',
  '°K.', '°c.', '°f.', '°k.', 'ä.', 'ö.', 'ü.', 'Esq.', 'Etc.', 'etc.']);
const CLITICS = new Set(["'s", "'m", "'d", "'ll", "'re", "'ve", "'t", '’s', '’m', '’d', '’ll', '’re', '’ve', '’t']);
const PREFIX = new Set('([{"\'“‘`$£€¥#«¿¡*&<§=+_');
const SUFFIX = new Set(')]}"\'”’,;:!?%»>*_');
const DT = new Set(['a', 'an', 'the', 'this', 'these', 'those', 'some', 'any', 'every', 'each', 'no', 'another', 'all', 'both']);
const MD = new Set(['to', 'will', 'would', 'can', 'could', 'should', 'shall', 'may', 'might', 'must', "'ll", "n't", 'not', 'did',
  'do', 'does', "don't", "didn't", "doesn't", "won't", "can't", "wouldn't", "couldn't", "shouldn't", 'please', "let's"]);
const POSS = new Set(['the', 'a', 'an', 'his', 'her', 'its', 'their', 'my', 'our', 'your', 'this', 'that', 'these', 'those', 'of',
  'first', 'new', 'each', 'every', 'no', 'any', 'some']);
const PRON = new Set(['i', 'we', 'they', 'you', 'he', 'she', 'it', 'who', 'which']);
const pyUpper = (s) => /\p{L}/u.test(s) && s === s.toUpperCase() && s !== s.toLowerCase();   // str.isupper()
const first = (s) => [...s][0] || '';
const isAlnum = (s) => s.length > 0 && /^[\p{L}\p{N}]+$/u.test(s);

function splitChunk(chunk, next) {
  const pre = [], post = [];
  while (chunk) {
    if (ABBREV.has(chunk) || ((chunk === 'No.' || chunk === 'no.') && /^\p{Nd}/u.test(next))) break;
    if (chunk.startsWith('...')) { pre.push('...'); chunk = chunk.slice(3); continue; }
    if (CLITICS.has(chunk) || CLITICS.has(chunk.toLowerCase())) break;
    if (PREFIX.has(chunk[0]) && len(chunk) > 1) { pre.push(chunk[0]); chunk = chunk.slice(1); continue; }
    if (chunk.endsWith('...') && len(chunk) > 3) { post.unshift('...'); chunk = chunk.slice(0, -3); continue; }
    const last = [...chunk].at(-1);
    if ("'’".includes(last) && len(chunk) > 2 && 'sS'.includes([...chunk].at(-2))) break;   // the Germans' (possessive)
    if (SUFFIX.has(last) && len(chunk) > 1) { post.unshift(last); chunk = chunk.slice(0, -last.length); continue; }
    if (chunk.endsWith('.') && len(chunk) > 1 && !/^(?:[A-Za-z]\.)+$/.test(chunk)) { post.unshift('.'); chunk = chunk.slice(0, -1); continue; }
    break;
  }
  const mid = chunk ? chunk.split(/(—|…|\.\.\.|(?<!\p{Nd})–|–(?!\p{Nd}))/u).filter(Boolean) : [];
  return [...pre, ...mid, ...post];
}

function tokenize(text) {
  const out = [], chunks = [...text.matchAll(/(\S+)(\s*)/gu)];
  chunks.forEach((m, c) => {
    const toks = splitChunk(m[1], c + 1 < chunks.length ? chunks[c + 1][1] : '');
    toks.forEach((t, k) => out.push([t, k === toks.length - 1 && m[2] ? ' ' : '']));
  });
  return out;
}

function ruleTag(tokens, i, quotes) {
  const [t, ws] = tokens[i];
  const prev = i > 0 ? tokens[i - 1][0] : null, prevWs = i > 0 ? tokens[i - 1][1] : ' ';
  const next = i + 1 < tokens.length ? tokens[i + 1][0] : null;
  const low = t.toLowerCase();
  if (t.length === 1 && '.!?'.includes(t)) return '.';
  if (t === ',') return ',';
  if (t === '(' || t === '[') return '-LRB-';
  if (t === ')' || t === ']') return '-RRB-';
  if ([';', ':', '—', '–', '...', '…'].includes(t)) return ':';
  if (t === '-') return prevWs && ws ? ':' : 'HYPH';
  if (t.length === 1 && '$£€¥'.includes(t)) return '$';
  if (t === '#') return '#';
  if (t.length === 1 && '“‘`'.includes(t)) return '``';
  if (t === '”' || t === '’') return "''";
  if (t === '"' || t === "'") {
    const left = prev === null || !!prevWs || '([{'.includes(prev), right = !!ws || next === null;
    const opening = left === right ? quotes[t] % 2 === 0 : left;
    quotes[t]++;
    return opening ? '``' : "''";
  }
  if (/^\p{Nd}/u.test(t)) return 'CD';
  if (['hundred', 'thousand', 'million', 'billion', 'trillion'].includes(low) && prev && /^\p{Nd}/u.test(prev)) return 'CD';
  if (low === 'that') {
    const n = next ? next.toLowerCase() : '';
    return next && isAlpha(first(next)) && !PRON.has(n) && !DT.has(n) && !n.endsWith('ly')
      && (prev === null || ['of', 'in', 'at', 'on', 'from', 'with', 'for', 'by', 'to', 'all', 'and', 'but'].includes(prev.toLowerCase())) ? 'DT' : 'IN';
  }
  if (DT.has(low)) return 'DT';
  if (t === 'I') return 'PRP';
  if (low === 'to') return 'TO';
  if (low === 'in' || low === 'by') return next && isAlnum(first(next)) && !['and', 'or', 'but'].includes(next.toLowerCase()) ? 'IN' : 'RP';
  if (low === 'am') return prev && /^\p{Nd}/u.test(prev) ? 'NN' : 'VBP';
  if (low === 'used') return 'VBD';
  if (len(t) > 1 && pyUpper(t) && isAlpha(t)) return 'NNP';
  if (pyUpper(first(t)) && i > 0 && !['.', '!', '?', '"', '“', ':'].includes(tokens[i - 1][0])) return 'NNP';
  const pl = prev ? prev.toLowerCase() : null;
  if (MD.has(pl)) return 'VB';
  if (POSS.has(pl)) return 'NN';
  return 'XX';
}

// spaCy's tag for a word whose phonemes depend on it, from the words around it
// (an averaged perceptron, en-tags.json).
function tagFeatures(toks, at) {
  const g = (j) => (j >= 0 && j < toks.length ? toks[j].toLowerCase() : j < 0 ? '<s>' : '</s>');
  const tail = (s, n) => [...s].slice(-n).join('');
  const shape = (w) => (pyUpper(w) && len(w) > 1 ? 'A' : pyUpper(first(w)) ? 'Aa' : 'a');
  const w = g(at), p1 = g(at - 1), p2 = g(at - 2), n1 = g(at + 1), n2 = g(at + 2);
  return ['b', 'w=' + w, 's=' + shape(toks[at]) + '|' + w, 'p1=' + p1, 'n1=' + n1, 'p2=' + p2, 'n2=' + n2,
    'wp=' + w + '|' + p1, 'wn=' + w + '|' + n1, 'wpp=' + w + '|' + p2 + '|' + p1, 'wnn=' + w + '|' + n1 + '|' + n2,
    'p1s=' + tail(p1, 2), 'n1s=' + tail(n1, 2), 'n1t=' + tail(n1, 3), 'p1t=' + tail(p1, 3), 'wps=' + w + '|' + tail(p1, 2),
    'wns=' + w + '|' + tail(n1, 2)];
}

function token(text, tag, whitespace, extra = {}) {
  return { text, tag, whitespace, phonemes: null, isHead: true, alias: null, stress: null, currency: null, numFlags: '',
    prespace: false, rating: null, ...extra };
}

function mergeTokens(tokens, unk = null) {
  const stress = new Set(tokens.filter((t) => t.stress !== null).map((t) => t.stress));
  const currency = tokens.map((t) => t.currency).filter((c) => c !== null);
  const ratings = tokens.map((t) => t.rating);
  let phonemes = null;
  if (unk !== null) {
    phonemes = '';
    for (const t of tokens) {
      if (t.prespace && phonemes && !/\s$/u.test(phonemes) && t.phonemes) phonemes += ' ';
      phonemes += t.phonemes === null ? unk : t.phonemes;
    }
  }
  const weight = (t) => [...t.text].reduce((n, c) => n + (c === c.toLowerCase() ? 1 : 2), 0);
  let best = tokens[0];
  for (const t of tokens) if (weight(t) > weight(best)) best = t;
  return token(tokens.slice(0, -1).map((t) => t.text + t.whitespace).join('') + tokens.at(-1).text, best.tag, tokens.at(-1).whitespace, {
    phonemes, isHead: tokens[0].isHead, stress: stress.size === 1 ? [...stress][0] : null,
    currency: currency.length ? currency.sort().at(-1) : null,
    numFlags: [...new Set(tokens.flatMap((t) => [...t.numFlags]))].sort().join(''),
    prespace: tokens[0].prespace, rating: ratings.includes(null) ? null : Math.min(...ratings),
  });
}

function retokenize(tokens) {
  const words = [];
  let currency = null;
  tokens.forEach((tok, i) => {
    let tks;
    if (tok.alias === null && tok.phonemes === null)
      tks = subtokenize(tok.text).map((t) => token(t, tok.tag, '', { numFlags: tok.numFlags, stress: tok.stress }));
    else tks = [tok];
    tks.at(-1).whitespace = tok.whitespace;
    tks.forEach((tk, j) => {
      if (tk.alias !== null || tk.phonemes !== null) { /* already resolved */ }
      else if (tk.tag === '$' && has(CURRENCIES, tk.text)) { currency = tk.text; tk.phonemes = ''; tk.rating = 4; }
      else if (tk.tag === ':' && (tk.text === '-' || tk.text === '–')) { tk.phonemes = '—'; tk.rating = 3; }
      else if (PUNCT_TAGS.has(tk.tag) && ![...tk.text].every((c) => { const o = c.toLowerCase().codePointAt(0); return o >= 97 && o <= 122; })) {
        tk.phonemes = has(PUNCT_TAG_PHONEMES, tk.tag) ? PUNCT_TAG_PHONEMES[tk.tag] : [...tk.text].filter((c) => PUNCTS.has(c)).join('');
        tk.rating = 4;
      } else if (currency !== null) {
        if (tk.tag !== 'CD') currency = null;
        else if (j + 1 === tks.length && (i + 1 === tokens.length || tokens[i + 1].tag !== 'CD')) tk.currency = currency;
      } else if (j > 0 && j < tks.length - 1 && tk.text === '2' && isAlpha([...tks[j - 1].text].at(-1) + first(tks[j + 1].text))) tk.alias = 'to';
      if (tk.alias !== null || tk.phonemes !== null) words.push(tk);
      else if (words.length && Array.isArray(words.at(-1)) && !words.at(-1).at(-1).whitespace) { tk.isHead = false; words.at(-1).push(tk); }
      else words.push(tk.whitespace ? tk : [tk]);
    });
  });
  return words.map((w) => (Array.isArray(w) && w.length === 1 ? w[0] : w));
}

function tokenContext(ctx, ps, tok) {
  let vowel = ctx.futureVowel;
  if (ps) for (const c of ps) {
    if (VOWELS.has(c) || CONSONANTS.has(c) || NON_QUOTE_PUNCTS.has(c)) { vowel = NON_QUOTE_PUNCTS.has(c) ? null : VOWELS.has(c); break; }
  }
  const futureTo = tok.text === 'to' || tok.text === 'To' || (tok.text === 'TO' && (tok.tag === 'TO' || tok.tag === 'IN'));
  return { futureVowel: vowel, futureTo };
}

function resolveTokens(tokens) {
  const text = tokens.slice(0, -1).map((t) => t.text + t.whitespace).join('') + tokens.at(-1).text;
  const kinds = new Set([...text].filter((c) => !SUBTOKEN_JUNKS.has(c)).map((c) => (isAlpha(c) ? 0 : isDigits(c) ? 1 : 2)));
  const prespace = text.includes(' ') || text.includes('/') || kinds.size > 1;
  tokens.forEach((tk, i) => {
    if (tk.phonemes === null) {
      if (i === tokens.length - 1 && NON_QUOTE_PUNCTS.has(tk.text)) { tk.phonemes = tk.text; tk.rating = 3; }
      else if ([...tk.text].every((c) => SUBTOKEN_JUNKS.has(c))) { tk.phonemes = ''; tk.rating = 3; }
    } else if (i > 0) tk.prespace = prespace;
  });
  if (prespace) return;
  let indices = tokens.map((tk, i) => [tk.phonemes && tk.phonemes.includes(PRIMARY) ? 1 : 0, stressWeight(tk.phonemes), i]).filter(([, , i]) => tokens[i].phonemes);
  if (indices.length === 2 && len(tokens[indices[0][2]].text) === 1) {
    const i = indices[1][2];
    tokens[i].phonemes = applyStress(tokens[i].phonemes, -0.5);
    return;
  }
  if (indices.length < 2 || indices.reduce((n, [b]) => n + b, 0) <= Math.floor((indices.length + 1) / 2)) return;
  indices = indices.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]).slice(0, Math.floor(indices.length / 2));
  for (const [, , i] of indices) tokens[i].phonemes = applyStress(tokens[i].phonemes, -0.5);
}

export class MisakiEnglish {
  // data: { gold, silver } (misaki's us_ or gb_ dictionaries), tags: en-tags.json, fallback: async (text) -> phonemes
  constructor(british, data, tags, fallback = null) {
    this.british = british;
    this.lexicon = new Lexicon(british, data.gold, data.silver);
    this.tags = tags;
    this.tagWords = new Set(tags.words);
    this.fallback = fallback;
  }

  tagOf(words, at) {
    const s = new Array(this.tags.classes.length).fill(0);
    for (const f of tagFeatures(words, at)) {
      const w = this.tags.weights[f];
      if (w) for (const k in w) s[+k] += w[k];
    }
    let best = 0;
    for (let k = 1; k < s.length; k++) if (s[k] > s[best]) best = k;
    return this.tags.classes[best] === 'X' ? 'XX' : this.tags.classes[best];
  }

  tokenize(text) {
    const toks = tokenize(text), quotes = { '"': 0, "'": 0 }, words = toks.map(([t]) => t);
    return toks.map(([t, ws], i) => {
      const rule = ruleTag(toks, i, quotes);
      return token(t, this.tagWords.has(t.toLowerCase()) ? this.tagOf(words, i) : rule, ws);
    });
  }

  // One sentence -> phonemes, as misaki's en.G2P(trf=False, unk="") gives them.
  async phonemize(text) {
    let tokens = retokenize(this.tokenize(text.replace(/^\s+/u, '')));
    let ctx = { futureVowel: null, futureTo: false };
    for (let i = tokens.length - 1; i >= 0; i--) {
      const w = tokens[i];
      if (!Array.isArray(w)) {
        if (w.phonemes === null) [w.phonemes, w.rating] = this.lexicon.call(w, ctx);
        if (w.phonemes === null && this.fallback) { w.phonemes = await this.fallback(w.text); w.rating = 2; }
        ctx = tokenContext(ctx, w.phonemes, w);
        continue;
      }
      let left = 0, right = w.length, shouldFallback = false;
      while (left < right) {
        const span = w.slice(left, right);
        const tk = span.some((t) => t.alias !== null || t.phonemes !== null) ? null : mergeTokens(span);
        const [ps, rating] = tk === null ? [null, null] : this.lexicon.call(tk, ctx);
        if (ps !== null && ps !== undefined) {
          w[left].phonemes = ps; w[left].rating = rating;
          for (const x of w.slice(left + 1, right)) { x.phonemes = ''; x.rating = rating; }
          ctx = tokenContext(ctx, ps, tk);
          right = left; left = 0;
        } else if (left + 1 < right) left++;
        else {
          right--;
          const t = w[right];
          if (t.phonemes === null) {
            if ([...t.text].every((c) => SUBTOKEN_JUNKS.has(c))) { t.phonemes = ''; t.rating = 3; }
            else if (this.fallback) { shouldFallback = true; break; }
          }
          left = 0;
        }
      }
      if (shouldFallback) {
        const tk = mergeTokens(w);
        w[0].phonemes = await this.fallback(tk.text); w[0].rating = 2;
        for (const x of w.slice(1)) { x.phonemes = ''; x.rating = 2; }
      } else resolveTokens(w);
    }
    tokens = tokens.map((t) => (Array.isArray(t) ? mergeTokens(t, '') : t));
    for (const t of tokens) if (t.phonemes) t.phonemes = t.phonemes.replaceAll('ɾ', 'T').replaceAll('ʔ', 't');
    return tokens.map((t) => (t.phonemes === null ? '' : t.phonemes) + t.whitespace).join('');
  }
}

// misaki's fallback for words its dictionaries don't have, as in paradee/g2p.py:
// Paradee's G2P model and English word list, with digits read by misaki itself.
export function englishFallback(g2p, british, plain) {
  const lang = british ? 'en-gb' : 'en-us';
  const isEdge = (c) => /[\p{P}\p{S}\p{Z}]/u.test(c) || '​‌‍﻿'.includes(c);
  const strip = (w) => { const a = [...w]; let i = 0, j = a.length; while (i < j && isEdge(a[i])) i++; while (j > i && isEdge(a[j - 1])) j--; return a.slice(i, j).join(''); };
  return async (text) => {
    const words = g2p.data.lexicon[lang].w, out = [];
    for (const piece of text.split(/\s+/u).filter(Boolean)) {
      const core = strip(piece);
      if (!core || !/[\p{L}\p{N}]/u.test(core)) continue;
      const i = piece.indexOf(core), said = [];
      for (let part of core.match(/\d+|\D+/gu)) {
        if (/^\d+$/.test(part)) said.push(await plain.phonemize(part));
        else {
          part = part.replace(/^[-.,/:']+|[-.,/:']+$/gu, '');
          if (/[\p{L}\p{N}]/u.test(part)) said.push(has(words, part) ? words[part] : (await g2p.model([[lang, '#', part, '#']]))[0]);
        }
      }
      out.push(piece.slice(0, i) + said.join(' ') + piece.slice(i + core.length));
    }
    return out.join(' ');
  };
}
